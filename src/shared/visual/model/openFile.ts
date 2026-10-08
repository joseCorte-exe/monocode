import {
  isEqualOrInside,
  resolveWorkspaceFileReference,
} from "../../lib/paths";

/**
 * A file the visual asked to open, resolved against the session's workspace.
 * Undefined for anything outside it: the visual's code is untrusted.
 */
export function resolveVisualFile(
  path: string,
  line: number | undefined,
  cwd: string | undefined,
):
  { path: string; navigation?: { line: number; column?: number } } | undefined {
  if (!cwd) return undefined;
  const reference = line ? `${path}:${line}` : path;
  const file = resolveWorkspaceFileReference(reference, cwd);
  if (!file || !isEqualOrInside(file.path, cwd)) return undefined;
  return file;
}
