import { describe, expect, it } from "vitest";
import {
  buildVisualInstruction,
  levelLine,
  visualTurnNeed,
} from "./instructions";

describe("buildVisualInstruction", () => {
  it("fills the level", () => {
    const text = buildVisualInstruction("helps")!;
    expect(text).toContain(`Visuals: ${levelLine("helps")}`);
    expect(text).not.toContain("{{level}}");
  });

  it("is null when visuals are off", () => {
    expect(buildVisualInstruction("off")).toBeNull();
  });
});

describe("visualTurnNeed", () => {
  const base = {
    takesAtSpawn: false,
    firstTurn: false,
    level: "helps" as const,
    lastSentLevel: "helps" as const,
  };

  it("sends the instruction on the first turn of agents without a spawn channel", () => {
    expect(
      visualTurnNeed({ ...base, firstTurn: true, lastSentLevel: undefined }),
    ).toBe("instruction");
    expect(
      visualTurnNeed({
        ...base,
        firstTurn: true,
        takesAtSpawn: true,
        lastSentLevel: undefined,
      }),
    ).toBe("none");
    expect(
      visualTurnNeed({
        ...base,
        firstTurn: true,
        level: "off",
        lastSentLevel: undefined,
      }),
    ).toBe("none");
  });

  it("says nothing again until the level changes", () => {
    expect(visualTurnNeed(base)).toBe("none");
    expect(visualTurnNeed({ ...base, lastSentLevel: undefined })).toBe("none");
    expect(visualTurnNeed({ ...base, level: "asked" })).toBe("update");
  });

  it("sends the whole instruction when visuals come back on", () => {
    expect(
      visualTurnNeed({ ...base, takesAtSpawn: true, lastSentLevel: "off" }),
    ).toBe("instruction");
  });
});
