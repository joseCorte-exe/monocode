import type { HarnessId } from "../../../features/sessions/model/session";
import {
  buildVisualInstruction,
  visualTurnNeed,
  visualUpdateLine,
} from "../../../shared/visual/model/instructions";
import {
  loadVisualLevel,
  type VisualLevel,
} from "../../../shared/visual/model/preference";
import { takesAppInstructions } from "./registry";

/**
 * The drawing instruction for an adapter that starts its agent with it
 * (`takesAppInstructions`). It runs at every start, including the ones a
 * compaction or a resume after a restart causes. Null when visuals are off.
 */
export function sessionVisualInstruction(): string | null {
  return buildVisualInstruction(loadVisualLevel());
}

/** The level each session last heard, so a change is announced once. */
const sentLevels = new Map<string, VisualLevel>();

/**
 * What a user turn adds about visuals, if anything: the whole instruction on
 * the first turn of an agent that didn't get it at start, or when visuals
 * come back on; a one-line update after any other change of level.
 */
export function visualTurnContext(input: {
  sessionId: string;
  harness: HarnessId;
  firstTurn: boolean;
}): string | null {
  const level = loadVisualLevel();
  const need = visualTurnNeed({
    takesAtSpawn: takesAppInstructions(input.harness),
    firstTurn: input.firstTurn,
    level,
    lastSentLevel: sentLevels.get(input.sessionId),
  });
  sentLevels.set(input.sessionId, level);
  if (need === "update") return visualUpdateLine(level);
  if (need === "instruction") return buildVisualInstruction(level);
  return null;
}
