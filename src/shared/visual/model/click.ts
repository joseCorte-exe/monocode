/**
 * Whether a request from a visual (open a file, fill the composer, open a
 * link) came from a real click in it. The visual's code may carry text from
 * untrusted data, so the app checks that the window was just activated, not
 * by the app's own keys or clicks, and that the visual is on screen in a
 * focused window. This is a filter, not proof.
 */

/** A key or click in the app itself within this window explains the
 * activation, so it doesn't count as a click in the visual. */
export const HOST_INPUT_WINDOW_MS = 5000;

export type ClickInput = {
  /** The app window has a fresh user activation (a click landed somewhere). */
  userActivation: boolean;
  lastHostInputAt: number;
  now: number;
  windowFocused: boolean;
  visible: boolean;
};

export function clickFromVisual(input: ClickInput): boolean {
  return (
    input.windowFocused &&
    input.visible &&
    input.userActivation &&
    input.now - input.lastHostInputAt >= HOST_INPUT_WINDOW_MS
  );
}
