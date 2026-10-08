import { convertFileSrc } from "@tauri-apps/api/core";

/** URL of the sandboxed frame, served by the `monocode-viz` scheme. */
export function visualFrameUrl(): string {
  return convertFileSrc("frame.html", "monocode-viz");
}
