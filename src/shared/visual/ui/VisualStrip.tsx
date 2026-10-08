import { useState } from "react";

/** The line under a visual: a question before the app acts on it. */
export type Strip = {
  text: string;
  /** The whole text on hover, when the line may cut it. */
  title?: string;
  actions: { label: string; run: () => void }[];
};

/** One strip per visual; the newest wins. */
export function useStrip() {
  const [strip, setStrip] = useState<Strip | null>(null);
  return { strip, show: setStrip, clear: () => setStrip(null) };
}

export function VisualStrip({
  strip,
  onClose,
}: {
  strip: Strip;
  onClose: () => void;
}) {
  return (
    <div className="visual-strip" role="status">
      <span title={strip.title}>{strip.text}</span>
      {strip.actions.map((action) => (
        <button
          key={action.label}
          type="button"
          className="visual-strip-action"
          onClick={() => {
            onClose();
            action.run();
          }}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}
