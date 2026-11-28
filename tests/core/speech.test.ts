import { describe, expect, it } from "vitest";
import {
  plainReading,
  showReading,
  shownReading,
} from "../../src/core/distractors";
import { KANA } from "../../src/core/kana";
import { KANJI } from "../../src/core/kanji";
import { reaskRow } from "../../src/core/reask";
import { createRng } from "../../src/core/rng";
import { buildRun } from "../../src/core/run";
import {
  allSpoken,
  clipKey,
  spoken,
  type SpeechContext,
  type Spoken,
} from "../../src/core/speech";
import { defaultProgress, itemKey } from "../../src/core/srs";
import type { GateRow, KanjiItem, Progress } from "../../src/core/types";
import { WORDS } from "../../src/core/words";
import { forSeeds } from "../sweep";
import { NOW } from "../now";
import { wkPool, wkProgress, wkRun } from "./wk-run";

const ctx = (progress: Progress = defaultProgress()): SpeechContext => ({
  kanji: KANJI,
  words: WORDS,
  progress,
});
const gate = (type: GateRow["type"], prompt: string, answer = ""): GateRow => ({
  type,
  prompt,
  options: [answer],
  answerIndex: 0,
  answer,
});
/** What a row says; fails the test when it says nothing. */
const say = (row: GateRow, c: SpeechContext = ctx()): Spoken => {
  const s = spoken(row, c);
  if (!s) throw new Error(`${row.type} ${row.prompt} says nothing`);
  return s;
};
const kanji = (c: string): KanjiItem => {
  const k = KANJI.find((x) => x.char === c);
  if (!k) throw new Error(c);
  return k;
};

describe("spoken", () => {
  it("kana gates say the kana's sound; ア and あ share a key", () => {
    expect(spoken(gate("kana", "あ", "a"), ctx())).toEqual({
      text: "あ",
      reading: "あ",
    });
    const a = say(gate("kana", "ア", "a"));
    expect(a.reading).toBe("あ");
    expect(clipKey(a)).toBe(clipKey({ text: "あ", reading: "あ" }));
  });

  it("reading gates say the answer, brackets dropped", () => {
    expect(spoken(gate("reading", "上", "あ(げる)"), ctx())?.reading).toBe(
      "あげる",
    );
    expect(spoken(gate("reading", "休", "やす(む)"), ctx())).toEqual({
      text: "やすむ",
      reading: "やすむ",
    });
  });

  it("meaning gates follow shownReading at the reading's seen count", () => {
    expect(spoken(gate("meaning", "日", "day"), ctx())?.reading).toBe("にち");
    const p = defaultProgress();
    p.items[itemKey("休", "reading")] = {
      box: 1,
      seen: 1,
      correct: 1,
      wrong: 0,
      lastSeen: 1,
    };
    expect(spoken(gate("meaning", "休", "rest"), ctx(p))?.reading).toBe(
      plainReading(showReading(shownReading(kanji("休"), 1))),
    );
    expect(spoken(gate("meaning", "休", "rest"), ctx(p))?.reading).toBe(
      "やすむ",
    );
  });

  it("word and word-reading gates say the word's reading, with the word as text", () => {
    const want = { text: "毎年", reading: "まいとし" };
    expect(spoken(gate("word", "毎年", "every year"), ctx())).toEqual(want);
    expect(spoken(gate("wordreading", "毎年", "まいとし"), ctx())).toEqual(
      want,
    );
  });

  it("loanword gates say the word itself and keep katakana in the key", () => {
    const s = say(gate("word", "テレビ", "television"));
    expect(s).toEqual({ text: "テレビ", reading: "テレビ" });
    expect(clipKey(s)).toBe("テレビ|テレビ");
  });

  it("an unknown item says nothing", () => {
    expect(spoken(gate("meaning", "龘", "x"), ctx())).toBeNull();
    expect(spoken(gate("word", "nope", "x"), ctx())).toBeNull();
  });

  it("a meaning gate says what the run's reading gate for that kanji shows", () => {
    const p: Progress = { ...defaultProgress(), unlockedLevel: 4 };
    for (const k of KANA) p.items[itemKey(k.char, "kana")] = rec(5);
    for (const k of KANJI)
      if (k.level <= 3) {
        p.items[itemKey(k.char, "meaning")] = rec(3, k.level);
        p.items[itemKey(k.char, "reading")] = rec(3, k.level + 1);
      }
    let checked = 0;
    for (const seed of forSeeds(200)) {
      const rows = buildRun(seed, p, NOW, KANA, KANJI, WORDS);
      for (const r of rows) {
        if (r.type !== "meaning") continue;
        const first = rows.find(
          (x) => x.type === "reading" && x.prompt === r.prompt,
        );
        if (!first) continue;
        expect(spoken(r, ctx(p))?.reading).toBe(plainReading(first.answer));
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});

function rec(box: number, seen = 1) {
  return { box, seen, correct: 1, wrong: 0, lastSeen: 1 };
}

describe("re-asks", () => {
  it("say the same as their gate", () => {
    const c = { kanji: wkPool.kanji, words: WORDS, progress: wkProgress };
    let checked = 0;
    for (const seed of forSeeds(100)) {
      const { rows, reask } = wkRun(seed);
      const rng = createRng(seed);
      rows.forEach((first, i) => {
        const entry = reask?.entries[i];
        if (!entry) throw new Error("no entry");
        const again = reaskRow(rng, entry, first, wkPool);
        expect(say(again, c)).toEqual(say(first, c));
        checked++;
      });
    }
    expect(checked).toBeGreaterThan(0);
  });
});

describe("allSpoken", () => {
  const keys = new Set(
    allSpoken({ kana: KANA, kanji: KANJI, words: WORDS }).map(clipKey),
  );

  it("has one entry per key, covering kana, kanji readings and words", () => {
    const all = allSpoken({ kana: KANA, kanji: KANJI, words: WORDS });
    expect(new Set(all.map(clipKey)).size).toBe(all.length);
    expect(keys.has("あ|あ")).toBe(true);
    expect(keys.has("にち|にち")).toBe(true);
    expect(keys.has("毎年|まいとし")).toBe(true);
    expect(keys.has("テレビ|テレビ")).toBe(true);
  });

  it("contains every key a built run speaks", () => {
    const p: Progress = { ...defaultProgress(), unlockedLevel: 12 };
    for (const k of KANA) p.items[itemKey(k.char, "kana")] = rec(5);
    for (const k of KANJI)
      if (k.level <= 11) {
        p.items[itemKey(k.char, "meaning")] = rec(3, k.level);
        p.items[itemKey(k.char, "reading")] = rec(3, k.level);
      }
    for (const seed of forSeeds(200))
      for (const row of buildRun(seed, p, NOW, KANA, KANJI, WORDS)) {
        expect(keys.has(clipKey(say(row, ctx(p))))).toBe(true);
      }
  });
});
