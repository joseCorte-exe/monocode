import { createContext, useContext, useMemo, type ReactNode } from "react";

/**
 * What a visual needs from where it is drawn. Providers nest: the session
 * pane gives the composer, the markdown gives the workspace, the text
 * renderer and whether the answer is still streaming.
 */
export type VisualHost = {
  cwd?: string;
  /** The message that holds the visual is still streaming. */
  streaming?: boolean;
  onOpenFile?: (
    path: string,
    navigation?: { line: number; column?: number },
  ) => void;
  /** Puts text in the composer of the pane the visual is in, unsent. */
  onAsk?: (text: string) => void;
  renderText?: (markdown: string) => ReactNode;
};

export const VisualHostContext = createContext<VisualHost>({});

export function useVisualHost(): VisualHost {
  return useContext(VisualHostContext);
}

export function VisualHostProvider({
  value,
  children,
}: {
  value: VisualHost;
  children: ReactNode;
}) {
  const outer = useContext(VisualHostContext);
  const merged = useMemo(() => {
    const next: VisualHost = { ...outer };
    for (const [key, entry] of Object.entries(value)) {
      if (entry !== undefined) (next as Record<string, unknown>)[key] = entry;
    }
    return next;
  }, [outer, value]);
  return (
    <VisualHostContext.Provider value={merged}>
      {children}
    </VisualHostContext.Provider>
  );
}
