import type {
  DailyUsage,
  WeeklyUsage,
  MonthlyUsage,
  ParsedSession,
  ProjectUsage,
  ModelUsage,
  UsageSummary,
  DateRange,
} from "./types.js";
import type { ParsedLine } from "./reader.js";
import { calculateCost, normalizeModelName } from "./cost-calculator.js";

function toDateKey(ts: string): string {
  return ts.slice(0, 10);
}

function toMonthKey(ts: string): string {
  return ts.slice(0, 7);
}

function toWeekStart(ts: string): string {
  const d = new Date(ts);
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff));
  return monday.toISOString().slice(0, 10);
}

function inRange(ts: string, range?: DateRange): boolean {
  if (!range) return true;
  const d = new Date(ts);
  if (range.from && d < range.from) return false;
  if (range.to && d > range.to) return false;
  return true;
}

function filterByRange(lines: ParsedLine[], range?: DateRange): ParsedLine[] {
  if (!range) return lines;
  return lines.filter((l) => inRange(l.timestamp, range));
}

export function groupByDay(
  lines: ParsedLine[],
  range?: DateRange,
): DailyUsage[] {
  const filtered = filterByRange(lines, range);
  const map = new Map<
    string,
    {
      input: number;
      output: number;
      cacheCreation: number;
      cacheRead: number;
      cost: number;
      sessions: Set<string>;
    }
  >();

  for (const line of filtered) {
    const key = toDateKey(line.timestamp);
    let entry = map.get(key);
    if (!entry) {
      entry = {
        input: 0,
        output: 0,
        cacheCreation: 0,
        cacheRead: 0,
        cost: 0,
        sessions: new Set(),
      };
      map.set(key, entry);
    }
    entry.input += line.usage.input_tokens;
    entry.output += line.usage.output_tokens;
    entry.cacheCreation += line.usage.cache_creation_input_tokens;
    entry.cacheRead += line.usage.cache_read_input_tokens;
    entry.cost += calculateCost(line.model, {
      inputTokens: line.usage.input_tokens,
      outputTokens: line.usage.output_tokens,
      cacheCreationTokens: line.usage.cache_creation_input_tokens,
      cacheReadTokens: line.usage.cache_read_input_tokens,
    });
    entry.sessions.add(line.sessionId);
  }

  return Array.from(map.entries())
    .map(([date, e]) => ({
      date,
      inputTokens: e.input,
      outputTokens: e.output,
      cacheCreationTokens: e.cacheCreation,
      cacheReadTokens: e.cacheRead,
      cost: e.cost,
      sessionCount: e.sessions.size,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function groupByWeek(
  lines: ParsedLine[],
  range?: DateRange,
): WeeklyUsage[] {
  const filtered = filterByRange(lines, range);
  const map = new Map<
    string,
    {
      input: number;
      output: number;
      cacheCreation: number;
      cacheRead: number;
      cost: number;
      sessions: Set<string>;
    }
  >();

  for (const line of filtered) {
    const key = toWeekStart(line.timestamp);
    let entry = map.get(key);
    if (!entry) {
      entry = {
        input: 0,
        output: 0,
        cacheCreation: 0,
        cacheRead: 0,
        cost: 0,
        sessions: new Set(),
      };
      map.set(key, entry);
    }
    entry.input += line.usage.input_tokens;
    entry.output += line.usage.output_tokens;
    entry.cacheCreation += line.usage.cache_creation_input_tokens;
    entry.cacheRead += line.usage.cache_read_input_tokens;
    entry.cost += calculateCost(line.model, {
      inputTokens: line.usage.input_tokens,
      outputTokens: line.usage.output_tokens,
      cacheCreationTokens: line.usage.cache_creation_input_tokens,
      cacheReadTokens: line.usage.cache_read_input_tokens,
    });
    entry.sessions.add(line.sessionId);
  }

  return Array.from(map.entries())
    .map(([weekStart, e]) => ({
      weekStart,
      inputTokens: e.input,
      outputTokens: e.output,
      cacheCreationTokens: e.cacheCreation,
      cacheReadTokens: e.cacheRead,
      cost: e.cost,
      sessionCount: e.sessions.size,
    }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

export function groupByMonth(
  lines: ParsedLine[],
  range?: DateRange,
): MonthlyUsage[] {
  const filtered = filterByRange(lines, range);
  const map = new Map<
    string,
    {
      input: number;
      output: number;
      cacheCreation: number;
      cacheRead: number;
      cost: number;
      sessions: Set<string>;
    }
  >();

  for (const line of filtered) {
    const key = toMonthKey(line.timestamp);
    let entry = map.get(key);
    if (!entry) {
      entry = {
        input: 0,
        output: 0,
        cacheCreation: 0,
        cacheRead: 0,
        cost: 0,
        sessions: new Set(),
      };
      map.set(key, entry);
    }
    entry.input += line.usage.input_tokens;
    entry.output += line.usage.output_tokens;
    entry.cacheCreation += line.usage.cache_creation_input_tokens;
    entry.cacheRead += line.usage.cache_read_input_tokens;
    entry.cost += calculateCost(line.model, {
      inputTokens: line.usage.input_tokens,
      outputTokens: line.usage.output_tokens,
      cacheCreationTokens: line.usage.cache_creation_input_tokens,
      cacheReadTokens: line.usage.cache_read_input_tokens,
    });
    entry.sessions.add(line.sessionId);
  }

  return Array.from(map.entries())
    .map(([month, e]) => ({
      month,
      inputTokens: e.input,
      outputTokens: e.output,
      cacheCreationTokens: e.cacheCreation,
      cacheReadTokens: e.cacheRead,
      cost: e.cost,
      sessionCount: e.sessions.size,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

export function groupBySession(lines: ParsedLine[]): ParsedSession[] {
  const map = new Map<
    string,
    {
      project: string;
      models: Map<string, number>;
      timestamps: string[];
      input: number;
      output: number;
      cacheCreation: number;
      cacheRead: number;
      cost: number;
      messageCount: number;
    }
  >();

  for (const line of lines) {
    let entry = map.get(line.sessionId);
    if (!entry) {
      entry = {
        project: line.project,
        models: new Map(),
        timestamps: [],
        input: 0,
        output: 0,
        cacheCreation: 0,
        cacheRead: 0,
        cost: 0,
        messageCount: 0,
      };
      map.set(line.sessionId, entry);
    }
    entry.timestamps.push(line.timestamp);
    entry.input += line.usage.input_tokens;
    entry.output += line.usage.output_tokens;
    entry.cacheCreation += line.usage.cache_creation_input_tokens;
    entry.cacheRead += line.usage.cache_read_input_tokens;
    entry.cost += calculateCost(line.model, {
      inputTokens: line.usage.input_tokens,
      outputTokens: line.usage.output_tokens,
      cacheCreationTokens: line.usage.cache_creation_input_tokens,
      cacheReadTokens: line.usage.cache_read_input_tokens,
    });
    entry.messageCount++;

    const normalized = normalizeModelName(line.model);
    entry.models.set(normalized, (entry.models.get(normalized) ?? 0) + 1);
  }

  return Array.from(map.entries())
    .map(([sessionId, e]) => {
      const sorted = e.timestamps.toSorted();
      let topModel = "unknown";
      let topCount = 0;
      for (const [model, count] of e.models) {
        if (count > topCount) {
          topModel = model;
          topCount = count;
        }
      }
      return {
        sessionId,
        project: e.project,
        model: topModel,
        startedAt: sorted[0],
        endedAt: sorted[sorted.length - 1],
        inputTokens: e.input,
        outputTokens: e.output,
        cacheCreationTokens: e.cacheCreation,
        cacheReadTokens: e.cacheRead,
        cost: e.cost,
        messageCount: e.messageCount,
      };
    })
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}

export function groupByProject(lines: ParsedLine[]): ProjectUsage[] {
  const map = new Map<
    string,
    {
      input: number;
      output: number;
      cacheCreation: number;
      cacheRead: number;
      cost: number;
      sessions: Set<string>;
    }
  >();

  for (const line of lines) {
    let entry = map.get(line.project);
    if (!entry) {
      entry = {
        input: 0,
        output: 0,
        cacheCreation: 0,
        cacheRead: 0,
        cost: 0,
        sessions: new Set(),
      };
      map.set(line.project, entry);
    }
    entry.input += line.usage.input_tokens;
    entry.output += line.usage.output_tokens;
    entry.cacheCreation += line.usage.cache_creation_input_tokens;
    entry.cacheRead += line.usage.cache_read_input_tokens;
    entry.cost += calculateCost(line.model, {
      inputTokens: line.usage.input_tokens,
      outputTokens: line.usage.output_tokens,
      cacheCreationTokens: line.usage.cache_creation_input_tokens,
      cacheReadTokens: line.usage.cache_read_input_tokens,
    });
    entry.sessions.add(line.sessionId);
  }

  return Array.from(map.entries())
    .map(([projectName, e]) => ({
      projectName,
      inputTokens: e.input,
      outputTokens: e.output,
      cacheCreationTokens: e.cacheCreation,
      cacheReadTokens: e.cacheRead,
      cost: e.cost,
      sessionCount: e.sessions.size,
    }))
    .sort((a, b) => b.cost - a.cost);
}

export function groupByModel(lines: ParsedLine[]): ModelUsage[] {
  const map = new Map<
    string,
    {
      input: number;
      output: number;
      cacheCreation: number;
      cacheRead: number;
      cost: number;
    }
  >();

  for (const line of lines) {
    const model = normalizeModelName(line.model);
    let entry = map.get(model);
    if (!entry) {
      entry = { input: 0, output: 0, cacheCreation: 0, cacheRead: 0, cost: 0 };
      map.set(model, entry);
    }
    entry.input += line.usage.input_tokens;
    entry.output += line.usage.output_tokens;
    entry.cacheCreation += line.usage.cache_creation_input_tokens;
    entry.cacheRead += line.usage.cache_read_input_tokens;
    entry.cost += calculateCost(line.model, {
      inputTokens: line.usage.input_tokens,
      outputTokens: line.usage.output_tokens,
      cacheCreationTokens: line.usage.cache_creation_input_tokens,
      cacheReadTokens: line.usage.cache_read_input_tokens,
    });
  }

  return Array.from(map.entries())
    .map(([model, e]) => ({
      model,
      inputTokens: e.input,
      outputTokens: e.output,
      cacheCreationTokens: e.cacheCreation,
      cacheReadTokens: e.cacheRead,
      cost: e.cost,
    }))
    .sort((a, b) => b.cost - a.cost);
}

export function summarize(
  lines: ParsedLine[],
  range?: DateRange,
): UsageSummary {
  const filtered = filterByRange(lines, range);

  let totalInput = 0;
  let totalOutput = 0;
  let totalCacheCreation = 0;
  let totalCacheRead = 0;
  let totalCost = 0;
  const sessions = new Set<string>();

  for (const line of filtered) {
    totalInput += line.usage.input_tokens;
    totalOutput += line.usage.output_tokens;
    totalCacheCreation += line.usage.cache_creation_input_tokens;
    totalCacheRead += line.usage.cache_read_input_tokens;
    totalCost += calculateCost(line.model, {
      inputTokens: line.usage.input_tokens,
      outputTokens: line.usage.output_tokens,
      cacheCreationTokens: line.usage.cache_creation_input_tokens,
      cacheReadTokens: line.usage.cache_read_input_tokens,
    });
    sessions.add(line.sessionId);
  }

  return {
    totalInputTokens: totalInput,
    totalOutputTokens: totalOutput,
    totalCacheCreationTokens: totalCacheCreation,
    totalCacheReadTokens: totalCacheRead,
    totalCost,
    sessionCount: sessions.size,
    daily: groupByDay(filtered),
    weekly: groupByWeek(filtered),
    monthly: groupByMonth(filtered),
    byProject: groupByProject(filtered),
    byModel: groupByModel(filtered),
  };
}
