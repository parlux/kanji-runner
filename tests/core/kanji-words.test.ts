import { describe, expect, it } from "vitest";
import { wordReadingRow } from "../../src/core/distractors";
import { KANA } from "../../src/core/kana";
import { KANJI } from "../../src/core/kanji";
import { builtInPool, meaningPool, unlockedPool } from "../../src/core/pool";
import { place } from "../../src/core/progression";
import { createRng } from "../../src/core/rng";
import { buildRun, missedItems, select } from "../../src/core/run";
import { defaultProgress, itemKey } from "../../src/core/srs";
import { MAX_NEW_PER_RUN, MAX_NEW_WORDS_PER_RUN } from "../../src/core/tuning";
import type { Progress, WordItem } from "../../src/core/types";
import { isWordEligible, kanjiNeeded, WORDS } from "../../src/core/words";
import { forSeeds } from "../sweep";

const rec = (box: number, seen = 1) => ({
  box,
  seen,
  correct: 1,
  wrong: 0,
  lastSeen: 1,
});
const kw = (word: string): WordItem => {
  const w = WORDS.find((x) => x.word === word && x.kind !== "loanword");
  if (!w) throw new Error(`no kanji word ${word}`);
  return w;
};
/** Kanji meanings of levels ≤ `upTo` learned at `box`; unlocked level `level`. */
const learned = (level: number, upTo: number, box = 2): Progress => {
  const p: Progress = { ...defaultProgress(), unlockedLevel: level };
  for (const k of KANA) p.items[itemKey(k.char, "kana")] = rec(5);
  for (const k of KANJI)
    if (k.level <= upTo) p.items[itemKey(k.char, "meaning")] = rec(box);
  return p;
};
const kanjiWords = WORDS.filter((w) => w.kind !== "loanword");

describe("kanji words in WORDS", () => {
  it("loads loanwords first, then kanji words with readings", () => {
    const first = WORDS.findIndex((w) => w.kind !== "loanword");
    expect(first).toBeGreaterThan(0);
    expect(WORDS.slice(0, first).every((w) => w.kind === "loanword")).toBe(
      true,
    );
    expect(WORDS.slice(first).every((w) => !!w.reading)).toBe(true);
    expect(WORDS.slice(0, first).every((w) => w.reading === undefined)).toBe(
      true,
    );
  });
});

describe("kanjiNeeded", () => {
  it("lists the kanji once each, drops kana and 々", () => {
    expect(kanjiNeeded("一人")).toEqual(["一", "人"]);
    expect(kanjiNeeded("入る")).toEqual(["入"]);
    expect(kanjiNeeded("人々")).toEqual(["人"]);
    expect(kanjiNeeded("大大")).toEqual(["大"]);
    expect(kanjiNeeded("アメリカ人")).toEqual(["人"]);
    expect(kanjiNeeded("お金")).toEqual(["金"]);
  });
});

describe("kanji word eligibility", () => {
  const w = kw("一人");
  it("needs every kanji's meaning at box 2, and the level", () => {
    expect(isWordEligible(w, learned(w.level, w.level))).toBe(true);
    const p = learned(w.level, w.level);
    p.items[itemKey("人", "meaning")] = rec(1);
    expect(isWordEligible(w, p)).toBe(false);
    p.items = Object.fromEntries(
      Object.entries(p.items).filter(([k]) => k !== itemKey("人", "meaning")),
    );
    expect(isWordEligible(w, p)).toBe(false);
    expect(isWordEligible(w, learned(w.level - 1, w.level))).toBe(false);
  });
  it("ignores kana boxes and reading records", () => {
    const p = learned(w.level, w.level);
    p.items = Object.fromEntries(
      Object.entries(p.items).filter(([k]) => !k.endsWith(":kana")),
    );
    expect(isWordEligible(w, p)).toBe(true);
  });
});

describe("pool order and reading entries", () => {
  it("lists the current level's words before lower levels', lowest first", () => {
    const p = learned(5, 5);
    const ws = unlockedPool(p, KANA, KANJI, WORDS)
      .filter((e) => e.type === "word")
      .map((e) => e.item);
    const levels = ws.map((x) => x.level);
    const cur = levels.filter((l) => l === 5).length;
    expect(cur).toBeGreaterThan(0);
    expect(levels.slice(0, cur).every((l) => l === 5)).toBe(true);
    const rest = levels.slice(cur);
    expect(rest).toEqual([...rest].sort((a, b) => a - b));
    // within a level: loanwords, then kanji words
    const cw = ws.filter((x) => x.level === 5);
    const firstKanji = cw.findIndex((x) => x.kind !== "loanword");
    expect(cw.slice(0, firstKanji).every((x) => x.kind === "loanword")).toBe(
      true,
    );
  });

  it("adds a kanji word's reading right after its meaning at box 3", () => {
    const w = kw("一人");
    const p = learned(w.level, w.level);
    const entries = () => unlockedPool(p, KANA, KANJI, WORDS);
    expect(entries().some((e) => e.type === "wordreading")).toBe(false);
    p.items[itemKey(w.word, "word")] = rec(3);
    const es = entries();
    const i = es.findIndex((e) => e.key === itemKey(w.word, "word"));
    expect(es[i + 1]?.key).toBe(itemKey(w.word, "wordreading"));
    expect(es[i + 1]?.type).toBe("wordreading");
    p.items[itemKey(w.word, "word")] = rec(2);
    expect(entries().some((e) => e.type === "wordreading")).toBe(false);
  });

  it("never gives a loanword a reading entry", () => {
    const p = learned(6, 6, 5);
    for (const w of WORDS) p.items[itemKey(w.word, "word")] = rec(5);
    for (const e of unlockedPool(p, KANA, KANJI, WORDS))
      if (e.type === "wordreading") expect(e.item.kind).not.toBe("loanword");
  });
});

describe("new words per run", () => {
  it("counts meaning and reading entries together: at most 2, inside 4", () => {
    const p = learned(6, 6);
    const pool = builtInPool(p, KANA, KANJI, WORDS);
    expect(MAX_NEW_WORDS_PER_RUN).toBe(2);
    for (const seed of forSeeds(200, 200)) {
      const fresh = select(createRng(seed), pool).filter((e) => !pool.known(e));
      const nw = fresh.filter(
        (e) => e.type === "word" || e.type === "wordreading",
      );
      expect(nw.length).toBeLessThanOrEqual(MAX_NEW_WORDS_PER_RUN);
      expect(fresh.length).toBeLessThanOrEqual(MAX_NEW_PER_RUN);
    }
  });

  it("asks wordreading rows with the word's own reading", () => {
    const w = kw("一人");
    const p = learned(w.level, w.level, 5);
    p.items[itemKey(w.word, "word")] = rec(5);
    p.items[itemKey(w.word, "wordreading")] = rec(5);
    const rows = [];
    for (const seed of forSeeds(400, 400))
      rows.push(...buildRun(seed, p, KANA, KANJI, WORDS));
    const r = rows.filter((x) => x.type === "wordreading");
    expect(r.length).toBeGreaterThan(0);
    for (const row of r)
      expect(row.answer).toBe(
        kanjiWords.find((x) => x.word === row.prompt)?.reading,
      );
  });
});

describe("Meaning and WaniKani modes stay word-free", () => {
  it("meaningPool has no word entries or word distractors", () => {
    const p = learned(5, 5, 5);
    const pool = meaningPool(p, KANJI);
    expect(pool.entries.every((e) => e.type === "meaning")).toBe(true);
    expect(pool.allWords).toEqual([]);
  });
});

describe("placement", () => {
  it("marks both keys of kanji words of placed levels, one of loanwords", () => {
    const p = place(defaultProgress(), 3, KANA, KANJI, WORDS);
    for (const w of WORDS) {
      const placed = w.level <= 3;
      expect(p.items[itemKey(w.word, "word")]?.box).toBe(
        placed ? 4 : undefined,
      );
      expect(p.items[itemKey(w.word, "wordreading")]?.box).toBe(
        placed && w.kind !== "loanword" ? 4 : undefined,
      );
    }
  });

  it("re-placement lower removes unanswered marks of both keys", () => {
    const high = place(defaultProgress(), 5, KANA, KANJI, WORDS);
    const w = kanjiWords.find((x) => x.level === 4) as WordItem;
    high.items[itemKey(w.word, "wordreading")] = rec(4, 3);
    const low = place(high, 2, KANA, KANJI, WORDS);
    expect(low.items[itemKey(w.word, "wordreading")]?.seen).toBe(3);
    expect(low.items[itemKey(w.word, "word")]).toBeUndefined();
    for (const x of kanjiWords)
      if (x.level > 3 && x !== w)
        expect(low.items[itemKey(x.word, "wordreading")]).toBeUndefined();
  });
});

describe("wordReadingRow", () => {
  const w = kw("一人");
  const near = kanjiWords.filter((x) => x.level <= w.level + 1);
  it("asks the reading; options differ from the answer, within the length band", () => {
    for (const seed of forSeeds(80, 80)) {
      const r = wordReadingRow(createRng(seed), w, near, kanjiWords, 3);
      expect(r.type).toBe("wordreading");
      expect(r.prompt).toBe("一人");
      expect(r.answer).toBe("ひとり");
      expect(r.options).toHaveLength(3);
      expect(new Set(r.options).size).toBe(3);
      expect(r.options[r.answerIndex]).toBe("ひとり");
      for (const o of r.options)
        expect(Math.abs(o.length - 3)).toBeLessThanOrEqual(1);
    }
  });

  it("prefers words sharing a kanji with the prompt", () => {
    const pool = [
      { ...w, word: "一日", reading: "いちにち" },
      { ...w, word: "人生", reading: "じんせい" },
      { ...w, word: "大学", reading: "だいがく" },
      { ...w, word: "金曜", reading: "きんよう" },
    ];
    for (const seed of forSeeds(40, 40)) {
      const r = wordReadingRow(createRng(seed), w, pool, [], 3);
      expect([...r.options].sort()).toEqual(
        ["いちにち", "じんせい", "ひとり"].sort(),
      );
    }
  });

  it("never offers the answer even when another word reads the same", () => {
    const twin = { ...w, word: "一人前", reading: "ひとり" };
    const r = wordReadingRow(createRng(1), w, [twin, ...near], kanjiWords, 3);
    expect(r.options.filter((o) => o === "ひとり")).toHaveLength(1);
  });

  it("pads from all kanji words when the pool is short", () => {
    const r = wordReadingRow(createRng(2), w, [], kanjiWords, 3);
    expect(new Set(r.options).size).toBe(3);
  });
});

describe("summary", () => {
  it("lists a missed wordreading gate with the reading as the answer", () => {
    const rows = [
      {
        type: "wordreading" as const,
        prompt: "一人",
        options: ["ひとり", "いちにん"],
        answerIndex: 0,
        answer: "ひとり",
      },
    ];
    const m = missedItems(rows, [false], [], KANJI);
    expect(m).toEqual([
      {
        q: 1,
        type: "wordreading",
        prompt: "一人",
        answers: ["ひとり"],
        charge: false,
      },
    ]);
  });
});
