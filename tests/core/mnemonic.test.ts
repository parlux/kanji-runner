import { describe, expect, it } from "vitest";
import { coveredReadings, parseMnemonic } from "../../src/core/mnemonic";

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
    for (const t of ["reading", "sound", "vocabulary", "ja"])
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

describe("coveredReadings", () => {
  it("reads one bracket after a reading tag", () => {
    expect(coveredReadings("a <reading>Foo</reading> (ふう) b")).toEqual([
      "ふう",
    ]);
  });
  it("collects two readings from two brackets", () => {
    expect(
      coveredReadings(
        "<reading>A</reading> (あ) and <reading>B</reading> (び)",
      ),
    ).toEqual(["あ", "び"]);
  });
  it("splits one bracket on 、 , and /", () => {
    expect(coveredReadings("<reading>A</reading> (あ、い, う/え)")).toEqual([
      "あ",
      "い",
      "う",
      "え",
    ]);
  });
  it("converts katakana and allows spaces", () => {
    expect(coveredReadings("<reading>A</reading>   (ジョウ)")).toEqual([
      "じょう",
    ]);
  });
  it("is empty with no bracket, and ignores brackets not after the tag", () => {
    expect(coveredReadings("<reading>A</reading> alone")).toEqual([]);
    expect(coveredReadings("plain (あ) text")).toEqual([]);
    expect(coveredReadings("<kanji>A</kanji> (あ)")).toEqual([]);
  });
});
