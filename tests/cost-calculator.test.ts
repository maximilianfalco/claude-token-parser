import { describe, it, expect } from "vitest";
import { normalizeModelName, calculateCost, getPricingTable } from "../src/cost-calculator.js";

describe("normalizeModelName", () => {
  it("returns exact match for known models", () => {
    expect(normalizeModelName("claude-opus-4")).toBe("claude-opus-4");
    expect(normalizeModelName("claude-sonnet-4")).toBe("claude-sonnet-4");
    expect(normalizeModelName("claude-haiku-4")).toBe("claude-haiku-4");
  });

  it("strips version suffixes", () => {
    expect(normalizeModelName("claude-opus-4-6-20250514")).toBe("claude-opus-4");
    expect(normalizeModelName("claude-sonnet-4-6-20250514")).toBe("claude-sonnet-4");
    expect(normalizeModelName("claude-haiku-4-5-20251001")).toBe("claude-haiku-4");
  });

  it("resolves legacy aliases", () => {
    expect(normalizeModelName("claude-3-5-sonnet-20241022")).toBe("claude-sonnet-4");
    expect(normalizeModelName("claude-3-5-haiku-20241022")).toBe("claude-haiku-4");
    expect(normalizeModelName("claude-3-opus-20240229")).toBe("claude-opus-4");
  });

  it("returns 'unknown' for synthetic or empty models", () => {
    expect(normalizeModelName("<synthetic>")).toBe("unknown");
    expect(normalizeModelName("")).toBe("unknown");
  });

  it("passes through unrecognized models as-is", () => {
    expect(normalizeModelName("gpt-4o")).toBe("gpt-4o");
  });
});

describe("calculateCost", () => {
  it("calculates opus cost correctly", () => {
    const cost = calculateCost("claude-opus-4", {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    });
    expect(cost).toBeCloseTo(15.0 + 75.0);
  });

  it("calculates sonnet cost correctly", () => {
    const cost = calculateCost("claude-sonnet-4", {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    });
    expect(cost).toBeCloseTo(3.0 + 15.0);
  });

  it("calculates haiku cost correctly", () => {
    const cost = calculateCost("claude-haiku-4", {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    });
    expect(cost).toBeCloseTo(0.8 + 4.0);
  });

  it("includes cache token costs", () => {
    const cost = calculateCost("claude-opus-4", {
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationTokens: 1_000_000,
      cacheReadTokens: 1_000_000,
    });
    expect(cost).toBeCloseTo(18.75 + 1.5);
  });

  it("defaults to opus pricing for unknown models", () => {
    const cost = calculateCost("some-unknown-model", {
      inputTokens: 1_000_000,
      outputTokens: 0,
    });
    expect(cost).toBeCloseTo(15.0);
  });

  it("handles zero tokens", () => {
    const cost = calculateCost("claude-opus-4", {
      inputTokens: 0,
      outputTokens: 0,
    });
    expect(cost).toBe(0);
  });
});

describe("getPricingTable", () => {
  it("returns a copy with all three models", () => {
    const table = getPricingTable();
    expect(Object.keys(table)).toHaveLength(3);
    expect(table).toHaveProperty("claude-opus-4");
    expect(table).toHaveProperty("claude-sonnet-4");
    expect(table).toHaveProperty("claude-haiku-4");
  });
});
