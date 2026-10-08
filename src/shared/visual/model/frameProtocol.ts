/**
 * Messages between the app and the sandboxed frame. Everything the frame
 * sends is untrusted: the agent wrote the code that runs there, possibly from
 * data it read. `parseFrameMessage` accepts only the known shapes.
 */

export const ASK_TEXT_LIMIT = 2000;

export type VisualTheme = {
  scheme: "dark" | "light";
  /** Colors as `rgb(r, g, b)`. */
  fg: string;
  bg: string;
  accent: string;
  font: string;
  mono: string;
};

export type HostMessage =
  | {
      bx: 1;
      type: "render";
      html: string;
      theme: VisualTheme;
      reducedMotion: boolean;
      animate: boolean;
    }
  | { bx: 1; type: "theme"; theme: VisualTheme; reducedMotion: boolean };

export type FrameMessage =
  | { type: "size"; height: number }
  | { type: "ready" }
  | { type: "error"; message: string; line?: number }
  | { type: "open"; path: string; line?: number }
  | { type: "ask"; text: string }
  | { type: "link"; url: string }
  | { type: "escape" };

function positiveInt(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : undefined;
}

export function parseFrameMessage(data: unknown): FrameMessage | null {
  if (!data || typeof data !== "object") return null;
  const message = data as Record<string, unknown>;
  if (message.bx !== 1) return null;
  switch (message.type) {
    case "size": {
      const height = message.height;
      if (typeof height !== "number" || !Number.isFinite(height)) return null;
      return {
        type: "size",
        height: Math.max(0, Math.min(20000, Math.ceil(height))),
      };
    }
    case "ready":
      return { type: "ready" };
    case "error": {
      const text =
        typeof message.message === "string" && message.message.trim()
          ? message.message.slice(0, 500)
          : "Unknown error";
      const line = positiveInt(message.line);
      return line
        ? { type: "error", message: text, line }
        : { type: "error", message: text };
    }
    case "open": {
      const path = message.path;
      if (typeof path !== "string" || !path.trim() || path.length > 1000)
        return null;
      const line = positiveInt(message.line);
      return line ? { type: "open", path, line } : { type: "open", path };
    }
    case "ask": {
      const text = typeof message.text === "string" ? message.text.trim() : "";
      if (!text) return null;
      return { type: "ask", text: text.slice(0, ASK_TEXT_LIMIT) };
    }
    case "link": {
      if (typeof message.url !== "string") return null;
      try {
        const url = new URL(message.url);
        return url.protocol === "https:"
          ? { type: "link", url: url.href }
          : null;
      } catch {
        return null;
      }
    }
    case "escape":
      return { type: "escape" };
    default:
      return null;
  }
}
