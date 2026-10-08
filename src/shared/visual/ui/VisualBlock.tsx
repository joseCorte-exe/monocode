import { openUrl } from "@tauri-apps/plugin-opener";
import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { copyText } from "../../../platform/tauri/clipboard";
import { clickFromVisual } from "../model/click";
import { resolveVisualFile } from "../model/openFile";
import {
  loadVisualLevel,
  noteUnaskedVisual,
  noteVisualSwitchedToText,
  saveVisualLevel,
  saveVisualNudged,
  subscribeVisualLevel,
  VISUAL_LEVEL_DEFAULT,
} from "../model/preference";
import { parseVisualBlock } from "../model/visualBlock";
import { currentClick, lastAppInputAt } from "./hostInput";
import { VisualFrame, type FrameError, type FrameRequest } from "./VisualFrame";
import { VisualHeader, type VisualMenuItem } from "./VisualHeader";
import { useVisualHost } from "./VisualHostContext";
import { useStrip, VisualStrip } from "./VisualStrip";
import "./visual.css";

const CAPTION_DELAY_MS = 400;
const CAPTION_INTERVAL_MS = 250;

/** "View as text" choices, per visual, while the app is open. */
const textChoices = new Map<string, boolean>();

function fixPrompt(title: string, error: FrameError): string {
  if (error.stage === "timeout") {
    return `The visual "${title}" took over 8 seconds to draw. Make it lighter and send the corrected visual block.`;
  }
  const where = error.line ? ` at line ${error.line}` : "";
  return `The visual "${title}" failed with \`${error.message}\`${where}. Fix it and send the corrected visual block.`;
}

function useStreamingCaption(code: string, active: boolean): string | null {
  const [visible, setVisible] = useState(false);
  const shown = useRef({ at: 0, kb: "0.0" });
  useEffect(() => {
    if (!active) {
      setVisible(false);
      return;
    }
    const timer = setTimeout(() => setVisible(true), CAPTION_DELAY_MS);
    return () => clearTimeout(timer);
  }, [active]);
  if (!active || !visible) return null;
  const now = Date.now();
  if (now - shown.current.at >= CAPTION_INTERVAL_MS) {
    shown.current = { at: now, kb: (code.length / 1024).toFixed(1) };
  }
  return `Drawing… ${shown.current.kb} KB`;
}

/**
 * A ```visual block inside an answer: header and actions drawn by the app,
 * the visual itself in the sandboxed frame, and a text version for every
 * state where the frame is not the right thing to show.
 */
export const VisualBlock = memo(function VisualBlock({
  code,
  incomplete,
}: {
  code: string;
  incomplete: boolean;
}) {
  const host = useVisualHost();
  const level = useSyncExternalStore(
    subscribeVisualLevel,
    loadVisualLevel,
    () => VISUAL_LEVEL_DEFAULT,
  );
  const block = useMemo(() => parseVisualBlock(code), [code]);
  const title = block.title ?? "Visual";
  const textVersion = block.text ?? "";
  const streamedIn = useRef(incomplete);
  if (incomplete) streamedIn.current = true;
  const streaming = incomplete && !!host.streaming;
  const interrupted = incomplete && !host.streaming;
  const caption = useStreamingCaption(code, streaming);

  const [asText, setAsText] = useState(
    () => textChoices.get(block.hash) ?? false,
  );
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<FrameError | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [redraw, setRedraw] = useState(0);
  const [nudge, setNudge] = useState<"ask" | "done" | null>(null);
  const visibleRef = useRef(false);
  const strip = useStrip();

  // Starts listening for the app's own input before the first click.
  useEffect(() => {
    lastAppInputAt();
  }, []);

  useEffect(() => {
    if (incomplete) return;
    setReady(false);
    setError(null);
  }, [incomplete, redraw]);

  const toggleText = () => {
    const next = !asText;
    setAsText(next);
    textChoices.set(block.hash, next);
    if (next && noteVisualSwitchedToText(block.hash, block.asked)) {
      setNudge("ask");
    }
  };

  const onFrameMessage = (message: FrameRequest) => {
    if (message.type === "escape") {
      (
        document.querySelector(
          "[data-composer-box] textarea",
        ) as HTMLElement | null
      )?.focus();
      return;
    }
    // Opening a file, filling the composer and opening a link happen only
    // after a real click in the visual: its code may carry untrusted text.
    if (!clickFromVisual(currentClick(visibleRef.current))) return;
    if (message.type === "open") {
      const file = resolveVisualFile(message.path, message.line, host.cwd);
      if (file) host.onOpenFile?.(file.path, file.navigation);
    } else if (message.type === "ask") {
      host.onAsk?.(message.text);
    } else {
      // A link shows its whole address before it opens.
      const url = new URL(message.url).href;
      strip.show({
        text: `Open ${url}?`,
        title: url,
        actions: [
          { label: "Open", run: () => void openUrl(url).catch(() => {}) },
          { label: "Cancel", run: () => {} },
        ],
      });
    }
  };

  const menu: VisualMenuItem[] = [
    { label: "Copy text", run: () => void copyText(textVersion || title) },
    {
      label: showCode ? "Hide code" : "View code",
      run: () => setShowCode((value) => !value),
    },
    {
      label: "Redraw",
      run: () => {
        setShowCode(false);
        setAsText(false);
        textChoices.set(block.hash, false);
        setRedraw((value) => value + 1);
      },
    },
  ];

  const renderText = (markdown: string) =>
    host.renderText ? (
      host.renderText(markdown)
    ) : (
      <pre className="whitespace-pre-wrap text-[12px]">{markdown}</pre>
    );

  let body: ReactNode;
  if (level === "off" || (asText && !incomplete)) {
    body = textVersion ? (
      renderText(textVersion)
    ) : (
      <p className="visual-note">This visual has no text version.</p>
    );
  } else if (interrupted) {
    body = (
      <>
        <p className="visual-note">
          The answer stopped before the visual finished.
        </p>
        {textVersion ? renderText(textVersion) : null}
      </>
    );
  } else if (showCode) {
    body = renderText(`\`\`\`html\n${code.trim()}\n\`\`\``);
  } else if (error) {
    body = (
      <>
        {textVersion ? renderText(textVersion) : null}
        <p className="visual-note">
          Couldn't draw this visual. Showing the text version.
        </p>
        <p className="visual-error-detail">
          {error.message}
          {error.line ? ` · line ${error.line}` : ""}
        </p>
        <div className="visual-buttons">
          {host.onAsk ? (
            <button
              type="button"
              className="visual-button"
              onClick={() => host.onAsk?.(fixPrompt(title, error))}
            >
              Ask for a fix
            </button>
          ) : null}
          <button
            type="button"
            className="visual-button"
            onClick={() => setShowCode(true)}
          >
            View code
          </button>
        </div>
      </>
    );
  } else {
    body = (
      <div
        className="visual-stage"
        data-ready={ready ? "" : undefined}
        style={{ minHeight: streaming ? block.height : undefined }}
      >
        <div className="visual-placeholder" aria-hidden="true">
          {caption ? <span className="visual-caption">{caption}</span> : null}
        </div>
        {streaming ? null : (
          <div className="visual-live">
            <VisualFrame
              key={redraw}
              onVisible={(visible) => {
                visibleRef.current = visible;
              }}
              hash={block.hash}
              html={block.html}
              title={title}
              declaredHeight={block.height}
              animate={streamedIn.current}
              onReady={() => {
                setReady(true);
                if (!block.asked) noteUnaskedVisual(block.hash);
              }}
              onError={setError}
              onMessage={onFrameMessage}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <figure className="visual-block" dir="ltr">
      <VisualHeader
        title={block.title}
        subtitle={block.subtitle}
        actions={
          incomplete || level === "off"
            ? null
            : { asText, onToggleText: toggleText, menu }
        }
      />
      <div className="visual-body">{body}</div>
      {nudge ? (
        <div className="visual-nudge" role="status">
          {nudge === "ask" ? (
            <>
              <span>
                You switched 3 of the last 5 visuals to text. Want the agent to
                draw only when you ask?
              </span>
              <span className="visual-buttons">
                <button
                  type="button"
                  className="visual-button"
                  onClick={() => {
                    saveVisualLevel("asked");
                    saveVisualNudged();
                    setNudge("done");
                  }}
                >
                  Only when I ask
                </button>
                <button
                  type="button"
                  className="visual-button"
                  onClick={() => {
                    saveVisualNudged();
                    setNudge(null);
                  }}
                >
                  Keep as is
                </button>
              </span>
            </>
          ) : (
            <span>Done. You can change this in Settings › Chat › Visuals.</span>
          )}
        </div>
      ) : null}
      {strip.strip ? (
        <VisualStrip
          key={strip.strip.text}
          strip={strip.strip}
          onClose={() => strip.clear()}
        />
      ) : null}
    </figure>
  );
});
