/**
 * The ```visual block an agent writes in its answer: a header of `key: value`
 * lines, an optional `<text>` version in markdown, then an HTML fragment that
 * runs in the sandboxed frame. Parsing works on partial text too, so the
 * header shows while the block is still streaming.
 */

export const VISUAL_LANGUAGE = "visual";
export const VISUAL_HEIGHT_DEFAULT = 280;
export const VISUAL_HEIGHT_MIN = 120;
export const VISUAL_HEIGHT_MAX = 720;

export type VisualBlock = {
  title?: string;
  subtitle?: string;
  height: number;
  /** The user asked for this visual (`asked: yes`). */
  asked: boolean;
  /** Markdown version of the visual, between `<text>` and `</text>`. */
  text?: string;
  html: string;
  /** Stable id of the block's source, used for the height cache. */
  hash: string;
};

const HEADER_LINE = /^(title|subtitle|height|asked):\s*(.*)$/i;

export function clampVisualHeight(value: number): number {
  if (!Number.isFinite(value)) return VISUAL_HEIGHT_DEFAULT;
  return Math.min(
    VISUAL_HEIGHT_MAX,
    Math.max(VISUAL_HEIGHT_MIN, Math.round(value)),
  );
}

/** FNV-1a, 32 bits, in base 36. */
export function visualHash(code: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < code.length; i++) {
    hash ^= code.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

export function parseVisualBlock(code: string): VisualBlock {
  const source = code.replace(/\r\n/g, "\n");
  const lines = source.split("\n");
  let index = 0;
  while (index < lines.length && lines[index]!.trim() === "") index++;
  const header: Record<string, string> = {};
  for (; index < lines.length; index++) {
    const match = HEADER_LINE.exec(lines[index]!.trim());
    if (!match) break;
    header[match[1]!.toLowerCase()] = match[2]!.trim();
  }
  const rest = lines.slice(index).join("\n").trimStart();
  let text: string | undefined;
  let html = rest;
  if (rest.toLowerCase().startsWith("<text>")) {
    const close = rest.toLowerCase().indexOf("</text>");
    if (close < 0) {
      text = rest.slice("<text>".length).trim();
      html = "";
    } else {
      text = rest.slice("<text>".length, close).trim();
      html = rest.slice(close + "</text>".length).trim();
    }
  }
  const height = header.height
    ? clampVisualHeight(Number.parseFloat(header.height))
    : VISUAL_HEIGHT_DEFAULT;
  return {
    ...(header.title ? { title: header.title } : {}),
    ...(header.subtitle ? { subtitle: header.subtitle } : {}),
    height,
    asked: header.asked?.toLowerCase() === "yes",
    ...(text ? { text } : {}),
    html,
    hash: visualHash(source.trim()),
  };
}
