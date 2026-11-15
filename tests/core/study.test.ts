import { describe, expect, it } from "vitest";
import { KANA } from "../../src/core/kana";
import { KANJI } from "../../src/core/kanji";
import { buildRun, missedItems } from "../../src/core/run";
import { defaultProgress, recordRun } from "../../src/core/srs";
import {
  type Story,
  canStudy,
  lastAnswer,
  presentedReadings,
  runKanji,
  storiesWithFallback,
  studyCards,
  wordBreakdown,
} from "../../src/core/study";
import type {
  GateRow,
  KanjiItem,
  Progress,
  WordItem,
} from "../../src/core/types";

const progress: Progress = { ...defaultProgress(), unlockedLevel: 3 };
const rows = [
  ...buildRun(7, defaultProgress(), KANA, KANJI),
  ...buildRun(8, progress, [], KANJI),
];
const results = rows.map((_, i) => i % 3 !== 0);
const missed = missedItems(rows, results, [], KANJI);

describe("studyCards", () => {
  it("matches missedItems: same items, order, answers (deduped)", () => {
    const cards = studyCards(missed, KANJI, KANA);
    const first = [...new Set(missed.map((m) => m.prompt))];
    expect(cards.map((c) => c.char)).toEqual(first);
    for (const c of cards) {
      const ms = missed.filter((m) => m.prompt === c.char);
      for (const m of ms) {
        if (c.kind === "word") throw new Error("no words here");
        else if (c.kind === "kana") expect([c.romaji]).toEqual(m.answers);
        else if (m.type === "meaning")
          expect([c.meanings[0]]).toEqual(m.answers);
        else
          expect([c.on, c.kun].filter((x): x is string => x !== null)).toEqual(
            m.answers,
          );
      }
    }
  });

  it("covers both kana and kanji cards", () => {
    const kinds = new Set(studyCards(missed, KANJI, KANA).map((c) => c.kind));
    expect(kinds).toEqual(new Set(["kana", "kanji"]));
  });

  it("gives one card for an item missed twice, at its first position", () => {
    const k = KANJI[0] as KanjiItem;
    const m = (q: number, type: "meaning" | "reading") => ({
      q,
      type,
      prompt: k.char,
      answers: [],
      charge: false,
    });
    const other = KANJI[1] as KanjiItem;
    const cards = studyCards(
      [
        m(1, "meaning"),
        { ...m(2, "meaning"), prompt: other.char },
        m(3, "reading"),
      ],
      KANJI,
      KANA,
    );
    expect(cards.map((c) => c.char)).toEqual([k.char, other.char]);
  });

  it("attaches mnemonics by character, kanji cards only", () => {
    const chars = new Set(
      missed.filter((m) => m.type !== "kana").map((m) => m.prompt),
    );
    const c0 = [...chars][0] as string;
    const cards = studyCards(
      missed,
      KANJI,
      KANA,
      new Map([[c0, { meaning: "synthetic <em>m</em>" }]]),
    );
    for (const c of cards)
      expect(c.kind === "kanji" ? c.mnemonics : undefined).toEqual(
        c.char === c0 ? { meaning: "synthetic <em>m</em>" } : undefined,
      );
  });

  it("attaches stories and radicals from a lookup; others stay today's card", () => {
    const chars = [
      ...new Set(missed.filter((m) => m.type !== "kana").map((m) => m.prompt)),
    ];
    const c0 = chars[0] as string;
    const rad = {
      char: null,
      name: "squig",
      image: "https://example.invalid/a.svg",
    };
    const plain = studyCards(missed, KANJI, KANA);
    const cards = studyCards(
      missed,
      KANJI,
      KANA,
      new Map([[c0, { meaning: "m", reading: "r", radicals: [rad] }]]),
    );
    expect(cards).toHaveLength(plain.length);
    cards.forEach((c, i) => {
      if (c.kind === "kanji" && c.char === c0) {
        expect(c.mnemonics).toEqual({ meaning: "m" });
        expect(c.readingStories).toEqual([
          { reading: "", source: "kanji", text: "r" },
        ]);
        expect(c.radicals).toEqual([rad]);
      } else expect(c).toEqual(plain[i]);
    });
  });

  it("ignores an empty story: the card equals today's", () => {
    const c0 = missed.find((m) => m.type !== "kana")?.prompt as string;
    expect(
      studyCards(missed, KANJI, KANA, new Map([[c0, { radicals: [] }]])),
    ).toEqual(studyCards(missed, KANJI, KANA));
  });

  it("marks every card from misses as missed", () => {
    for (const c of studyCards(missed, KANJI, KANA))
      expect(c.missed).toBe(true);
  });

  it("adds the run's other kanji after the misses, unmarked, without kana", () => {
    const seen = runKanji(rows, results);
    const cards = studyCards(missed, KANJI, KANA, undefined, seen);
    const missedChars = [...new Set(missed.map((m) => m.prompt))];
    const rest = seen.filter(
      (c) => !missed.some((m) => m.type !== "kana" && m.prompt === c),
    );
    expect(cards.map((c) => c.char)).toEqual([...missedChars, ...rest]);
    expect(rest.length).toBeGreaterThan(0);
    for (const c of cards.slice(missedChars.length)) {
      expect(c.kind).toBe("kanji");
      expect(c.missed).toBe(false);
    }
  });

  it("never changes progress", () => {
    const before = recordRun(progress, rows, results, false, 5);
    const snapshot = JSON.stringify(before);
    studyCards(missed, KANJI, KANA);
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});

describe("runKanji", () => {
  it("lists answered kanji gates once, in order, skipping kana and unanswered rows", () => {
    const answered = results.slice(0, 10);
    const expected = [
      ...new Set(
        rows
          .slice(0, 10)
          .filter((r) => r.type !== "kana")
          .map((r) => r.prompt),
      ),
    ];
    expect(runKanji(rows, answered)).toEqual(expected);
  });
});

describe("canStudy", () => {
  it("is offered after a loss, and after a win only with a card", () => {
    expect(canStudy(0, false)).toBe(true);
    expect(canStudy(0, true)).toBe(false);
    expect(canStudy(3, true)).toBe(true);
  });
});

describe("storiesWithFallback", () => {
  const lib = new Map([
    [
      "a",
      { meaning: "lib-m", radicals: [{ char: "x", name: "ex", image: null }] },
    ],
    ["b", { reading: "lib-r" }],
  ]);
  const taught = new Map([
    ["a", { meaning: "t-m", reading: "t-r" }],
    ["c", { meaning: "t-c" }],
  ]);

  it("returns the library untouched without taught mnemonics", () => {
    expect(storiesWithFallback(lib, undefined)).toBe(lib);
    expect(storiesWithFallback(undefined, undefined)).toBeUndefined();
  });

  it("prefers library text, fills gaps from taught, keeps radicals", () => {
    const m = storiesWithFallback(lib, taught);
    expect(m?.get("a")).toEqual({
      meaning: "lib-m",
      reading: "t-r",
      radicals: lib.get("a")?.radicals,
    });
    expect(m?.get("b")).toEqual({ reading: "lib-r" });
    expect(m?.get("c")).toEqual({ meaning: "t-c" });
  });

  it("uses taught mnemonics alone when there is no library", () => {
    expect(storiesWithFallback(undefined, taught)?.get("c")).toEqual({
      meaning: "t-c",
    });
  });
});

describe("lastAnswer", () => {
  it("is null before the first answer", () => {
    expect(lastAnswer(rows, [], 0, KANJI, KANA)).toBeNull();
  });

  it("shows the last resolved row, the pick and the answer", () => {
    for (const n of [1, 5, rows.length]) {
      const row = rows[n - 1] as GateRow;
      const res = results.slice(0, n);
      const wrong = (row.answerIndex + 1) % row.options.length;
      const choice = res[n - 1] ? row.answerIndex : wrong;
      const last = lastAnswer(rows, res, choice, KANJI, KANA);
      expect(last).toMatchObject({
        type: row.type,
        prompt: row.prompt,
        picked: row.options[choice],
        answer: row.answer,
        correct: res[n - 1],
      });
      expect(last?.card?.char).toBe(row.prompt);
    }
  });

  it("gives a kanji card marked missed only when wrong, with its story", () => {
    const i = rows.findIndex((r) => r.type !== "kana");
    const row = rows[i] as GateRow;
    const stories = new Map([[row.prompt, { meaning: "m" }]]);
    const res = (ok: boolean) => [...results.slice(0, i), ok];
    const right = lastAnswer(
      rows,
      res(true),
      row.answerIndex,
      KANJI,
      KANA,
      stories,
    );
    const wrong = lastAnswer(rows, res(false), 0, KANJI, KANA, stories);
    expect(right?.card).toMatchObject({ kind: "kanji", missed: false });
    expect(wrong?.card).toMatchObject({ kind: "kanji", missed: true });
    expect(right?.card?.kind === "kanji" && right.card.mnemonics).toEqual({
      meaning: "m",
    });
  });
});

describe("word cards", () => {
  const words: WordItem[] = [
    { word: "コーヒー", glosses: ["coffee"], level: 2 },
    { word: "ジャズ", glosses: ["jazz"], level: 2 },
    { word: "ホッチキス", glosses: ["stapler"], level: 2 },
  ];
  const wrows: GateRow[] = words.map((w) => ({
    type: "word",
    prompt: w.word,
    options: [w.glosses[0] ?? "", "x"],
    answer: w.glosses[0] ?? "",
    answerIndex: 0,
  }));

  it("breaks a word into romaji per character, with ー and small kana", () => {
    const [c] = studyCards(
      missedItems(wrows, [false], [], KANJI),
      KANJI,
      KANA,
      undefined,
      [],
      words,
    );
    expect(c).toEqual({
      kind: "word",
      char: "コーヒー",
      meanings: ["coffee"],
      breakdown: [
        { char: "コ", note: "ko" },
        { char: "ー", note: "(long)" },
        { char: "ヒ", note: "hi" },
        { char: "ー", note: "(long)" },
      ],
      missed: true,
    });
    expect(wordBreakdown("ジャ", KANA)).toEqual([
      { char: "ジ", note: "ji" },
      { char: "ャ", note: "ya (small)" },
    ]);
    expect(wordBreakdown("ホッチ", KANA)[1]).toEqual({
      char: "ッ",
      note: "(double next)",
    });
  });

  it("skips unknown words, dedupes, and keeps words out of runKanji", () => {
    expect(
      studyCards(missedItems(wrows, [false], [], KANJI), KANJI, KANA),
    ).toEqual([]);
    expect(runKanji(wrows, [true, true, true])).toEqual([]);
  });

  it("gives the pause card a word card, missed when wrong", () => {
    const a = lastAnswer(
      wrows,
      [true, false],
      1,
      KANJI,
      KANA,
      undefined,
      words,
    );
    expect(a?.card).toMatchObject({
      kind: "word",
      char: "ジャズ",
      missed: true,
    });
    const b = lastAnswer(wrows, [true], 0, KANJI, KANA, undefined, words);
    expect(b?.card).toMatchObject({ kind: "word", missed: false });
  });
});

describe("reading stories", () => {
  const k = (over: Partial<KanjiItem> = {}): KanjiItem => ({
    ...(KANJI[0] as KanjiItem),
    char: "X",
    on: "じょう",
    kun: { base: "あ", okurigana: "げる" },
    ...over,
  });
  const kanji = k();
  const row = (type: GateRow["type"], answer: string): GateRow => ({
    type,
    prompt: "X",
    options: [answer],
    answerIndex: 0,
    answer,
  });
  const card = (
    story: Story | undefined,
    presented: string[],
    item: KanjiItem = kanji,
  ) => {
    const c = studyCards(
      [{ type: "reading", prompt: "X", answers: [] } as never],
      [item],
      KANA,
      story ? new Map([["X", story]]) : undefined,
      [],
      [],
      new Map([["X", presented]]),
    )[0];
    return c?.kind === "kanji" ? c : undefined;
  };
  const kstory = "<reading>Joe</reading> (じょう) story";
  const vocab = [
    { word: "X", readings: ["うえ", "あげる"], story: "v-bare" },
    { word: "Xげる", readings: ["あげる"], story: "v-okuri" },
  ];

  it("presentedReadings: per kanji, in order, reading gates only", () => {
    const rs = [
      row("reading", "じょう"),
      row("meaning", "up"),
      row("reading", "あ(げる)"),
      row("reading", "じょう"),
      row("reading", "later"),
    ];
    expect(presentedReadings(rs, [true, true, true, true]).get("X")).toEqual([
      "じょう",
      "あ(げる)",
    ]);
    expect(presentedReadings(rs, [true, true]).size).toBe(1);
    expect(presentedReadings(rs, [true, true]).get("X")).toEqual(["じょう"]);
  });

  it("covered on'yomi shows the kanji story", () => {
    expect(card({ reading: kstory }, ["じょう"])?.readingStories).toEqual([
      { reading: "じょう", source: "kanji", text: kstory },
    ]);
  });

  it("uncovered kun takes the vocabulary story, preferring the okurigana word", () => {
    const c = card({ reading: kstory, vocab }, ["あ(げる)"]);
    expect(c?.readingStories).toEqual([
      { reading: "あ(げる)", source: { word: "Xげる" }, text: "v-okuri" },
    ]);
  });

  it("matches vocabulary by base and falls back to any match", () => {
    const only = [vocab[0] as (typeof vocab)[number]];
    expect(
      card({ reading: kstory, vocab: only }, ["あ(げる)"])?.readingStories,
    ).toEqual([{ reading: "あ(げる)", source: { word: "X" }, text: "v-bare" }]);
  });

  it("on'yomi only match the bare kanji vocabulary", () => {
    const v = [{ word: "Xげる", readings: ["じょう"], story: "x" }];
    expect(
      card({ reading: "no bracket", primaryReadings: [], vocab: v }, ["じょう"])
        ?.readingStories,
    ).toEqual([{ reading: "じょう", none: true }]);
  });

  it("a covered base counts: あ covers あ(げる)", () => {
    const s = "<reading>A</reading> (あ) story";
    expect(card({ reading: s }, ["あ(げる)"])?.readingStories).toEqual([
      { reading: "あ(げる)", source: "kanji", text: s },
    ]);
  });

  it("no match gives the none block", () => {
    expect(card({ reading: kstory }, ["あ(げる)"])?.readingStories).toEqual([
      { reading: "あ(げる)", none: true },
    ]);
  });

  it("a story with no bracket falls back to primary readings", () => {
    expect(
      card({ reading: "plain", primaryReadings: ["じょう"] }, ["じょう"])
        ?.readingStories,
    ).toEqual([{ reading: "じょう", source: "kanji", text: "plain" }]);
    expect(
      card({ reading: "plain", primaryReadings: ["じょう"] }, ["あ(げる)"])
        ?.readingStories,
    ).toEqual([{ reading: "あ(げる)", none: true }]);
  });

  it("two presented readings give two blocks in order", () => {
    const c = card({ reading: kstory, vocab }, ["あ(げる)", "じょう"]);
    expect(c?.readingStories?.map((r) => r.reading)).toEqual([
      "あ(げる)",
      "じょう",
    ]);
  });

  it("a meaning-only kanji gets its own story headed by a covered main reading", () => {
    expect(card({ reading: kstory }, [])?.readingStories).toEqual([
      { reading: "じょう", source: "kanji", text: kstory },
    ]);
    expect(card({ reading: "plain" }, [])?.readingStories).toEqual([
      { reading: "", source: "kanji", text: "plain" },
    ]);
  });

  it("no story at all keeps today's card", () => {
    expect(card(undefined, ["じょう"])).toEqual(
      studyCards(
        [{ type: "reading", prompt: "X", answers: [] } as never],
        [kanji],
        KANA,
      )[0],
    );
    expect(card({}, ["じょう"])?.readingStories).toBeUndefined();
  });

  it("taught-cache fallback: covered reading shows, uncovered shows none", () => {
    const m = storiesWithFallback(
      undefined,
      new Map([["X", { reading: kstory }]]),
    );
    const c = studyCards(
      [],
      [kanji],
      KANA,
      m,
      ["X"],
      [],
      new Map([["X", ["あ(げる)"]]]),
    )[0];
    expect(c?.kind === "kanji" && c.readingStories).toEqual([
      { reading: "あ(げる)", none: true },
    ]);
  });

  it("lastAnswer: pause on a reading gate shows only that reading; meaning gate shows the own story", () => {
    const stories = new Map([["X", { reading: kstory, vocab }]]);
    const a = lastAnswer(
      [row("reading", "あ(げる)")],
      [true],
      0,
      [kanji],
      KANA,
      stories,
    );
    expect(a?.card?.kind === "kanji" && a.card.readingStories).toEqual([
      { reading: "あ(げる)", source: { word: "Xげる" }, text: "v-okuri" },
    ]);
    const b = lastAnswer(
      [row("meaning", "up")],
      [true],
      0,
      [kanji],
      KANA,
      stories,
    );
    expect(b?.card?.kind === "kanji" && b.card.readingStories).toEqual([
      { reading: "じょう", source: "kanji", text: kstory },
    ]);
  });
});
