import { describe, expect, it } from "vitest";
import { levelCard, place } from "../../src/core/progression";
import { KANA } from "../../src/core/kana";
import { KANJI } from "../../src/core/kanji";
import { WORDS } from "../../src/core/words";
import { defaultProgress } from "../../src/core/srs";
import type { RunItem } from "../../src/core/runitems";
import {
  answerText,
  changeText,
  endListArea,
  endListLayout,
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
const many = (n: number): RunItem[] =>
  Array.from({ length: n }, (_, i) => item({ key: String(i) }));

const fullCard = (() => {
  const before = place(defaultProgress(), 0, KANA, KANJI, WORDS);
  return {
    ...levelCard(before, before, KANA, KANJI, WORDS, false),
    learnedNow: ["日"],
  };
})();

describe("endListLayout", () => {
  it("16 rows fit at 390x844 without scrolling", () => {
    const a = endListArea(390, 844, fullCard, true);
    const l = endListLayout(a.top, a.bottom, many(16));
    expect(l.maxScroll).toBe(0);
    expect(l.content).toBeLessThanOrEqual(a.bottom - a.top);
    expect(l.rows.every((r) => r.h >= 20)).toBe(true);
  });

  it("rows stack without overlap; few rows stay at most 32 px", () => {
    const l = endListLayout(100, 600, many(3));
    expect(l.rows.map((r) => r.h)).toEqual([32, 32, 32]);
    const [a, b] = l.rows;
    expect((a?.y ?? 0) + (a?.h ?? 0)).toBeLessThanOrEqual(b?.y ?? 0);
  });

  it("a long list scrolls by what doesn't fit; rows keep 20 px", () => {
    const l = endListLayout(100, 500, many(30));
    expect(l.rows[0]?.h).toBe(20);
    expect(l.maxScroll).toBe(l.content - 400);
    expect(l.maxScroll).toBeGreaterThan(0);
  });

  it("answer rows are taller; compact screens still fit 16 or scroll", () => {
    const slip = item({
      change: "slip",
      gates: [
        { gate: "reading", from: 3, to: 2, missed: true, answers: ["a"] },
      ],
    });
    const l = endListLayout(0, 400, [slip, item()]);
    expect(l.rows[0]?.h).toBeGreaterThan(l.rows[1]?.h ?? 0);
    const a = endListArea(390, 700, fullCard, true);
    expect(a.bottom).toBeGreaterThan(a.top);
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

  it("truncate ends in an ellipsis within the width", () => {
    const m = (t: string): number => t.length * 10;
    expect(truncate("abc", 30, m)).toBe("abc");
    expect(truncate("abcdef", 40, m)).toBe("abc…");
    expect(truncate("abcdef", 5, m)).toBe("");
  });
});
