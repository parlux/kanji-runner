import { describe, expect, it } from "vitest";
import {
  chunkUses,
  components,
  composite,
  mapVariant,
  parseKanjivg,
  VARIANTS,
  type Chunk,
} from "../../scripts/kanjivg";

/** A KanjiVG-style `<g>`: element attributes, then its body. */
const g = (attrs: string, ...body: string[]) =>
  `<g ${attrs}>\n${body.join("\n")}\n</g>`;
const s = `<path kvg:type="㇐" d="M0,0"/>`;
const el = (e: string, ...body: string[]) => g(`kvg:element="${e}"`, ...body);
const entry = (char: string, ...body: string[]) =>
  `<kanji id="kvg:kanji_${char.codePointAt(0)?.toString(16).padStart(5, "0")}">\n${el(char, ...body)}\n</kanji>`;

// Made-up trees shaped like the real KanjiVG entries.
const XML = [
  "<kanjivg>",
  entry(
    "閉",
    el("門", g(`kvg:position="left"`, s, s), g(`kvg:position="right"`, s)),
    el(
      "才",
      g(
        `kvg:element="扌" kvg:variant="true" kvg:original="手"`,
        s,
        el("亅", s),
        s,
      ),
    ),
  ),
  entry(
    "休",
    g(`kvg:element="亻" kvg:variant="true" kvg:original="人"`, s, s),
    el("木", s, s, s, s),
  ),
  entry(
    "語",
    el("言", s, s, el("口", s)),
    el("吾", el("五", s, s), el("口", s)),
  ),
  entry("悟", el("忄", s, s), el("吾", el("五", s, s), el("口", s))),
  // A split element (two kvg:part groups), counted once; a CDP id descended.
  entry(
    "衷",
    g(`kvg:element="衣" kvg:part="1"`, el("亠", s, s)),
    el("中", el("口", s), s),
    g(`kvg:element="衣" kvg:part="2"`, s, s),
    g(`kvg:element="CDP-8BC4"`, el("丨", s)),
  ),
  // The Kaisho variant entry is ignored.
  `<kanji id="kvg:kanji_04f11-Kaisho">\n${el("休", el("口", s))}\n</kanji>`,
  "</kanjivg>",
].join("\n");

const show = (cs: Chunk[]): string[] =>
  cs.map((c) =>
    c.children.length
      ? `${c.element}(${show(c.children).join(" ")})`
      : c.element,
  );

describe("KanjiVG components (SPEC-own-stories: Composite parts)", () => {
  it("maps every listed variant to the parts.json glyph", () => {
    const listed = {
      氵: "⺡",
      亻: "⺅",
      扌: "⺘",
      艹: "⺾",
      丿: "ノ",
      忄: "⺖",
      刂: "⺉",
      八: "ハ",
      灬: "⺣",
      丨: "｜",
      礻: "⺭",
      衤: "⻂",
      罒: "⺲",
    };
    for (const [from, to] of Object.entries(listed))
      expect(mapVariant(from)).toBe(to);
    expect(mapVariant("木")).toBe("木");
    for (const to of Object.values(VARIANTS)) expect(mapVariant(to)).toBe(to);
  });

  const chars = new Set([..."閉休語悟衷"]);
  const trees = parseKanjivg(XML, chars);

  it("parses element trees: variants mapped, split parts once, CDP ids descended", () => {
    expect([...trees.keys()]).toEqual([..."閉休語悟衷"]);
    expect(show(trees.get("閉") ?? [])).toEqual(["門", "才(⺘(亅))"]);
    expect(show(trees.get("休") ?? [])).toEqual(["⺅", "木"]);
    expect(show(trees.get("衷") ?? [])).toEqual(["衣(亠)", "中(口)", "｜"]);
    // 衣 (strokes in part 2), 中 and the leaf ｜ draw strokes of their own.
    expect(trees.get("衷")?.map((c) => c.loose)).toEqual([true, true, true]);
    expect(trees.get("語")?.[0]?.loose).toBe(true);
    expect(trees.get("閉")?.[1]?.loose).toBe(false);
  });

  it("counts uses once per kanji, at any depth", () => {
    const uses = chunkUses(trees);
    expect(uses.get("吾")).toBe(2);
    expect(uses.get("五")).toBe(2);
    expect(uses.get("口")).toBe(3);
    expect(uses.get("門")).toBe(1);
  });

  it("keeps named, kanji and 2+ use chunks; recurses single-use ones; keeps leaves", () => {
    const chunk = (element: string, ...children: Chunk[]): Chunk => ({
      element,
      children,
      loose: false,
    });
    const tree = [
      chunk("A", chunk("x")), // named
      chunk("B", chunk("y")), // a kanji
      chunk("C", chunk("z")), // 2+ uses
      chunk("D", chunk("E", chunk("p"), chunk("q")), chunk("r")), // single use: recursed twice
      chunk("F"), // a leaf
      { ...chunk("G", chunk("s")), loose: true }, // loose strokes: kept
    ];
    const keep = (e: string) => ["A", "B", "C"].includes(e);
    expect(composite("K", tree, keep)).toEqual([..."ABC", ..."pqr", "F", "G"]);
    expect(composite("A", [chunk("A"), chunk("r"), chunk("r")], keep)).toEqual([
      "r",
    ]);
  });

  it("builds 閉 → 門 才, 休 → ⺅ 木, 語 → 言 吾", () => {
    const named = new Set(["門", "⺅", "木", "言", "口"]);
    const kanji = new Set([..."閉休語悟衷才"]);
    const out = components(trees, named, kanji);
    expect(out.get("閉")).toEqual(["門", "才"]);
    expect(out.get("休")).toEqual(["⺅", "木"]);
    expect(out.get("語")).toEqual(["言", "吾"]);
  });
});
