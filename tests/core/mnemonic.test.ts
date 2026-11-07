import { describe, expect, it } from "vitest";
import { parseMnemonic } from "../../src/core/mnemonic";

const seg = (text: string, tag: string | null = null) => ({ text, tag });

describe("parseMnemonic", () => {
  it("plain text is one segment", () => {
    expect(parseMnemonic("just words")).toEqual([seg("just words")]);
    expect(parseMnemonic("")).toEqual([]);
  });

  it("maps known tags to styled segments", () => {
    expect(
      parseMnemonic("a <radical>foo</radical> b <kanji>bar</kanji> <em>x</em>"),
    ).toEqual([
      seg("a "),
      seg("foo", "radical"),
      seg(" b "),
      seg("bar", "kanji"),
      seg(" "),
      seg("x", "em"),
    ]);
    for (const t of ["reading", "vocabulary", "ja"])
      expect(parseMnemonic(`<${t}>z</${t}>`)).toEqual([seg("z", t)]);
  });

  it("strips unknown tags and attributes but keeps their text", () => {
    expect(
      parseMnemonic('<b>bold</b> <a href="http://x" onclick="evil()">link</a>'),
    ).toEqual([seg("bold link")]);
    expect(
      parseMnemonic('<kanji class="x" onclick="evil()">k</kanji>'),
    ).toEqual([seg("k", "kanji")]);
  });

  it("keeps script and onerror payloads as inert text", () => {
    const s = parseMnemonic(
      "<script>alert(1)</script>hi <img src=x onerror=alert(1)>!",
    );
    expect(s).toEqual([seg("alert(1)hi !")]);
    expect(s.every((x) => x.tag === null)).toBe(true);
  });

  it("decodes entities to text, which never becomes a tag", () => {
    expect(
      parseMnemonic("&lt;script&gt;alert(1)&lt;/script&gt; &amp; &#39;q&#39;"),
    ).toEqual([seg("<script>alert(1)</script> & 'q'")]);
    expect(parseMnemonic("&bogus; &#99999999;")).toEqual([
      seg("&bogus; &#99999999;"),
    ]);
  });

  it("handles nested, unclosed and stray tags", () => {
    expect(parseMnemonic("<kanji>a <em>b</em> c</kanji>")).toEqual([
      seg("a ", "kanji"),
      seg("b", "em"),
      seg(" c", "kanji"),
    ]);
    expect(parseMnemonic("<em>never closed")).toEqual([
      seg("never closed", "em"),
    ]);
    expect(parseMnemonic("stray </em> close, 1 < 2 and <")).toEqual([
      seg("stray  close, 1 < 2 and <"),
    ]);
  });
});
