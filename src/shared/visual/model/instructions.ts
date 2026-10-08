/**
 * The instruction that teaches an agent to draw ```visual blocks, filled for
 * the user's level. Adapters that take the app's instructions at spawn get it
 * there; the others get it appended to their first turn. A level change
 * mid-session travels as one line.
 */

import template from "../../../instructions/visuals.md?raw";
import type { VisualLevel } from "./preference";

export function levelLine(level: VisualLevel): string {
  switch (level) {
    case "helps":
      return "draw when it helps, following the rules below.";
    case "asked":
      return "draw only when the user explicitly asks for a visual, chart or diagram.";
    case "off":
      return "do not draw visuals; answer in text only.";
  }
}

/** The whole instruction for `level`; null when visuals are off. */
export function buildVisualInstruction(level: VisualLevel): string | null {
  if (level === "off") return null;
  return template.split("{{level}}").join(levelLine(level)).trim();
}

export function visualUpdateLine(level: VisualLevel): string {
  return `<monocode_visuals_update>Visuals: ${levelLine(level)}</monocode_visuals_update>`;
}

/** What a turn has to tell the agent about visuals. */
export type VisualTurnNeed = "none" | "update" | "instruction";

/**
 * Decided once per turn. `firstTurn` is a turn with no provider session yet;
 * `lastSentLevel` is what this session last heard, undefined when unknown
 * (e.g. after a restart).
 */
export function visualTurnNeed(options: {
  /** The agent's adapter gives it the instruction at spawn. */
  takesAtSpawn: boolean;
  firstTurn: boolean;
  level: VisualLevel;
  lastSentLevel: VisualLevel | undefined;
}): VisualTurnNeed {
  const { takesAtSpawn, firstTurn, level, lastSentLevel } = options;
  if (firstTurn)
    return takesAtSpawn || level === "off" ? "none" : "instruction";
  if (lastSentLevel === undefined || lastSentLevel === level) return "none";
  // Coming back from off, the agent never had the rules.
  return lastSentLevel === "off" ? "instruction" : "update";
}
