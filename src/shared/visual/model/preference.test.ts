// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import {
  loadVisualLevel,
  markVisualAsText,
  noteUnaskedVisual,
  noteVisualSwitchedToText,
  pushVisualHistory,
  saveVisualLevel,
  saveVisualNudged,
  shouldNudge,
  VISUAL_LEVEL_DEFAULT,
} from "./preference";

beforeEach(() => localStorage.clear());

describe("visual level", () => {
  it("defaults to helps and round-trips", () => {
    expect(loadVisualLevel()).toBe(VISUAL_LEVEL_DEFAULT);
    saveVisualLevel("asked");
    expect(loadVisualLevel()).toBe("asked");
  });
});

describe("suggestion after repeated switches to text", () => {
  it("keeps the last five visuals", () => {
    let history = pushVisualHistory([], "a");
    for (const hash of ["b", "c", "d", "e", "f"]) {
      history = pushVisualHistory(history, hash);
    }
    expect(history.map((entry) => entry.hash)).toEqual([
      "b",
      "c",
      "d",
      "e",
      "f",
    ]);
  });

  it("nudges after 3 of the last 5 went to text, once", () => {
    let history = ["a", "b", "c"].reduce(
      (list, hash) => markVisualAsText(list, hash),
      pushVisualHistory([], "z"),
    );
    expect(shouldNudge(history, false)).toBe(true);
    expect(shouldNudge(history, true)).toBe(false);
    history = markVisualAsText([], "a");
    expect(shouldNudge(history, false)).toBe(false);
  });

  it("does not count visuals the user asked for", () => {
    noteUnaskedVisual("a");
    expect(noteVisualSwitchedToText("x", true)).toBe(false);
    expect(noteVisualSwitchedToText("y", true)).toBe(false);
    expect(noteVisualSwitchedToText("a", false)).toBe(false);
    expect(noteVisualSwitchedToText("b", false)).toBe(false);
    expect(noteVisualSwitchedToText("c", false)).toBe(true);
    saveVisualNudged();
    expect(noteVisualSwitchedToText("d", false)).toBe(false);
  });
});
