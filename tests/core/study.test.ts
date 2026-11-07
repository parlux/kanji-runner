import { describe, expect, it } from "vitest";
import { KANA } from "../../src/core/kana";
import { KANJI } from "../../src/core/kanji";
import { buildRun, missedItems } from "../../src/core/run";
import { defaultProgress, recordRun } from "../../src/core/srs";
import { studyCards } from "../../src/core/study";
import type { KanjiItem, Progress } from "../../src/core/types";

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

  it("never changes progress", () => {
    const before = recordRun(progress, rows, results, false, 5);
    const snapshot = JSON.stringify(before);
    studyCards(missed, KANJI, KANA);
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});
