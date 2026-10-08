import { describe, expect, it } from "vitest";
import { clickFromVisual, type ClickInput } from "./click";

const base: ClickInput = {
  userActivation: true,
  lastHostInputAt: 0,
  now: 100_000,
  windowFocused: true,
  visible: true,
};

describe("clickFromVisual", () => {
  it("needs a fresh click in the visual, on screen, in a focused window", () => {
    expect(clickFromVisual(base)).toBe(true);
    expect(clickFromVisual({ ...base, userActivation: false })).toBe(false);
    expect(clickFromVisual({ ...base, lastHostInputAt: 99_000 })).toBe(false);
    expect(clickFromVisual({ ...base, visible: false })).toBe(false);
    expect(clickFromVisual({ ...base, windowFocused: false })).toBe(false);
  });
});
