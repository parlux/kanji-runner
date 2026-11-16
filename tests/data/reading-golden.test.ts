import { describe, expect, it } from "vitest";
import data from "../../src/data/kanji.json";
import golden from "./reading-golden.json";
import type { KanjiItem } from "../../src/core/types";

/**
 * Golden reading set (Task R3): researched readings a learner meets most,
 * checked against the committed data. `on` lists acceptable on'yomi
 * (hiragana), `kun` acceptable KANJIDIC2 kun entries (`あか.るい`); an empty
 * list means no expectation. Notes cite the evidence, mostly the NINJAL
 * BCCWJ short-unit-word frequency list ("BCCWJ": lemma(reading)count).
 */
type Golden = { char: string; on: string[]; kun: string[]; note: string };

const kanji = new Map((data as KanjiItem[]).map((k) => [k.char, k]));
const entries = golden as Golden[];

describe("golden reading set", () => {
  it("has one entry per kanji, each with a note", () => {
    expect(new Set(entries.map((g) => g.char)).size).toBe(entries.length);
    for (const g of entries) expect(g.note, g.char).toMatch(/\S/);
  });

  it("names only kanji and readings KANJIDIC2 has", () => {
    for (const g of entries) {
      const k = kanji.get(g.char);
      expect(k, g.char).toBeDefined();
      for (const r of [...g.on, ...g.kun.map((e) => e.replace(".", ""))])
        expect(k?.readings, `${g.char} ${r}`).toContain(r);
    }
  });
});
