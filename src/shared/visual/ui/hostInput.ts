import type { ClickInput } from "../model/click";

/**
 * When the user last pressed a key or clicked in the app itself (not inside
 * a visual's frame, whose events never reach this window).
 */
let lastHostInputAt = 0;
let installed = false;

function mark() {
  lastHostInputAt = Date.now();
}

export function lastAppInputAt(): number {
  if (!installed && typeof window !== "undefined") {
    installed = true;
    window.addEventListener("pointerdown", mark, true);
    window.addEventListener("keydown", mark, true);
  }
  return lastHostInputAt;
}

/** A click or key press just happened somewhere in the window, frames too;
 * false where the browser can't tell. */
function windowUserActivation(): boolean {
  const activation = (
    navigator as Navigator & { userActivation?: { isActive: boolean } }
  ).userActivation;
  return activation?.isActive ?? false;
}

/** What the app can tell, right now, about the click behind a request from
 * a visual that is (or isn't) on screen. */
export function currentClick(visible: boolean): ClickInput {
  return {
    userActivation: windowUserActivation(),
    lastHostInputAt: lastAppInputAt(),
    now: Date.now(),
    windowFocused: document.hasFocus(),
    visible,
  };
}
