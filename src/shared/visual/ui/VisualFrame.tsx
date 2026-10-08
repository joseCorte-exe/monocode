import { useEffect, useId, useRef, useState } from "react";
import { useColorScheme } from "../../hooks/useColorScheme";
import { visualFrameUrl } from "../../../platform/tauri/visual";
import {
  parseFrameMessage,
  type FrameMessage,
  type HostMessage,
  type VisualTheme,
} from "../model/frameProtocol";
import {
  cacheVisualHeight,
  cachedVisualHeight,
  liveFrames,
} from "../model/frames";

const READY_TIMEOUT_MS = 8000;
/** Messages from the frame that the block, not the frame, handles. */
export type FrameRequest = Exclude<
  FrameMessage,
  { type: "size" } | { type: "ready" } | { type: "error" }
>;

/** Why a frame didn't draw: it threw, or it never said it was ready. */
export type FrameError = {
  stage: "js" | "timeout";
  message: string;
  line?: number;
};

/** Height changes smaller than this are applied without animation. */
const HEIGHT_ANIMATION_THRESHOLD = 8;

function resolveColor(cssVar: string): string {
  const probe = document.createElement("span");
  probe.style.color = `var(${cssVar})`;
  probe.style.display = "none";
  document.body.appendChild(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color;
}

export function readVisualTheme(scheme: "dark" | "light"): VisualTheme {
  const root = getComputedStyle(document.documentElement);
  return {
    scheme,
    fg: resolveColor("--color-content"),
    bg: resolveColor("--color-background-base"),
    accent: resolveColor("--color-accent"),
    font: root.getPropertyValue("--font-sans").trim(),
    mono: root.getPropertyValue("--font-mono").trim(),
  };
}

/** The message that hands a frame its visual, in the app's theme right now. */
export function renderMessage(
  html: string,
  scheme: "dark" | "light",
  animate: boolean,
): HostMessage {
  return {
    bx: 1,
    type: "render",
    html,
    theme: readVisualTheme(scheme),
    reducedMotion: prefersReducedMotion(),
    animate,
  };
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

/**
 * Mounts the sandboxed frame only near the viewport (and in at most six
 * places at once), sends it the HTML and the theme, and reports what it says
 * back. Unmounting keeps the measured height, so nothing jumps.
 */
export function VisualFrame({
  hash,
  html,
  title,
  declaredHeight,
  animate,
  onReady,
  onError,
  onMessage,
  onVisible,
}: {
  hash: string;
  html: string;
  title: string;
  declaredHeight: number;
  animate: boolean;
  onReady: () => void;
  onError: (error: FrameError) => void;
  onMessage: (message: FrameRequest) => void;
  /** On screen and the window focused, or not. */
  onVisible?: (visible: boolean) => void;
}) {
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const scheme = useColorScheme();
  const [mounted, setMounted] = useState(false);
  const [height, setHeight] = useState(
    () => cachedVisualHeight(hash) ?? declaredHeight,
  );
  const [animateHeight, setAnimateHeight] = useState(false);
  const heightRef = useRef(height);
  const callbacks = useRef({ onReady, onError, onMessage, onVisible });
  callbacks.current = { onReady, onError, onMessage, onVisible };
  const rendered = useRef(false);

  useEffect(() => {
    const node = box.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setMounted(true);
      return;
    }
    const near = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setMounted(true);
      },
      { rootMargin: "100% 0px" },
    );
    const far = new IntersectionObserver(
      ([entry]) => {
        if (entry && !entry.isIntersecting) setMounted(false);
      },
      { rootMargin: "200% 0px" },
    );
    near.observe(node);
    far.observe(node);
    return () => {
      near.disconnect();
      far.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!mounted) return;
    liveFrames.touch(id, () => setMounted(false));
    return () => {
      liveFrames.release(id);
      rendered.current = false;
    };
  }, [id, mounted]);

  useEffect(() => {
    if (!mounted) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onWindowMessage = (event: MessageEvent) => {
      if (!frame.current || event.source !== frame.current.contentWindow)
        return;
      const message = parseFrameMessage(event.data);
      if (!message) return;
      switch (message.type) {
        case "size":
          setAnimateHeight(
            !prefersReducedMotion() &&
              rendered.current &&
              Math.abs(message.height - heightRef.current) >
                HEIGHT_ANIMATION_THRESHOLD,
          );
          heightRef.current = message.height;
          setHeight(message.height);
          cacheVisualHeight(hash, message.height);
          return;
        case "ready":
          if (timer) clearTimeout(timer);
          rendered.current = true;
          callbacks.current.onReady();
          return;
        case "error":
          if (timer) clearTimeout(timer);
          callbacks.current.onError({
            stage: "js",
            message: message.message,
            line: message.line,
          });
          return;
        default:
          callbacks.current.onMessage(message);
      }
    };
    window.addEventListener("message", onWindowMessage);
    const node = frame.current;
    const send = () => {
      const target = node?.contentWindow;
      if (!target) return;
      target.postMessage(renderMessage(html, scheme, animate), "*");
      timer = setTimeout(
        () =>
          callbacks.current.onError({
            stage: "timeout",
            message: "The visual did not finish drawing in 8 seconds.",
          }),
        READY_TIMEOUT_MS,
      );
    };
    node?.addEventListener("load", send);
    return () => {
      window.removeEventListener("message", onWindowMessage);
      node?.removeEventListener("load", send);
      if (timer) clearTimeout(timer);
    };
    // The frame renders once per mount; theme changes travel separately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, html, hash]);

  useEffect(() => {
    if (!mounted) return;
    const node = box.current;
    let onScreen = false;
    let last: boolean | null = null;
    const report = () => {
      const visible = onScreen && document.hasFocus();
      if (visible === last) return;
      last = visible;
      callbacks.current.onVisible?.(visible);
    };
    const seen =
      node && typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(([entry]) => {
            onScreen = !!entry?.isIntersecting;
            report();
          })
        : null;
    if (node) seen?.observe(node);
    window.addEventListener("focus", report);
    window.addEventListener("blur", report);
    return () => {
      seen?.disconnect();
      window.removeEventListener("focus", report);
      window.removeEventListener("blur", report);
    };
  }, [mounted]);

  useEffect(() => {
    if (!mounted || !rendered.current) return;
    const message: HostMessage = {
      bx: 1,
      type: "theme",
      theme: readVisualTheme(scheme),
      reducedMotion: prefersReducedMotion(),
    };
    frame.current?.contentWindow?.postMessage(message, "*");
  }, [scheme, mounted]);

  return (
    <div
      ref={box}
      className="visual-frame-box"
      data-animate-height={animateHeight ? "" : undefined}
      style={{ height }}
    >
      {mounted ? (
        <iframe
          ref={frame}
          className="visual-frame"
          sandbox="allow-scripts"
          src={visualFrameUrl()}
          title={title}
          style={{ height, colorScheme: scheme }}
        />
      ) : null}
    </div>
  );
}
