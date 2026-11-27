import { describe, expect, it } from "vitest";
import { KANA } from "../../src/core/kana";
import { KANJI } from "../../src/core/kanji";
import { overall } from "../../src/core/overall";
import { place } from "../../src/core/progression";
import { defaultProgress } from "../../src/core/srs";
import { WORDS } from "../../src/core/words";
import {
  clampScroll,
  progressLayout,
  progressTap,
  resolveScroll,
  scrollBy,
} from "../../src/game/progress";

const W = 390;
const H = 844;
const fresh = overall(defaultProgress(), KANA, KANJI, WORDS, false);
const deep = overall(
  place(defaultProgress(), 48, KANA, KANJI, WORDS),
  KANA,
  KANJI,
  WORDS,
  false,
);

describe("progressLayout", () => {
  it("stacks the rows from 0, groups taller than levels", () => {
    const { rows } = progressLayout(W, H, fresh);
    expect(rows.map((r) => r.y)).toEqual([0, 54, 96, 138]);
    expect(rows.map((r) => r.h)).toEqual([54, 42, 42, 54]);
  });

  it("a short list doesn't scroll; a long one scrolls by what doesn't fit", () => {
    expect(progressLayout(W, H, fresh).maxScroll).toBe(0);
    const l = progressLayout(W, H, deep);
    const last = l.rows.at(-1);
    const content = (last?.y ?? 0) + (last?.h ?? 0);
    expect(l.maxScroll).toBe(content - (l.listBottom - l.listTop));
    expect(l.maxScroll).toBeGreaterThan(0);
  });

  it("the list sits between the header and Back", () => {
    const l = progressLayout(W, H, deep);
    expect(l.listTop).toBeGreaterThan(160);
    expect(l.listBottom).toBeLessThan(l.back.y);
    expect(l.back.y + l.back.h).toBeLessThanOrEqual(H);
    // meaning mode has no coverage lines: the list starts higher
    expect(
      progressLayout(W, H, { ...deep, coverage: null }).listTop,
    ).toBeLessThan(l.listTop);
  });
});

describe("scrolling", () => {
  it("clamps to the list", () => {
    expect(clampScroll(-5, 100)).toBe(0);
    expect(clampScroll(50, 100)).toBe(50);
    expect(clampScroll(150, 100)).toBe(100);
  });

  it("opens at the end (the current level) and moves from there", () => {
    expect(resolveScroll(null, 300)).toBe(300);
    expect(resolveScroll(400, 300)).toBe(300);
    expect(scrollBy(null, -40, 300)).toBe(260);
    expect(scrollBy(260, 100, 300)).toBe(300);
    expect(scrollBy(10, -40, 300)).toBe(0);
  });
});

describe("progressTap", () => {
  it("hits Back only", () => {
    const { back } = progressLayout(W, H, fresh);
    expect(progressTap(W, H, fresh, back.x + 10, back.y + 10)).toBe(true);
    expect(progressTap(W, H, fresh, W / 2, 300)).toBe(false);
  });
});
