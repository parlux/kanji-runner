import { describe, expect, it } from "vitest";
import { mainReadings, showReading } from "../../src/core/distractors";
import { KANA } from "../../src/core/kana";
import { KANJI } from "../../src/core/kanji";
import { buildRun, missedItems } from "../../src/core/run";
import { defaultProgress, recordRun } from "../../src/core/srs";
import type { Missed } from "../../src/core/run";
import {
  type Dictionary,
  type StudyCard,
  type Story,
  canStudy,
  itemCard,
  lastAnswer,
  presentedReadings,
  runKanji,
  stageLine,
  storiesWithFallback,
  studyCards,
  withStages,
  wordBreakdown,
} from "../../src/core/study";
import type {
  GateRow,
  KanjiItem,
  Progress,
  WordItem,
} from "../../src/core/types";
import { NOW } from "../now";

const progress: Progress = { ...defaultProgress(), unlockedLevel: 3 };
const rows = [
  ...buildRun(7, defaultProgress(), NOW, KANA, KANJI),
  ...buildRun(8, progress, NOW, [], KANJI),
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
        expect(c.readingStories?.length).toBeGreaterThan(0);
        expect(c.readingStories?.every((r) => r.reading !== "")).toBe(true);
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
    { word: "コーヒー", kind: "loanword", glosses: ["coffee"], level: 2 },
    { word: "ジャズ", kind: "loanword", glosses: ["jazz"], level: 2 },
    { word: "ホッチキス", kind: "loanword", glosses: ["stapler"], level: 2 },
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

  describe("compounds", () => {
    const compounds = [
      {
        reading: "じょう",
        word: "XY",
        wordReading: "じょうず",
        story: "c-jou",
      },
      { reading: "あげる", word: "XZ", wordReading: "あげる", story: "c-kun" },
    ];
    const none = "no bracket";
    it("uncovered on'yomi takes the compound with its wordReading", () => {
      expect(
        card({ reading: none, primaryReadings: [], compounds }, ["じょう"])
          ?.readingStories,
      ).toEqual([
        {
          reading: "じょう",
          source: { word: "XY", wordReading: "じょうず" },
          text: "c-jou",
        },
      ]);
    });
    it("kanji story and bare-kanji vocabulary win over a compound", () => {
      expect(
        card({ reading: kstory, compounds }, ["じょう"])?.readingStories,
      ).toEqual([{ reading: "じょう", source: "kanji", text: kstory }]);
      const v = [{ word: "X", readings: ["じょう"], story: "v-bare" }];
      expect(
        card({ reading: none, primaryReadings: [], vocab: v, compounds }, [
          "じょう",
        ])?.readingStories,
      ).toEqual([{ reading: "じょう", source: { word: "X" }, text: "v-bare" }]);
    });
    it("kun'yomi never use compounds", () => {
      expect(
        card({ reading: none, primaryReadings: [], compounds }, ["あ(げる)"])
          ?.readingStories,
      ).toEqual([{ reading: "あ(げる)", none: true }]);
    });
    it("no compounds gives none", () => {
      expect(
        card({ reading: none, primaryReadings: [] }, ["じょう"])
          ?.readingStories,
      ).toEqual([{ reading: "じょう", none: true }]);
    });
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

  it("a meaning-only kanji gets one block per main reading", () => {
    const c = card({ reading: kstory, vocab }, []);
    expect(c?.readingStories?.map((r) => r.reading)).toEqual(
      mainReadings(kanji).map(showReading),
    );
    expect(c?.readingStories?.[0]).toEqual({
      reading: "じょう",
      source: "kanji",
      text: kstory,
    });
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
    expect(
      b?.card?.kind === "kanji" && b.card.readingStories?.map((r) => r.reading),
    ).toEqual(mainReadings(kanji).map(showReading));
  });
});

describe("studyCards with our dictionary", () => {
  const ori = KANJI.find((k) => k.char === "折") as KanjiItem;
  const dict: Dictionary = {
    parts: new Map([
      ["斤", "axe"],
      ["⺘", "reaching hand"],
    ]),
    entries: new Map([
      [
        "折",
        {
          meaning: "<part>axe</part> m",
          on: "<reading>せつ</reading> o",
          kun: "<reading>おり</reading> k",
        },
      ],
    ]),
  };
  const miss = (type: "meaning" | "reading", prompt = "折"): Missed => ({
    q: 1,
    type,
    prompt,
    answers: [],
    charge: false,
  });
  const card = (c: StudyCard | undefined) =>
    c?.kind === "kanji" ? c : (undefined as never);

  it("ours beats the library; parts carry names; headings flag own", () => {
    const lib = new Map([["折", { meaning: "wk", radicals: [] }]]);
    const c = card(
      studyCards(
        [miss("meaning")],
        KANJI,
        KANA,
        lib,
        [],
        [],
        undefined,
        dict,
      )[0],
    );
    expect(c.own).toBe(true);
    expect(c.mnemonics).toEqual({ meaning: "<part>axe</part> m" });
    expect(c.radicals).toBeUndefined();
    expect(c.parts).toEqual([
      { char: "⺘", name: "reaching hand" },
      { char: "斤", name: "axe" },
    ]);
  });

  it("reading blocks follow the presented labels", () => {
    const rs = (labels: string[]) =>
      card(
        studyCards(
          [miss("reading")],
          KANJI,
          KANA,
          undefined,
          [],
          [],
          new Map([["折", labels]]),
          dict,
        )[0],
      ).readingStories;
    expect(rs(["せつ"])).toEqual([
      { reading: "せつ", source: "kanji", text: "<reading>せつ</reading> o" },
    ]);
    expect(rs(["おり"])?.[0]).toMatchObject({
      text: "<reading>おり</reading> k",
    });
    expect(rs(["せつ", "おり"])).toHaveLength(2);
    // a non-main reading gets the "no story" line
    expect(rs(["しゃく"])).toEqual([{ reading: "しゃく", none: true }]);
    // no reading presented (meaning gate): one block per main reading
    expect(
      card(
        studyCards(
          [miss("meaning")],
          KANJI,
          KANA,
          undefined,
          [],
          [],
          undefined,
          dict,
        )[0],
      ).readingStories?.map((r) => r.reading),
    ).toEqual(mainReadings(ori).map(showReading));
  });

  it("a kanji with no components has no parts row", () => {
    const one = KANJI.find((k) => k.components.length === 0) as KanjiItem;
    const d: Dictionary = {
      parts: new Map(),
      entries: new Map([[one.char, { meaning: "m" }]]),
    };
    const c = card(
      studyCards(
        [miss("meaning", one.char)],
        KANJI,
        KANA,
        undefined,
        [],
        [],
        undefined,
        d,
      )[0],
    );
    expect(c.own).toBe(true);
    expect(c.parts).toBeUndefined();
  });

  it("no entry: today's card, or the library's", () => {
    const empty: Dictionary = { parts: new Map(), entries: new Map() };
    const today = studyCards([miss("meaning")], KANJI, KANA);
    expect(
      studyCards(
        [miss("meaning")],
        KANJI,
        KANA,
        undefined,
        [],
        [],
        undefined,
        empty,
      ),
    ).toEqual(today);
    const lib = new Map([["折", { meaning: "wk" }]]);
    const c = card(
      studyCards(
        [miss("meaning")],
        KANJI,
        KANA,
        lib,
        [],
        [],
        undefined,
        empty,
      )[0],
    );
    expect(c.own).toBeUndefined();
    expect(c.mnemonics).toEqual({ meaning: "wk" });
  });

  it("the pause card uses ours too", () => {
    const rows: GateRow[] = [
      {
        type: "reading",
        prompt: "折",
        options: ["せつ", "x"],
        answer: "せつ",
      } as GateRow,
    ];
    const la = lastAnswer(rows, [true], 0, KANJI, KANA, undefined, [], dict);
    expect(la?.card?.kind === "kanji" && la.card.own).toBe(true);
  });
});

describe("withStages / stageLine", () => {
  const prog = (items: Record<string, number>): Progress => ({
    ...defaultProgress(),
    items: Object.fromEntries(
      Object.entries(items).map(([k, box]) => [k, { box } as never]),
    ),
  });
  const kanji = studyCards([], KANJI, KANA, undefined, [KANJI[0]?.char ?? ""]);
  const char = KANJI[0]?.char ?? "";
  const kana: StudyCard = {
    kind: "kana",
    char: "あ",
    romaji: "a",
    script: "hiragana",
    missed: true,
  };
  const loan: StudyCard = {
    kind: "word",
    char: "ビル",
    meanings: ["building"],
    breakdown: [],
    missed: true,
  };
  const kword: StudyCard = { ...loan, char: "人々", reading: "ひとびと" };

  it("kanji and kanji words show meaning and reading", () => {
    const p = prog({
      [`${char}:meaning`]: 2,
      [`${char}:reading`]: 0,
      "人々:word": 3,
    });
    const [k, w] = withStages([...kanji, kword], p, false);
    expect(stageLine(k as StudyCard)).toBe("Meaning: Recalled · Reading: New");
    expect(stageLine(w as StudyCard)).toBe("Meaning: Learned · Reading: New");
  });

  it("kana, loanwords and meaning-mode kanji show one stage", () => {
    const p = prog({ "あ:kana": 1, "ビル:word": 5, [`${char}:meaning`]: 4 });
    const [a, b] = withStages([kana, loan], p, false);
    expect(stageLine(a as StudyCard)).toBe("Stage: Met");
    expect(stageLine(b as StudyCard)).toBe("Stage: Solid");
    const [m] = withStages(kanji, p, true);
    expect(stageLine(m as StudyCard)).toBe("Stage: Strong");
  });

  it("a card without boxes has no line", () => {
    expect(stageLine(kana)).toBeNull();
  });
});

describe("itemCard", () => {
  const char = KANJI[0]?.char ?? "";
  it("builds an unmissed card for a kanji and a kana", () => {
    const k = itemCard({ key: char, kind: "kanji" }, KANJI, KANA);
    expect(k).toMatchObject({ kind: "kanji", char, missed: false });
    const a = itemCard({ key: "あ", kind: "kana" }, KANJI, KANA);
    expect(a).toMatchObject({ kind: "kana", char: "あ", missed: false });
  });
  it("builds word cards and returns null for unknown items", () => {
    const w: WordItem = {
      word: "人々",
      reading: "ひとびと",
      glosses: ["people"],
      level: 1,
    } as WordItem;
    expect(
      itemCard({ key: "人々", kind: "word" }, KANJI, KANA, undefined, [w]),
    ).toMatchObject({ kind: "word", reading: "ひとびと", missed: false });
    expect(itemCard({ key: "zz", kind: "kanji" }, KANJI, KANA)).toBeNull();
    expect(itemCard({ key: "zz", kind: "loanword" }, KANJI, KANA)).toBeNull();
  });
});
