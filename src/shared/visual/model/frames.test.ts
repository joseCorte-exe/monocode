import { describe, expect, it } from "vitest";
import {
  cacheVisualHeight,
  cachedVisualHeight,
  createFrameRegistry,
} from "./frames";

describe("height cache", () => {
  it("remembers positive heights only", () => {
    cacheVisualHeight("a", 312);
    cacheVisualHeight("b", 0);
    expect(cachedVisualHeight("a")).toBe(312);
    expect(cachedVisualHeight("b")).toBeUndefined();
  });
});

describe("frame registry", () => {
  it("evicts the least recently used entry past the limit", () => {
    const registry = createFrameRegistry(2);
    const evicted: string[] = [];
    registry.touch("a", () => evicted.push("a"));
    registry.touch("b", () => evicted.push("b"));
    registry.touch("a", () => evicted.push("a"));
    registry.touch("c", () => evicted.push("c"));
    expect(evicted).toEqual(["b"]);
    expect(registry.size()).toBe(2);
  });

  it("forgets released entries", () => {
    const registry = createFrameRegistry(2);
    const evicted: string[] = [];
    registry.touch("a", () => evicted.push("a"));
    registry.touch("b", () => evicted.push("b"));
    registry.release("a");
    registry.touch("c", () => evicted.push("c"));
    expect(evicted).toEqual([]);
  });
});
