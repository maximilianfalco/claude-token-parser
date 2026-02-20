# claude-token-parser

Parse [Claude Code](https://claude.ai/code) session logs into token usage summaries, cost breakdowns, and aggregations by project, model, and time period.

## Install

```
npm install claude-token-parser
```

## CLI

```
npx claude-token-parser
```

```
Claude Code Usage Summary
────────────────────────────────────────
  Total Cost:      $11248.43
  Sessions:        356
  Input Tokens:    3.4M
  Output Tokens:   2.2M
  Cache Created:   307.2M
  Cache Read:      4874.1M

By Model
────────────────────────────────────────
  claude-opus-4          $11093.89  (98.6%)
  claude-haiku-4          $103.38  (0.9%)
  claude-sonnet-4          $51.16  (0.5%)

By Project
────────────────────────────────────────
  razzle dazzle          $3858.16  116 sessions
  spizzle spazzle        $2339.66  60 sessions
  shimmer shazzle        $1159.83  27 sessions
```

### Options

| Flag | Description |
|---|---|
| `--daily` | Show daily breakdown (last 14 days) |
| `--weekly` | Show weekly breakdown (last 8 weeks) |
| `--monthly` | Show monthly breakdown |
| `--project <name>` | Filter to a specific project |
| `--from <YYYY-MM-DD>` | Start date |
| `--to <YYYY-MM-DD>` | End date |
| `--json` | Output raw JSON (for piping) |
| `--path <dir>` | Custom path to Claude projects dir |

### Examples

```bash
# Monthly cost breakdown
claude-token-parser --monthly

# Filter to one project with daily view
claude-token-parser --project hello --daily

# Date range
claude-token-parser --from 2026-02-01 --to 2026-02-14

# Pipe JSON to jq
claude-token-parser --json | jq '.byModel'
```

## Library

```ts
import { readAll, summarize } from "claude-token-parser";
import { homedir } from "node:os";
import { join } from "node:path";

const dataPath = join(homedir(), ".claude", "projects");
const lines = await readAll(dataPath);
const summary = summarize(lines);

console.log(`Total cost: $${summary.totalCost.toFixed(2)}`);
console.log(`Sessions: ${summary.sessionCount}`);

for (const model of summary.byModel) {
  console.log(`${model.model}: $${model.cost.toFixed(2)}`);
}
```

### API

#### Reading

- **`readAll(dataPath)`** — Read all JSONL files under a directory, returns `ParsedLine[]`
- **`readFile(filePath, project, isSubagent, byteOffset?)`** — Read a single JSONL file
- **`readIncremental(dataPath, offsets)`** — Incremental read, only processes new bytes since last offsets

#### Aggregation

- **`summarize(lines, range?)`** — Full summary with all breakdowns
- **`groupByDay(lines, range?)`** — Daily aggregation
- **`groupByWeek(lines, range?)`** — Weekly aggregation (ISO weeks, Monday start)
- **`groupByMonth(lines, range?)`** — Monthly aggregation
- **`groupBySession(lines)`** — Per-session breakdown
- **`groupByProject(lines)`** — Per-project breakdown (sorted by cost descending)
- **`groupByModel(lines)`** — Per-model breakdown (sorted by cost descending)

#### Cost

- **`calculateCost(model, tokens)`** — Calculate cost for a set of token counts
- **`normalizeModelName(model)`** — Normalize model IDs (e.g. `claude-opus-4-6-20250514` → `claude-opus-4`)
- **`getPricingTable()`** — Get the pricing table

### Pricing

| Model | Input | Output | Cache Write | Cache Read |
|---|---|---|---|---|
| claude-opus-4 | $15.00/M | $75.00/M | $18.75/M | $1.50/M |
| claude-sonnet-4 | $3.00/M | $15.00/M | $3.75/M | $0.30/M |
| claude-haiku-4 | $0.80/M | $4.00/M | $1.00/M | $0.08/M |

## How it works

Claude Code stores session logs as JSONL files in `~/.claude/projects/`. Each line contains token usage metadata from API responses. This package:

1. Scans all project directories and JSONL files (including subagent logs)
2. Extracts assistant messages with token usage data
3. Calculates costs using current Anthropic pricing
4. Aggregates by time period, project, model, and session

## License

MIT
