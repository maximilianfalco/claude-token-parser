import { describe, it, expect } from "vitest";
import { groupByDay, groupByWeek, groupByMonth, groupByProject, groupByModel, groupBySession, summarize } from "../src/aggregator.js";
import type { ParsedLine } from "../src/reader.js";

function makeLine(overrides: Partial<ParsedLine> = {}): ParsedLine {
  return {
    sessionId: "sess-1",
    timestamp: "2026-02-15T10:00:00Z",
    model: "claude-opus-4",
    usage: {
      input_tokens: 1000,
      output_tokens: 500,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
      service_tier: "default",
    },
    project: "test-project",
    isSubagent: false,
    ...overrides,
  };
}

describe("groupByDay", () => {
  it("groups lines by date", () => {
    const lines = [
      makeLine({ timestamp: "2026-02-15T10:00:00Z" }),
      makeLine({ timestamp: "2026-02-15T14:00:00Z" }),
      makeLine({ timestamp: "2026-02-16T10:00:00Z" }),
    ];
    const result = groupByDay(lines);
    expect(result).toHaveLength(2);
    expect(result[0].date).toBe("2026-02-15");
    expect(result[0].inputTokens).toBe(2000);
    expect(result[1].date).toBe("2026-02-16");
    expect(result[1].inputTokens).toBe(1000);
  });

  it("counts unique sessions per day", () => {
    const lines = [
      makeLine({ sessionId: "a", timestamp: "2026-02-15T10:00:00Z" }),
      makeLine({ sessionId: "a", timestamp: "2026-02-15T11:00:00Z" }),
      makeLine({ sessionId: "b", timestamp: "2026-02-15T12:00:00Z" }),
    ];
    const result = groupByDay(lines);
    expect(result[0].sessionCount).toBe(2);
  });

  it("filters by date range", () => {
    const lines = [
      makeLine({ timestamp: "2026-02-14T10:00:00Z" }),
      makeLine({ timestamp: "2026-02-15T10:00:00Z" }),
      makeLine({ timestamp: "2026-02-16T10:00:00Z" }),
    ];
    const result = groupByDay(lines, {
      from: new Date("2026-02-15"),
      to: new Date("2026-02-15T23:59:59Z"),
    });
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe("2026-02-15");
  });

  it("returns empty for no lines", () => {
    expect(groupByDay([])).toHaveLength(0);
  });
});

describe("groupByWeek", () => {
  it("groups by ISO week start (Monday)", () => {
    const lines = [
      makeLine({ timestamp: "2026-02-16T10:00:00Z" }), // Monday
      makeLine({ timestamp: "2026-02-18T10:00:00Z" }), // Wednesday
      makeLine({ timestamp: "2026-02-23T10:00:00Z" }), // next Monday
    ];
    const result = groupByWeek(lines);
    expect(result).toHaveLength(2);
    expect(result[0].weekStart).toBe("2026-02-16");
    expect(result[0].inputTokens).toBe(2000);
    expect(result[1].weekStart).toBe("2026-02-23");
  });
});

describe("groupByMonth", () => {
  it("groups by month", () => {
    const lines = [
      makeLine({ timestamp: "2026-01-15T10:00:00Z" }),
      makeLine({ timestamp: "2026-02-15T10:00:00Z" }),
      makeLine({ timestamp: "2026-02-20T10:00:00Z" }),
    ];
    const result = groupByMonth(lines);
    expect(result).toHaveLength(2);
    expect(result[0].month).toBe("2026-01");
    expect(result[1].month).toBe("2026-02");
    expect(result[1].inputTokens).toBe(2000);
  });
});

describe("groupByProject", () => {
  it("groups by project name sorted by cost descending", () => {
    const lines = [
      makeLine({ project: "small" }),
      makeLine({ project: "big" }),
      makeLine({ project: "big" }),
      makeLine({ project: "big" }),
    ];
    const result = groupByProject(lines);
    expect(result[0].projectName).toBe("big");
    expect(result[1].projectName).toBe("small");
  });
});

describe("groupByModel", () => {
  it("groups by normalized model name", () => {
    const lines = [
      makeLine({ model: "claude-opus-4-6-20250514" }),
      makeLine({ model: "claude-opus-4" }),
      makeLine({ model: "claude-sonnet-4" }),
    ];
    const result = groupByModel(lines);
    expect(result).toHaveLength(2);
    const opus = result.find((m) => m.model === "claude-opus-4");
    expect(opus?.inputTokens).toBe(2000);
  });
});

describe("groupBySession", () => {
  it("aggregates per session with top model", () => {
    const lines = [
      makeLine({ sessionId: "s1", model: "claude-opus-4", timestamp: "2026-02-15T10:00:00Z" }),
      makeLine({ sessionId: "s1", model: "claude-opus-4", timestamp: "2026-02-15T10:05:00Z" }),
      makeLine({ sessionId: "s1", model: "claude-sonnet-4", timestamp: "2026-02-15T10:10:00Z" }),
    ];
    const result = groupBySession(lines);
    expect(result).toHaveLength(1);
    expect(result[0].model).toBe("claude-opus-4");
    expect(result[0].messageCount).toBe(3);
    expect(result[0].startedAt).toBe("2026-02-15T10:00:00Z");
    expect(result[0].endedAt).toBe("2026-02-15T10:10:00Z");
  });
});

describe("summarize", () => {
  it("produces a full summary", () => {
    const lines = [
      makeLine({ sessionId: "a" }),
      makeLine({ sessionId: "b" }),
    ];
    const result = summarize(lines);
    expect(result.sessionCount).toBe(2);
    expect(result.totalInputTokens).toBe(2000);
    expect(result.totalOutputTokens).toBe(1000);
    expect(result.totalCost).toBeGreaterThan(0);
    expect(result.daily).toHaveLength(1);
    expect(result.byProject).toHaveLength(1);
    expect(result.byModel).toHaveLength(1);
  });
});
