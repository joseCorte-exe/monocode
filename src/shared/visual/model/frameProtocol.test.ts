import { describe, expect, it } from "vitest";
import { ASK_TEXT_LIMIT, parseFrameMessage } from "./frameProtocol";

describe("parseFrameMessage", () => {
  it("ignores anything without the bx marker or with an unknown type", () => {
    expect(parseFrameMessage(null)).toBeNull();
    expect(parseFrameMessage("ready")).toBeNull();
    expect(parseFrameMessage({ type: "ready" })).toBeNull();
    expect(parseFrameMessage({ bx: 1, type: "invoke", cmd: "x" })).toBeNull();
  });

  it("rounds and bounds the size", () => {
    expect(parseFrameMessage({ bx: 1, type: "size", height: 301.2 })).toEqual({
      type: "size",
      height: 302,
    });
    expect(
      parseFrameMessage({ bx: 1, type: "size", height: "300" }),
    ).toBeNull();
  });

  it("keeps error messages short and lines positive", () => {
    const error = parseFrameMessage({
      bx: 1,
      type: "error",
      message: "x".repeat(900),
      line: -3,
    });
    expect(error).toEqual({ type: "error", message: "x".repeat(500) });
  });

  it("accepts open with an optional line", () => {
    expect(
      parseFrameMessage({ bx: 1, type: "open", path: "src/a.ts", line: 4 }),
    ).toEqual({
      type: "open",
      path: "src/a.ts",
      line: 4,
    });
    expect(parseFrameMessage({ bx: 1, type: "open", path: "" })).toBeNull();
  });

  it("cuts ask text at the limit and drops empty ones", () => {
    const ask = parseFrameMessage({
      bx: 1,
      type: "ask",
      text: "y".repeat(5000),
    });
    expect(ask).toEqual({ type: "ask", text: "y".repeat(ASK_TEXT_LIMIT) });
    expect(parseFrameMessage({ bx: 1, type: "ask", text: "  " })).toBeNull();
  });

  it("accepts only https links", () => {
    expect(
      parseFrameMessage({ bx: 1, type: "link", url: "https://a.dev/x" }),
    ).toEqual({
      type: "link",
      url: "https://a.dev/x",
    });
    expect(
      parseFrameMessage({ bx: 1, type: "link", url: "http://a.dev" }),
    ).toBeNull();
    expect(
      parseFrameMessage({ bx: 1, type: "link", url: "javascript:alert(1)" }),
    ).toBeNull();
    expect(
      parseFrameMessage({ bx: 1, type: "link", url: "file:///etc/hosts" }),
    ).toBeNull();
  });

  it("passes Escape back to the app", () => {
    expect(parseFrameMessage({ bx: 1, type: "escape" })).toEqual({
      type: "escape",
    });
  });
});
