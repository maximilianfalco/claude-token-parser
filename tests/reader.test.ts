import { describe, it, expect } from "vitest";
import { deriveProjectName } from "../src/reader.js";

describe("deriveProjectName", () => {
  it("extracts project from macOS-style path", () => {
    expect(deriveProjectName("-Users-alice-Desktop-Code-my-app")).toBe("my-app");
  });

  it("extracts project from Linux-style path", () => {
    expect(deriveProjectName("-home-bob-projects-foo")).toBe("foo");
  });

  it("handles nested project paths", () => {
    expect(deriveProjectName("-Users-alice-Desktop-Code-readme-markdown")).toBe("readme-markdown");
  });

  it("strips common intermediate dirs like dev, repos, workspace", () => {
    expect(deriveProjectName("-Users-alice-dev-my-app")).toBe("my-app");
    expect(deriveProjectName("-Users-alice-repos-my-app")).toBe("my-app");
    expect(deriveProjectName("-Users-alice-workspace-my-app")).toBe("my-app");
    expect(deriveProjectName("-home-bob-src-my-app")).toBe("my-app");
  });

  it("handles multiple noise directories", () => {
    expect(deriveProjectName("-Users-alice-Desktop-Code-readme")).toBe("readme");
    expect(deriveProjectName("-Users-alice-Documents-projects-foo")).toBe("foo");
  });

  it("falls back to full joined name for unknown patterns", () => {
    expect(deriveProjectName("-some-weird-path-thing")).toBe("some-weird-path-thing");
  });

  it("returns 'unknown' for empty input", () => {
    expect(deriveProjectName("")).toBe("unknown");
    expect(deriveProjectName("-")).toBe("unknown");
  });

  it("handles path with just home and username", () => {
    expect(deriveProjectName("-Users-alice")).toBe("alice");
  });
});
