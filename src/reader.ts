import { readdir, readFile as fsReadFile, stat } from "node:fs/promises";
import { join, sep } from "node:path";
import type { AssistantUsage, RawJSONLLine } from "./types.js";

export interface ParsedLine {
  sessionId: string;
  timestamp: string;
  model: string;
  usage: AssistantUsage;
  project: string;
  isSubagent: boolean;
  agentId?: string;
}

export interface FileOffsets {
  [filePath: string]: number;
}

/**
 * Derive project name from a JSONL directory path.
 * e.g. "-Users-maximilianwidjaya-Desktop-Code-readme" -> "readme"
 */
export function deriveProjectName(dirName: string): string {
  const segments = dirName.split("-").filter(Boolean);
  if (segments.length === 0) return "unknown";

  const codeIdx = segments.lastIndexOf("Code");
  if (codeIdx !== -1 && codeIdx < segments.length - 1) {
    return segments.slice(codeIdx + 1).join("-");
  }

  return segments[segments.length - 1];
}

function stripBom(content: string): string {
  if (content.charCodeAt(0) === 0xfeff) {
    return content.slice(1);
  }
  return content;
}

const SKIP_TYPES = new Set([
  "file-history-snapshot",
  "progress",
  "queue-operation",
  "system",
  "user",
]);

function parseLine(
  raw: string,
  project: string,
  isSubagent: boolean,
): ParsedLine | null {
  if (!raw.trim()) return null;

  let parsed: RawJSONLLine;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!parsed.type || SKIP_TYPES.has(parsed.type)) return null;
  if (parsed.type !== "assistant") return null;

  const message = parsed.message as Record<string, unknown> | undefined;
  if (!message) return null;

  const usage = message.usage as AssistantUsage | undefined;
  if (!usage || typeof usage.input_tokens !== "number") return null;

  const model = (message.model as string) ?? "<synthetic>";

  return {
    sessionId: parsed.sessionId,
    timestamp: parsed.timestamp,
    model,
    usage: {
      input_tokens: usage.input_tokens ?? 0,
      output_tokens: usage.output_tokens ?? 0,
      cache_creation_input_tokens: usage.cache_creation_input_tokens ?? 0,
      cache_read_input_tokens: usage.cache_read_input_tokens ?? 0,
      cache_creation: usage.cache_creation,
      server_tool_use: usage.server_tool_use,
      service_tier: usage.service_tier ?? "",
      inference_geo: usage.inference_geo,
    },
    project,
    isSubagent,
    agentId: parsed.agentId,
  };
}

export async function readFile(
  filePath: string,
  project: string,
  isSubagent: boolean,
  byteOffset = 0,
): Promise<{ lines: ParsedLine[]; newOffset: number }> {
  let content: string;
  try {
    const buf = await fsReadFile(filePath);
    const slice = byteOffset > 0 ? buf.subarray(byteOffset) : buf;
    content = stripBom(slice.toString("utf-8"));
  } catch {
    return { lines: [], newOffset: byteOffset };
  }

  if (!content.trim()) return { lines: [], newOffset: byteOffset };

  const rawLines = content.split("\n");
  const lines: ParsedLine[] = [];

  for (const raw of rawLines) {
    const parsed = parseLine(raw, project, isSubagent);
    if (parsed) lines.push(parsed);
  }

  try {
    const fileStat = await stat(filePath);
    return { lines, newOffset: fileStat.size };
  } catch {
    return { lines, newOffset: byteOffset + Buffer.byteLength(content, "utf-8") };
  }
}

async function findJsonlFiles(
  dir: string,
): Promise<{ path: string; isSubagent: boolean }[]> {
  const results: { path: string; isSubagent: boolean }[] = [];

  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      const subResults = await findJsonlFiles(fullPath);
      results.push(...subResults);
    } else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
      const isSubagent = fullPath.includes(`${sep}subagents${sep}`);
      results.push({ path: fullPath, isSubagent });
    }
  }

  return results;
}

export async function readAll(
  dataPath: string,
): Promise<ParsedLine[]> {
  const allLines: ParsedLine[] = [];

  let projectDirs;
  try {
    projectDirs = await readdir(dataPath, { withFileTypes: true });
  } catch {
    return allLines;
  }

  for (const projectDir of projectDirs) {
    if (!projectDir.isDirectory()) continue;

    const project = deriveProjectName(projectDir.name);
    const projectPath = join(dataPath, projectDir.name);
    const jsonlFiles = await findJsonlFiles(projectPath);

    for (const { path: filePath, isSubagent } of jsonlFiles) {
      const { lines } = await readFile(filePath, project, isSubagent);
      allLines.push(...lines);
    }
  }

  return allLines;
}

export async function readIncremental(
  dataPath: string,
  offsets: FileOffsets,
): Promise<{ lines: ParsedLine[]; offsets: FileOffsets }> {
  const newOffsets: FileOffsets = { ...offsets };
  const allLines: ParsedLine[] = [];

  let projectDirs;
  try {
    projectDirs = await readdir(dataPath, { withFileTypes: true });
  } catch {
    return { lines: allLines, offsets: newOffsets };
  }

  for (const projectDir of projectDirs) {
    if (!projectDir.isDirectory()) continue;

    const project = deriveProjectName(projectDir.name);
    const projectPath = join(dataPath, projectDir.name);
    const jsonlFiles = await findJsonlFiles(projectPath);

    for (const { path: filePath, isSubagent } of jsonlFiles) {
      const currentOffset = offsets[filePath] ?? 0;
      const { lines, newOffset } = await readFile(
        filePath,
        project,
        isSubagent,
        currentOffset,
      );
      allLines.push(...lines);
      newOffsets[filePath] = newOffset;
    }
  }

  return { lines: allLines, offsets: newOffsets };
}
