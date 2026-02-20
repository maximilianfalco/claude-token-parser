#!/usr/bin/env node

import { homedir } from "node:os";
import { join } from "node:path";
import { readAll } from "./reader.js";
import { summarize } from "./aggregator.js";
import type { DateRange } from "./types.js";

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

function createSpinner(message: string): { stop: () => void } {
  let i = 0;
  const id = setInterval(() => {
    process.stderr.write(`\r${SPINNER_FRAMES[i++ % SPINNER_FRAMES.length]} ${message}`);
  }, 80);
  return {
    stop() {
      clearInterval(id);
      process.stderr.write(`\r${" ".repeat(message.length + 4)}\r`);
    },
  };
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function formatCost(n: number): string {
  return `$${n.toFixed(2)}`;
}

function pad(str: string, len: number): string {
  return str.padEnd(len);
}

function printHelp(): void {
  console.log(`
claude-token-parser — Parse Claude Code session logs

Usage:
  claude-token-parser [options]

Options:
  --path <dir>       Path to Claude projects dir (default: ~/.claude/projects)
  --json             Output raw JSON instead of formatted table
  --daily            Show daily breakdown
  --weekly           Show weekly breakdown
  --monthly          Show monthly breakdown
  --project <name>   Filter to a specific project
  --from <date>      Start date (YYYY-MM-DD)
  --to <date>        End date (YYYY-MM-DD)
  -h, --help         Show this help message
`);
}

function parseArgs(argv: string[]): {
  path: string;
  json: boolean;
  daily: boolean;
  weekly: boolean;
  monthly: boolean;
  project?: string;
  range?: DateRange;
  help: boolean;
} {
  const opts = {
    path: join(homedir(), ".claude", "projects"),
    json: false,
    daily: false,
    weekly: false,
    monthly: false,
    project: undefined as string | undefined,
    range: undefined as DateRange | undefined,
    help: false,
  };

  let from: string | undefined;
  let to: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--path":
        opts.path = argv[++i];
        break;
      case "--json":
        opts.json = true;
        break;
      case "--daily":
        opts.daily = true;
        break;
      case "--weekly":
        opts.weekly = true;
        break;
      case "--monthly":
        opts.monthly = true;
        break;
      case "--project":
        opts.project = argv[++i];
        break;
      case "--from":
        from = argv[++i];
        break;
      case "--to":
        to = argv[++i];
        break;
      case "-h":
      case "--help":
        opts.help = true;
        break;
    }
  }

  if (from || to) {
    opts.range = {
      from: from ? new Date(from) : new Date(0),
      to: to ? new Date(to + "T23:59:59.999Z") : new Date(),
    };
  }

  return opts;
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.help) {
    printHelp();
    process.exit(0);
  }

  const spinner = opts.json ? null : createSpinner("Parsing session logs…");

  let lines = await readAll(opts.path);

  if (lines.length === 0) {
    spinner?.stop();
    console.log("No Claude Code session data found.");
    console.log(`Looked in: ${opts.path}`);
    process.exit(0);
  }

  if (opts.project) {
    const filter = opts.project.toLowerCase();
    lines = lines.filter((l) => l.project.toLowerCase().includes(filter));
    if (lines.length === 0) {
      spinner?.stop();
      console.log(`No data found for project "${opts.project}".`);
      process.exit(0);
    }
  }

  const summary = summarize(lines, opts.range);
  spinner?.stop();

  if (opts.json) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  // Summary header
  console.log();
  console.log("Claude Code Usage Summary");
  console.log("─".repeat(40));
  console.log(`  Total Cost:      ${formatCost(summary.totalCost)}`);
  console.log(`  Sessions:        ${summary.sessionCount}`);
  console.log(`  Input Tokens:    ${formatTokens(summary.totalInputTokens)}`);
  console.log(`  Output Tokens:   ${formatTokens(summary.totalOutputTokens)}`);
  console.log(`  Cache Created:   ${formatTokens(summary.totalCacheCreationTokens)}`);
  console.log(`  Cache Read:      ${formatTokens(summary.totalCacheReadTokens)}`);

  // By Model
  if (summary.byModel.length > 0) {
    console.log();
    console.log("By Model");
    console.log("─".repeat(40));
    const totalCost = summary.totalCost || 1;
    for (const m of summary.byModel) {
      const pct = ((m.cost / totalCost) * 100).toFixed(1);
      console.log(`  ${pad(m.model, 22)} ${formatCost(m.cost).padStart(8)}  (${pct}%)`);
    }
  }

  // By Project
  if (summary.byProject.length > 0) {
    console.log();
    console.log("By Project");
    console.log("─".repeat(40));
    for (const p of summary.byProject) {
      console.log(
        `  ${pad(p.projectName, 22)} ${formatCost(p.cost).padStart(8)}  ${p.sessionCount} sessions`,
      );
    }
  }

  // Daily
  if (opts.daily && summary.daily.length > 0) {
    console.log();
    console.log("Daily");
    console.log("─".repeat(40));
    for (const d of summary.daily.slice(-14)) {
      console.log(
        `  ${d.date}   ${formatCost(d.cost).padStart(8)}   ${d.sessionCount} sessions`,
      );
    }
  }

  // Weekly
  if (opts.weekly && summary.weekly.length > 0) {
    console.log();
    console.log("Weekly (week starting)");
    console.log("─".repeat(40));
    for (const w of summary.weekly.slice(-8)) {
      console.log(
        `  ${w.weekStart}   ${formatCost(w.cost).padStart(8)}   ${w.sessionCount} sessions`,
      );
    }
  }

  // Monthly
  if (opts.monthly && summary.monthly.length > 0) {
    console.log();
    console.log("Monthly");
    console.log("─".repeat(40));
    for (const m of summary.monthly) {
      console.log(
        `  ${m.month}      ${formatCost(m.cost).padStart(8)}   ${m.sessionCount} sessions`,
      );
    }
  }

  console.log();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
