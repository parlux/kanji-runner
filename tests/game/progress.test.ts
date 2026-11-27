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
  progressHit,
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

describe("progressHit", () => {
  it("hits Back, group rows and level rows under the scroll", () => {
    const l = progressLayout(W, H, fresh);
    expect(
      progressHit(W, H, fresh, null, l.back.x + 10, l.back.y + 10),
    ).toEqual({ kind: "back" });
    const y0 = l.listTop;
    expect(progressHit(W, H, fresh, null, W / 2, y0 + 10)).toEqual({
      kind: "group",
      group: 0,
    });
    expect(progressHit(W, H, fresh, null, W / 2, y0 + 54 + 10)).toEqual({
      kind: "level",
      level: 0,
    });
    // the dimmed next level and group are hit too
    expect(progressHit(W, H, fresh, null, W / 2, y0 + 96 + 10)).toEqual({
      kind: "level",
      level: 1,
    });
    expect(progressHit(W, H, fresh, null, W / 2, y0 + 138 + 10)).toEqual({
      kind: "group",
      group: 1,
    });
    // below the last row, outside the list or the side gutter: nothing
    expect(progressHit(W, H, fresh, null, W / 2, y0 + 200)).toBeNull();
    expect(progressHit(W, H, fresh, null, W / 2, y0 - 5)).toBeNull();
    expect(progressHit(W, H, fresh, null, 5, y0 + 10)).toBeNull();
  });

  it("counts the scroll; null scroll means the end of the list", () => {
    const l = progressLayout(W, H, deep);
    const last = l.rows.at(-1);
    const y = l.listBottom - 5;
    const hit = progressHit(W, H, deep, null, W / 2, y);
    expect(last?.row.kind).toBe("group");
    expect(hit).toEqual({ kind: "group", group: 3 });
    expect(progressHit(W, H, deep, 0, W / 2, l.listTop + 5)).toEqual({
      kind: "group",
      group: 0,
    });
  });
});
