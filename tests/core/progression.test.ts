import { describe, expect, it } from "vitest";
import { KANA } from "../../src/core/kana";
import { KANJI } from "../../src/core/kanji";
import {
  applyUnlock,
  levelCard,
  levelKeys,
  levelName,
  levelProgress,
  maxLevel,
  meaningProgress,
  place,
  placeMeaning,
} from "../../src/core/progression";
import { defaultProgress, itemKey, LEARNED_BOX } from "../../src/core/srs";
import { isKanjiWord, WORDS } from "../../src/core/words";
import type { ItemProgress, Progress } from "../../src/core/types";

const rec = (box: number, seen = 1): ItemProgress => ({
  box,
  seen,
  correct: 0,
  wrong: 0,
  lastSeen: 1,
});

/** Gate keys of a level's items, one array per item (kanji, then its words). */
function itemsOf(level: number, meaning = false): string[][] {
  if (level < 2)
    return KANA.filter((k) => (level === 0) === (k.script === "hiragana")).map(
      (k) => [itemKey(k.char, "kana")],
    );
  const kanji = KANJI.filter((k) => k.level === level).map((k) =>
    meaning
      ? [itemKey(k.char, "meaning")]
      : [itemKey(k.char, "meaning"), itemKey(k.char, "reading")],
  );
  if (meaning) return kanji;
  const words = WORDS.filter((w) => w.level === level).map((w) =>
    isKanjiWord(w)
      ? [itemKey(w.word, "word"), itemKey(w.word, "wordreading")]
      : [itemKey(w.word, "word")],
  );
  return [...kanji, ...words];
}

/** Progress at `level` with the first `learned` items fully learned, the rest at box 2. */
function withLearned(
  level: number,
  learned: number,
  meaning = false,
): Progress {
  const p: Progress = { ...defaultProgress(), unlockedLevel: level };
  itemsOf(level, meaning).forEach((keys, i) => {
    for (const k of keys) p.items[k] = rec(i < learned ? LEARNED_BOX : 2);
  });
  return p;
}

const sizeOf = (level: number, meaning = false): number =>
  itemsOf(level, meaning).length;
const kanjiCount = (level: number): number =>
  KANJI.filter((k) => k.level === level).length;
const wordsOf = (level: number) => WORDS.filter((w) => w.level === level);
const lvl = (p: Progress, level: number, meaning = false) =>
  levelProgress(p, level, KANA, KANJI, meaning ? [] : WORDS, meaning);

describe("levels", () => {
  it("level 0 is hiragana, 1 katakana, 2+ kanji", () => {
    expect(levelKeys(0, KANA, KANJI)).toContain("あ:kana");
    expect(levelKeys(1, KANA, KANJI)).toContain("ア:kana");
    expect(levelKeys(0, KANA, KANJI)).not.toContain("ア:kana");
    expect(levelKeys(2, KANA, KANJI)).toContain("一:meaning");
    expect(levelKeys(2, KANA, KANJI)).toContain("一:reading");
    expect(maxLevel(KANJI)).toBe(297);
  });

  it("a kanji level's items include its words, loanwords too", () => {
    const keys = levelKeys(3, KANA, KANJI, WORDS);
    const ws = wordsOf(3);
    expect(ws.some((w) => w.kind === "loanword")).toBe(true);
    expect(ws.some(isKanjiWord)).toBe(true);
    for (const w of ws) {
      expect(keys).toContain(itemKey(w.word, "word"));
      expect(keys.includes(itemKey(w.word, "wordreading"))).toBe(
        isKanjiWord(w),
      );
    }
    expect(levelKeys(3, KANA, KANJI)).toHaveLength(kanjiCount(3) * 2);
    expect(levelKeys(3, [], KANJI, WORDS, true)).toHaveLength(kanjiCount(3));
  });

  it("has human names", () => {
    expect([0, 1, 2, 3].map(levelName)).toEqual([
      "Hiragana",
      "Katakana",
      "Kanji 1",
      "Kanji 2",
    ]);
  });
});

describe("learned", () => {
  const kanjiOf2 = KANJI.find((k) => k.level === 2) as (typeof KANJI)[number];
  const only = (keys: Record<string, number>): Progress => {
    const p = defaultProgress();
    for (const [k, box] of Object.entries(keys)) p.items[k] = rec(box);
    return p;
  };
  const m = itemKey(kanjiOf2.char, "meaning");
  const r = itemKey(kanjiOf2.char, "reading");
  const learnedKanji = (p: Progress) => lvl(p, 2).kanji.learned;

  it("a kanji needs meaning and reading at 3: 3/2 is not learned, 3/3 is", () => {
    expect(learnedKanji(only({ [m]: 3, [r]: 2 }))).toBe(0);
    expect(learnedKanji(only({ [m]: 3 }))).toBe(0); // no reading record = box 0
    expect(learnedKanji(only({ [m]: 3, [r]: 3 }))).toBe(1);
  });

  it("a slip un-learns it", () => {
    expect(learnedKanji(only({ [m]: 3, [r]: 0 }))).toBe(0);
    expect(learnedKanji(only({ [m]: 5, [r]: 5 }))).toBe(1);
  });

  it("a kanji word needs word and wordreading at 3", () => {
    const w = wordsOf(2).find(isKanjiWord) as (typeof WORDS)[number];
    const wk = itemKey(w.word, "word");
    const wr = itemKey(w.word, "wordreading");
    expect(lvl(only({ [wk]: 3, [wr]: 2 }), 2).words.learned).toBe(0);
    expect(lvl(only({ [wk]: 3, [wr]: 3 }), 2).words.learned).toBe(1);
    expect(lvl(only({ [wk]: 2, [wr]: 5 }), 2).words.learned).toBe(0);
  });

  it("a loanword and a kana need their one gate at 3", () => {
    const w = wordsOf(2).find(
      (x) => x.kind === "loanword",
    ) as (typeof WORDS)[number];
    expect(lvl(only({ [itemKey(w.word, "word")]: 2 }), 2).words.learned).toBe(
      0,
    );
    expect(lvl(only({ [itemKey(w.word, "word")]: 3 }), 2).words.learned).toBe(
      1,
    );
    expect(lvl(only({ "あ:kana": 2 }), 0).learned).toBe(0);
    expect(lvl(only({ "あ:kana": 3 }), 0).learned).toBe(1);
  });

  it("meaning mode: meaning at 3 is enough, no words", () => {
    const p = only({ [m]: 3 });
    expect(lvl(p, 2, true)).toMatchObject({
      learned: 1,
      total: kanjiCount(2),
      words: { learned: 0, total: 0 },
      readingToGo: 0,
    });
  });

  it("counts kanji and words separately, and reading to go", () => {
    const w = wordsOf(2).find(isKanjiWord) as (typeof WORDS)[number];
    const k2 = KANJI.filter((k) => k.level === 2);
    const p = only({
      [m]: 3,
      [r]: 3, // learned kanji
      [itemKey((k2[1] as (typeof KANJI)[number]).char, "meaning")]: 4, // reading to go
      [itemKey(w.word, "word")]: 3, // reading to go (word)
    });
    expect(lvl(p, 2)).toMatchObject({
      learned: 1,
      total: sizeOf(2),
      kanji: { learned: 1, total: kanjiCount(2) },
      words: { learned: 0, total: wordsOf(2).length },
      readingToGo: 2,
    });
    expect(lvl(p, 0).readingToGo).toBe(0);
    expect(lvl(p, 0).kanji).toEqual({ learned: 0, total: 0 });
  });
});

describe("unlock rule", () => {
  const unlocked = (p: Progress, meaning = false) =>
    applyUnlock(p, meaning ? [] : KANA, KANJI, meaning ? [] : WORDS, meaning)
      .unlockedLevel;

  it("needs every kanji and word learned, not one fewer", () => {
    const n = sizeOf(2);
    expect(unlocked(withLearned(2, n - 1))).toBe(2);
    expect(unlocked(withLearned(2, n))).toBe(3);
    // the last item a word: all kanji learned is not enough
    const kn = kanjiCount(2);
    expect(wordsOf(2).length).toBeGreaterThan(0);
    expect(unlocked(withLearned(2, kn))).toBe(2);
  });

  it("a slipped word holds the level back", () => {
    const p = withLearned(2, sizeOf(2));
    const w = wordsOf(2).find(isKanjiWord) as (typeof WORDS)[number];
    p.items[itemKey(w.word, "wordreading")] = rec(0);
    expect(unlocked(p)).toBe(2);
  });

  it("kana levels need every kana at 3", () => {
    const total = levelKeys(0, KANA, KANJI).length;
    expect(total).toBe(71);
    expect(unlocked(withLearned(0, 70))).toBe(0);
    expect(unlocked(withLearned(0, 71))).toBe(1);
  });

  it("meaning mode counts meanings only", () => {
    const n = sizeOf(2, true);
    expect(unlocked({ ...withLearned(2, n - 1, true) }, true)).toBe(2);
    expect(unlocked(withLearned(2, n, true), true)).toBe(3);
  });

  it("keeps the same object when nothing unlocks, and never lowers", () => {
    const p = withLearned(5, 0);
    expect(applyUnlock(p, KANA, KANJI, WORDS)).toBe(p);
    // slips in a passed level never re-lock it
    const q = withLearned(5, 0);
    q.items["日:meaning"] = rec(0);
    expect(applyUnlock(q, KANA, KANJI, WORDS).unlockedLevel).toBe(5);
  });

  it("stops at the last level", () => {
    const top = maxLevel(KANJI);
    expect(unlocked(withLearned(top, sizeOf(top)))).toBe(top);
  });
});

describe("placement", () => {
  it("placing at level 1 marks all kana box 4 and unlocks kanji level 2", () => {
    const p = place(defaultProgress(), 1, KANA, KANJI);
    expect(p.unlockedLevel).toBe(2);
    for (const k of KANA) expect(p.items[`${k.char}:kana`]?.box).toBe(4);
    expect(p.items["日:meaning"]).toBeUndefined();
  });

  it("placing at level N unlocks N + 1, marks readings and words, never lowers", () => {
    const start = defaultProgress();
    start.items["日:meaning"] = rec(5);
    start.items["一:meaning"] = rec(0);
    const p = place(start, 3, KANA, KANJI, WORDS);
    expect(p.unlockedLevel).toBe(4);
    expect(p.items["日:meaning"]).toEqual(rec(5));
    expect(p.items["一:meaning"]).toEqual(rec(4));
    expect(p.items["一:reading"]?.box).toBe(4);
    for (const l of [0, 1, 2, 3]) {
      const q = lvl(p, l);
      expect(q.learned).toBe(q.total);
    }
    expect(lvl(p, 4).learned).toBe(0);
  });

  it("re-picking lower undoes unanswered placement marks above it", () => {
    const high = place(defaultProgress(), 4, KANA, KANJI, WORDS);
    const firstOfLevel3 = levelKeys(3, KANA, KANJI)[0] as string;
    high.items[firstOfLevel3] = rec(2, 3); // answered after placement
    const low = place(high, 1, KANA, KANJI, WORDS);
    expect(low.unlockedLevel).toBe(2);
    expect(low.items["日:meaning"]).toBeUndefined();
    expect(low.items[firstOfLevel3]).toEqual(rec(2, 3));
    // and the next run's unlock check does not jump straight back up
    expect(applyUnlock(low, KANA, KANJI, WORDS).unlockedLevel).toBe(2);
    expect(place(high, -1, KANA, KANJI).unlockedLevel).toBe(0);
  });

  it("clamps to the last level", () => {
    expect(place(defaultProgress(), 999, KANA, KANJI).unlockedLevel).toBe(297);
  });
});

describe("words and placement", () => {
  const wordKey = (w: { word: string }) => itemKey(w.word, "word");

  it("place marks words and their readings of placed levels at box 4, never lowers", () => {
    const first = WORDS[0] as (typeof WORDS)[number]; // level 2
    const high = WORDS.find((w) => w.level === 5) as (typeof WORDS)[number];
    const p = place(defaultProgress(), 3, KANA, KANJI, WORDS);
    for (const w of WORDS) {
      expect(p.items[wordKey(w)]?.box).toBe(w.level <= 3 ? 4 : undefined);
      if (isKanjiWord(w))
        expect(p.items[itemKey(w.word, "wordreading")]?.box).toBe(
          w.level <= 3 ? 4 : undefined,
        );
    }
    expect(p.items[wordKey(first)]?.seen).toBe(0);
    const q: Progress = {
      ...defaultProgress(),
      items: { [wordKey(first)]: rec(5), [wordKey(high)]: rec(1, 2) },
    };
    const r = place(q, 4, KANA, KANJI, WORDS);
    expect(r.items[wordKey(first)]?.box).toBe(5);
  });

  it("re-placement lower removes unanswered word marks, keeps answered", () => {
    const answered = WORDS.find((w) => w.level === 4) as (typeof WORDS)[number];
    const high = place(defaultProgress(), 5, KANA, KANJI, WORDS);
    high.items[wordKey(answered)] = rec(4, 3);
    const low = place(high, 2, KANA, KANJI, WORDS);
    for (const w of WORDS) {
      if (w.level > 3 && w !== answered)
        expect(low.items[wordKey(w)]).toBeUndefined();
    }
    expect(low.items[wordKey(answered)]?.seen).toBe(3);
  });
});

describe("meaning-mode progress", () => {
  it("starts fresh at Kanji 1 (level 2) with no records", () => {
    const p = meaningProgress();
    expect(p.unlockedLevel).toBe(2);
    expect(p.items).toEqual({});
    expect(levelName(p.unlockedLevel)).toBe("Kanji 1");
  });

  it("places from Kanji 1 up and never creates kana, reading or word records", () => {
    const none = placeMeaning(meaningProgress(), 1, KANJI);
    expect(none.unlockedLevel).toBe(2);
    expect(none.items).toEqual({});
    // below the floor behaves like the floor
    expect(placeMeaning(meaningProgress(), -1, KANJI).unlockedLevel).toBe(2);
    const p = placeMeaning(meaningProgress(), 4, KANJI);
    expect(p.unlockedLevel).toBe(5);
    const keys = Object.keys(p.items);
    expect(keys.length).toBe(
      KANJI.filter((k) => k.level >= 2 && k.level <= 4).length,
    );
    expect(keys.every((k) => k.endsWith(":meaning"))).toBe(true);
  });

  it("unlocks when every meaning is learned, counting meanings only", () => {
    const keys = levelKeys(2, [], KANJI, [], true);
    expect(keys.every((k) => k.endsWith(":meaning"))).toBe(true);
    const p = meaningProgress();
    for (const key of keys) p.items[key] = rec(LEARNED_BOX);
    expect(applyUnlock(p, [], KANJI, [], true).unlockedLevel).toBe(3);
    const short = meaningProgress();
    for (const key of keys.slice(1)) short.items[key] = rec(LEARNED_BOX);
    expect(applyUnlock(short, [], KANJI, [], true).unlockedLevel).toBe(2);
  });
});

describe("levelCard", () => {
  const card = (b: Progress, a: Progress, meaning = false) =>
    levelCard(b, a, meaning ? [] : KANA, KANJI, meaning ? [] : WORDS, meaning);

  it("shows what the run added on the same level", () => {
    const c = card(withLearned(2, 10), withLearned(2, 14));
    const n = sizeOf(2);
    expect(c).toMatchObject({
      level: 2,
      learned: 14,
      total: n,
      toUnlock: n - 14,
      gained: 4,
      unlocked: null,
      last: false,
    });
    expect(c.kanji.total + c.words.total).toBe(n);
    expect(c.learnedNow).toHaveLength(4);
  });

  it("counts reading to go", () => {
    const after = withLearned(2, 0);
    const k = KANJI.find((x) => x.level === 2) as (typeof KANJI)[number];
    after.items[itemKey(k.char, "meaning")] = rec(4);
    after.items[itemKey(k.char, "reading")] = rec(1);
    expect(card(withLearned(2, 0), after).readingToGo).toBe(1);
  });

  it("lists nothing learned when nothing was", () => {
    const p = withLearned(2, 10);
    expect(card(p, p).learnedNow).toEqual([]);
  });

  it("lists the items that finished the old level on an unlock", () => {
    const n = sizeOf(2);
    const after = applyUnlock(withLearned(2, n), KANA, KANJI, WORDS);
    const c = card(withLearned(2, n - 1), after);
    expect(c.learnedNow).toHaveLength(1);
    expect(c.unlocked).toBe(3);
  });

  it("has no gain when nothing was learned", () => {
    const p = withLearned(2, 10);
    const c = card(p, p);
    expect(c.gained).toBe(0);
    expect(c.learned).toBe(10);
  });

  it("never reports a negative gain", () => {
    expect(card(withLearned(2, 10), withLearned(2, 8)).gained).toBe(0);
  });

  it("shows the new level with its own numbers after an unlock", () => {
    const n = sizeOf(2);
    const after = applyUnlock(withLearned(2, n), KANA, KANJI, WORDS);
    expect(card(withLearned(2, n - 1), after)).toMatchObject({
      level: 3,
      learned: 0,
      total: sizeOf(3),
      toUnlock: sizeOf(3),
      gained: 0,
      unlocked: 3,
      last: false,
    });
  });

  it("marks the last level", () => {
    const top = maxLevel(KANJI);
    expect(card(withLearned(top, 1), withLearned(top, 3))).toMatchObject({
      level: top,
      gained: 2,
      last: true,
    });
  });

  it("counts meaning mode by kanji meanings, with no kana or words", () => {
    const c = card(meaningProgress(), withLearned(2, 5, true), true);
    expect(c).toMatchObject({
      level: 2,
      learned: 5,
      total: kanjiCount(2),
      gained: 5,
      unlocked: null,
      readingToGo: 0,
    });
  });
});
