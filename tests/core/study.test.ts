import { describe, expect, it } from "vitest";
import { KANA } from "../../src/core/kana";
import { KANJI } from "../../src/core/kanji";
import { buildRun, missedItems } from "../../src/core/run";
import { defaultProgress, recordRun } from "../../src/core/srs";
import {
  canStudy,
  lastAnswer,
  runKanji,
  storiesWithFallback,
  studyCards,
} from "../../src/core/study";
import type { GateRow, KanjiItem, Progress } from "../../src/core/types";

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
        if (c.kind === "kana") expect([c.romaji]).toEqual(m.answers);
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
        expect(c.mnemonics).toEqual({ meaning: "m", reading: "r" });
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
