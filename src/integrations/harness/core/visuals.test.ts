import { describe, expect, it, vi } from "vitest";
import type { VisualLevel } from "../../../shared/visual/model/preference";

let level: VisualLevel = "helps";

vi.mock("./registry", () => ({
  takesAppInstructions: (id: string) => id === "claude",
}));
vi.mock("../../../shared/visual/model/preference", () => ({
  loadVisualLevel: () => level,
}));

const { visualTurnContext } = await import("./visuals");

describe("visualTurnContext", () => {
  it("gives agents without a start channel the rules on their first turn", () => {
    level = "helps";
    const turn = (firstTurn: boolean) =>
      visualTurnContext({
        sessionId: "cursor-1",
        harness: "cursor",
        firstTurn,
      });
    expect(turn(true)).toContain("<monocode_visuals>");
    expect(turn(false)).toBeNull();
  });

  it("sends the rules when a chat started with visuals off turns them on", () => {
    const turn = (firstTurn: boolean) =>
      visualTurnContext({
        sessionId: "claude-1",
        harness: "claude",
        firstTurn,
      });
    level = "off";
    expect(turn(true)).toBeNull();
    level = "helps";
    expect(turn(false)).toContain("<monocode_visuals>");
    expect(turn(false)).toBeNull();
    level = "asked";
    expect(turn(false)).toContain("<monocode_visuals_update>");
  });
});
