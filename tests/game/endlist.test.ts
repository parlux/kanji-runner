import { describe, expect, it } from "vitest";
import { levelCard, place } from "../../src/core/progression";
import { KANA } from "../../src/core/kana";
import { KANJI } from "../../src/core/kanji";
import { WORDS } from "../../src/core/words";
import { defaultProgress } from "../../src/core/srs";
import type { RunItem } from "../../src/core/runitems";
import type { LevelPage, LevelPageItem } from "../../src/core/levelpage";
import {
  answerText,
  changeText,
  endEntries,
  endListArea,
  endListHit,
  endListLayout,
  type EndEntry,
  rowTone,
  truncate,
} from "../../src/game/endlist";

const item = (over: Partial<RunItem> = {}): RunItem => ({
  key: "日",
  kind: "kanji",
  meaning: "sun",
  change: "up",
  gates: [{ gate: "reading", from: 3, to: 4, missed: false }],
  ...over,
});
const entry = (over: Partial<EndEntry> = {}): EndEntry => ({
  key: "日",
  kind: "kanji",
  meaning: "sun",
  section: "missing",
  stages: "M Met · R New",
  ...over,
});
const many = (n: number): EndEntry[] =>
  Array.from({ length: n }, (_, i) => entry({ key: String(i) }));

const fullCard = (() => {
  const before = place(defaultProgress(), 0, KANA, KANJI, WORDS);
  return {
    ...levelCard(before, before, KANA, KANJI, WORDS, false),
    learnedNow: ["日"],
  };
})();

const pageItem = (
  key: string,
  learned: boolean,
  kind: LevelPageItem["kind"] = "kanji",
): LevelPageItem => ({
  key,
  kind,
  meaning: `m-${key}`,
  stages: learned ? "M Learned · R Learned" : "M Met · R New",
  learned,
});
const page = (items: LevelPageItem[]): LevelPage => ({
  level: 3,
  title: "Kanji 2",
  learned: items.filter((i) => i.learned).length,
  total: items.length,
  readingToGo: 0,
  locked: false,
  items: [
    ...items.filter((i) => !i.learned),
    ...items.filter((i) => i.learned),
  ],
});

describe("endEntries", () => {
  const lv = page([
    pageItem("一", false),
    pageItem("二", true),
    pageItem("三", false),
    pageItem("一つ", true, "word"),
  ]);

  it("missing in teaching order, then learned, then the run's other items in run order", () => {
    const run = [
      item({ key: "九", change: "new" }),
      item({ key: "三", change: "up" }),
      item({ key: "あ", kind: "kana", change: "same" }),
    ];
    const e = endEntries(lv, run);
    expect(e.map((x) => [x.key, x.section])).toEqual([
      ["一", "missing"],
      ["三", "missing"],
      ["二", "learned"],
      ["一つ", "learned"],
      ["九", "also"],
      ["あ", "also"],
    ]);
  });

  it("this run's change only on rows met this run", () => {
    const up = item({ key: "二" });
    const e = endEntries(lv, [up]);
    expect(e.find((x) => x.key === "二")?.met).toBe(up);
    expect(e.filter((x) => x.met).map((x) => x.key)).toEqual(["二"]);
    expect(e.find((x) => x.key === "一")?.stages).toBe("M Met · R New");
  });

  it("matches by kind too: a word that looks like a level kanji is another item", () => {
    const word = item({ key: "三", kind: "word" });
    const e = endEntries(lv, [word]);
    expect(e.find((x) => x.section === "also")?.met).toBe(word);
    expect(e.find((x) => x.key === "三" && x.section === "missing")?.met).toBe(
      undefined,
    );
  });
});

describe("endListLayout", () => {
  it("labels each non-empty section with its count", () => {
    const l = endListLayout(0, 800, [
      entry(),
      entry({ key: "a", section: "learned" }),
      entry({ key: "b", section: "learned" }),
      entry({ key: "c", section: "also" }),
    ]);
    expect(l.labels.map((x) => x.text)).toEqual([
      "Missing 1",
      "Learned 2",
      "Also this run",
    ]);
    // labels sit above their rows, never on them
    const [, learned] = l.labels;
    expect(learned?.y).toBeLessThan(l.rows[1]?.y ?? 0);
    expect(learned?.y).toBeGreaterThan(l.rows[0]?.y ?? 0);
  });

  it("the level's 15 at 390x844: rows at least 30 px, the rest scrolls", () => {
    const a = endListArea(390, 844, fullCard, true);
    const l = endListLayout(a.top, a.bottom, [
      ...many(10),
      ...many(5).map((e) => ({ ...e, section: "learned" as const })),
    ]);
    expect(l.rows.every((r) => r.h >= 30)).toBe(true);
    expect(l.maxScroll).toBe(l.content - (a.bottom - a.top));
  });

  it("compact rows go down to 24 px", () => {
    const a = endListArea(390, 700, fullCard, true);
    const l = endListLayout(a.top, a.bottom, many(30), true);
    expect(l.rows.every((r) => r.h >= 24)).toBe(true);
    expect(l.rows[0]?.h).toBe(24);
  });

  it("rows stack without overlap; few rows stay at most 32 px", () => {
    const l = endListLayout(100, 600, many(3));
    expect(l.rows.map((r) => r.h)).toEqual([32, 32, 32]);
    const [a, b] = l.rows;
    expect((a?.y ?? 0) + (a?.h ?? 0)).toBeLessThanOrEqual(b?.y ?? 0);
  });

  it("a row with a missed reading is taller (its answer line)", () => {
    const slip = item({
      change: "slip",
      gates: [
        { gate: "reading", from: 3, to: 2, missed: true, answers: ["a"] },
      ],
    });
    const l = endListLayout(0, 400, [entry({ met: slip }), entry()]);
    expect(l.rows[0]?.h).toBeGreaterThan(l.rows[1]?.h ?? 0);
  });
});

describe("endListHit", () => {
  const l = endListLayout(100, 400, many(30));
  const mid = (i: number): number =>
    100 + (l.rows[i]?.y ?? 0) + (l.rows[i]?.h ?? 0) / 2;

  it("a tap on a row gives that row's entry, respecting the scroll", () => {
    expect(endListHit(l, 0, 390, 20, 195, mid(0))?.key).toBe("0");
    const dy = (l.rows[3]?.y ?? 0) - (l.rows[0]?.y ?? 0);
    expect(endListHit(l, dy, 390, 20, 195, mid(0))?.key).toBe("3");
  });

  it("nothing off the list area, on a label or outside the rows' edges", () => {
    expect(endListHit(l, 0, 390, 20, 195, 99)).toBeNull();
    expect(endListHit(l, 0, 390, 20, 195, 401)).toBeNull();
    expect(
      endListHit(l, 0, 390, 20, 195, 100 + (l.labels[0]?.y ?? 0)),
    ).toBeNull();
    expect(endListHit(l, 0, 390, 20, 10, mid(0))).toBeNull();
    expect(endListHit(l, 0, 390, 20, 385, mid(0))).toBeNull();
  });
});

describe("row text", () => {
  it("one gate: the stage change, or the stage alone when it didn't move", () => {
    expect(changeText(item())).toBe("Learned → Strong");
    expect(
      changeText(
        item({
          change: "new",
          gates: [{ gate: "meaning", from: 0, to: 1, missed: false }],
        }),
      ),
    ).toBe("New → Met");
    expect(
      changeText(
        item({
          change: "same",
          gates: [{ gate: "meaning", from: 4, to: 4, missed: false }],
        }),
      ),
    ).toBe("Strong");
  });

  it("both gates asked get M and R labels", () => {
    const both = item({
      gates: [
        { gate: "reading", from: 0, to: 1, missed: false },
        { gate: "meaning", from: 1, to: 2, missed: false },
      ],
    });
    expect(changeText(both)).toBe("M Met → Recalled · R New → Met");
  });

  it("a missed gate shows its answer and the bad tone, even when the box held", () => {
    const miss = item({
      change: "same",
      gates: [
        {
          gate: "reading",
          from: 0,
          to: 0,
          missed: true,
          answers: ["にち", "じつ"],
        },
      ],
    });
    expect(rowTone(miss)).toBe("bad");
    expect(answerText(miss)).toBe("にち・じつ");
    expect(changeText(miss)).toBe("New");
    expect(rowTone(item())).toBe("good");
    expect(rowTone(item({ change: "same" }))).toBe("dim");
  });

  it("a missed meaning shows no answer line: the row already shows the meaning", () => {
    const miss = item({
      change: "slip",
      gates: [
        { gate: "meaning", from: 4, to: 0, missed: true, answers: ["nearby"] },
      ],
    });
    expect(rowTone(miss)).toBe("bad");
    expect(answerText(miss)).toBe("");
  });

  it("truncate ends in an ellipsis within the width", () => {
    const m = (t: string): number => t.length * 10;
    expect(truncate("abc", 30, m)).toBe("abc");
    expect(truncate("abcdef", 40, m)).toBe("abc…");
    expect(truncate("abcdef", 5, m)).toBe("");
  });
});
