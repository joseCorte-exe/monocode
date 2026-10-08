import { describe, expect, it } from "vitest";
import { parseVisualBlock, VISUAL_HEIGHT_DEFAULT } from "./visualBlock";

const FULL = [
  "title: Opus went from 0 to half in 3 days",
  "subtitle: Turns per model · Oct 1 to 7",
  "height: 300",
  "asked: no",
  "<text>",
  "Opus share: 0% to 51%.",
  "</text>",
  '<div id="c"></div>',
  "<script>bx.chart('#c', {})</script>",
].join("\n");

describe("parseVisualBlock", () => {
  it("splits header, text version and html", () => {
    const block = parseVisualBlock(FULL);
    expect(block.title).toBe("Opus went from 0 to half in 3 days");
    expect(block.subtitle).toBe("Turns per model · Oct 1 to 7");
    expect(block.height).toBe(300);
    expect(block.asked).toBe(false);
    expect(block.text).toBe("Opus share: 0% to 51%.");
    expect(block.html).toBe(
      "<div id=\"c\"></div>\n<script>bx.chart('#c', {})</script>",
    );
  });

  it("falls back to the default height and no subtitle", () => {
    const block = parseVisualBlock("title: A\n<div></div>");
    expect(block.height).toBe(VISUAL_HEIGHT_DEFAULT);
    expect(block.subtitle).toBeUndefined();
    expect(block.text).toBeUndefined();
    expect(block.html).toBe("<div></div>");
  });

  it("clamps the height to 120..720", () => {
    expect(parseVisualBlock("height: 2000\n<p></p>").height).toBe(720);
    expect(parseVisualBlock("height: 40\n<p></p>").height).toBe(120);
    expect(parseVisualBlock("height: tall\n<p></p>").height).toBe(
      VISUAL_HEIGHT_DEFAULT,
    );
  });

  it("reads asked: yes", () => {
    expect(parseVisualBlock("asked: yes\n<p></p>").asked).toBe(true);
  });

  it("works on a block that is still streaming", () => {
    const partial = parseVisualBlock(
      "title: Half\nheight: 200\n<text>\nOpus sh",
    );
    expect(partial.title).toBe("Half");
    expect(partial.height).toBe(200);
    expect(partial.text).toBe("Opus sh");
    expect(partial.html).toBe("");
  });

  it("gives the same hash for the same source", () => {
    expect(parseVisualBlock(FULL).hash).toBe(parseVisualBlock(FULL).hash);
    expect(parseVisualBlock(FULL).hash).not.toBe(
      parseVisualBlock(`${FULL} `.replace("300", "301")).hash,
    );
  });
});
