/**
 * When the agent draws (the level the user picks in Settings), and the local
 * memory behind the one-time "draw only when I ask?" suggestion. Nothing here
 * leaves the machine.
 */

export type VisualLevel = "off" | "asked" | "helps";

export const VISUAL_LEVEL_DEFAULT: VisualLevel = "helps";
export const VISUAL_LEVEL_CHANGE_EVENT = "monocode:visuals-change";

const LEVEL_KEY = "monocode.visuals";
const HISTORY_KEY = "monocode.visuals.history";
const NUDGED_KEY = "monocode.visuals.nudged";

const HISTORY_LIMIT = 5;
const NUDGE_AFTER = 3;

export function isVisualLevel(value: unknown): value is VisualLevel {
  return value === "off" || value === "asked" || value === "helps";
}

export function loadVisualLevel(): VisualLevel {
  try {
    const raw = localStorage.getItem(LEVEL_KEY);
    return isVisualLevel(raw) ? raw : VISUAL_LEVEL_DEFAULT;
  } catch {
    return VISUAL_LEVEL_DEFAULT;
  }
}

export function saveVisualLevel(value: VisualLevel) {
  const next = isVisualLevel(value) ? value : VISUAL_LEVEL_DEFAULT;
  try {
    localStorage.setItem(LEVEL_KEY, next);
  } catch {
    // private mode / quota
  }
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<VisualLevel>(VISUAL_LEVEL_CHANGE_EVENT, { detail: next }),
  );
}

export function subscribeVisualLevel(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(VISUAL_LEVEL_CHANGE_EVENT, onStoreChange);
  return () =>
    window.removeEventListener(VISUAL_LEVEL_CHANGE_EVENT, onStoreChange);
}

/** One unasked visual the user saw, and whether they switched it to text. */
export type VisualHistoryEntry = { hash: string; text: boolean };

export function pushVisualHistory(
  history: VisualHistoryEntry[],
  hash: string,
): VisualHistoryEntry[] {
  if (history.some((entry) => entry.hash === hash)) return history;
  return [...history, { hash, text: false }].slice(-HISTORY_LIMIT);
}

export function markVisualAsText(
  history: VisualHistoryEntry[],
  hash: string,
): VisualHistoryEntry[] {
  const seen = pushVisualHistory(history, hash);
  return seen.map((entry) =>
    entry.hash === hash ? { ...entry, text: true } : entry,
  );
}

export function shouldNudge(
  history: VisualHistoryEntry[],
  nudged: boolean,
): boolean {
  if (nudged) return false;
  return history.filter((entry) => entry.text).length >= NUDGE_AFTER;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // private mode / quota
  }
}

function loadHistory(): VisualHistoryEntry[] {
  const raw = readJson<unknown>(HISTORY_KEY, []);
  return Array.isArray(raw)
    ? raw.filter(
        (entry): entry is VisualHistoryEntry =>
          !!entry &&
          typeof entry.hash === "string" &&
          typeof entry.text === "boolean",
      )
    : [];
}

/** Notes that an unasked visual was shown. */
export function noteUnaskedVisual(hash: string) {
  writeJson(HISTORY_KEY, pushVisualHistory(loadHistory(), hash));
}

/**
 * Notes that the user switched a visual to text. Returns true when this is
 * the moment to show the suggestion under that visual.
 */
export function noteVisualSwitchedToText(
  hash: string,
  asked: boolean,
): boolean {
  if (asked) return false;
  const history = markVisualAsText(loadHistory(), hash);
  writeJson(HISTORY_KEY, history);
  return shouldNudge(history, loadVisualNudged());
}

export function loadVisualNudged(): boolean {
  try {
    return localStorage.getItem(NUDGED_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveVisualNudged() {
  try {
    localStorage.setItem(NUDGED_KEY, "1");
  } catch {
    // private mode / quota
  }
}
