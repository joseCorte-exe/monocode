import { describe, expect, it } from "vitest";
import { resolveVisualFile } from "./openFile";

describe("resolveVisualFile", () => {
  const cwd = "/work/app";

  it("opens files inside the workspace, with the line", () => {
    expect(resolveVisualFile("src/a.ts", 42, cwd)).toEqual({
      path: "/work/app/src/a.ts",
      navigation: { line: 42 },
    });
  });

  it("refuses paths that leave the workspace", () => {
    expect(resolveVisualFile("/etc/hosts", undefined, cwd)).toBeUndefined();
    expect(resolveVisualFile("../../secret", undefined, cwd)).toBeUndefined();
    expect(
      resolveVisualFile("src/../../other/x.ts", undefined, cwd),
    ).toBeUndefined();
  });

  it("needs a workspace", () => {
    expect(resolveVisualFile("src/a.ts", undefined, undefined)).toBeUndefined();
  });
});
