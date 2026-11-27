import { describe, expect, it } from "vitest";
import { travelCoverage } from "../../src/core/coverage";
import { KANA } from "../../src/core/kana";
import { KANJI } from "../../src/core/kanji";
import { gainLabel, overall } from "../../src/core/overall";
import {
  meaningProgress,
  place,
  placeMeaning,
} from "../../src/core/progression";
import { defaultProgress, itemKey } from "../../src/core/srs";
import { WORDS } from "../../src/core/words";
import type { Progress } from "../../src/core/types";

const view = (p: Progress, meaning = false) =>
  overall(p, meaning ? [] : KANA, KANJI, meaning ? [] : WORDS, meaning);

/** The first kanji of Kanji 12 (level 13). */
const slipped = KANJI.find((k) => k.level === 13)?.char ?? "";

/** Placed through Kanji 29 (at Kanji 30), with one Kanji 12 reading slipped to box 0. */
function midway(): Progress {
  const p = place(defaultProgress(), 30, KANA, KANJI, WORDS);
  p.items[itemKey(slipped, "reading")] = {
    box: 0,
    seen: 5,
    correct: 3,
    wrong: 2,
    lastSeen: 1,
  };
  return p;
}

describe("overall", () => {
  it("fresh save: Hiragana open, Katakana dimmed, Foundations dimmed", () => {
    const o = view(defaultProgress());
    expect(o.title).toBe("Hiragana · Kana");
    expect(o.learned).toBe(0);
    expect(o.all).toBe(2136);
    expect(o.coverage).toBe(0);
    expect(o.gain).toBeNull();
    expect(o.rows.map((r) => [r.kind, r.name, r.dim])).toEqual([
      ["group", "Kana", false],
      ["level", "Hiragana", false],
      ["level", "Katakana", true],
      ["group", "Foundations", true],
    ]);
    expect(o.rows[0]).toMatchObject({ range: "Hiragana–Katakana" });
  });

  it("mid-way: past groups collapsed, a slipped item un-finishes its level", () => {
    const p = midway();
    const o = view(p);
    expect(p.unlockedLevel).toBe(31);
    expect(o.title).toBe("Kanji 30 of 296 · Everyday");
    const groups = o.rows.filter((r) => r.kind === "group");
    expect(groups.map((g) => [g.name, g.range, g.finished, g.levels])).toEqual([
      ["Kana", "Hiragana–Katakana", 2, 2],
      ["Foundations", "Kanji 1–25", 24, 25],
      ["Everyday", "Kanji 26–50", 4, 25],
      ["Getting around", "Kanji 51–75", 0, 25],
    ]);
    expect(groups.map((g) => [g.open, g.dim])).toEqual([
      [false, false],
      [false, false],
      [true, false],
      [false, true],
    ]);
    const levels = o.rows.filter((r) => r.kind === "level");
    expect(levels.map((l) => l.name)).toEqual([
      "Kanji 26",
      "Kanji 27",
      "Kanji 28",
      "Kanji 29",
      "Kanji 30",
      "Kanji 31",
    ]);
    expect(levels.at(-1)?.dim).toBe(true);
    expect(levels.at(-2)?.learned).toBe(0);
    expect(levels[0]?.learned).toBe(levels[0]?.total);
    // 29 levels of kanji placed, one reading slipped
    const placed = KANJI.filter((k) => k.level <= 30).length;
    expect(o.learned).toBe(placed - 1);
  });

  it("coverage counts learned kanji; gain is the current level's share", () => {
    const o = view(midway());
    const known = new Set(
      KANJI.filter((k) => k.level <= 30).map((k) => k.char),
    );
    known.delete(slipped);
    const now = travelCoverage((c) => known.has(c));
    expect(o.coverage).toBeCloseTo(now, 12);
    for (const k of KANJI) if (k.level === 31) known.add(k.char);
    expect(o.gain).toBeCloseTo(travelCoverage((c) => known.has(c)) - now, 12);
  });

  it("a last-level save has no next level or group", () => {
    const o = view(place(defaultProgress(), 296, KANA, KANJI, WORDS));
    expect(o.title).toBe("Kanji 296 of 296 · Every Jōyō kanji");
    expect(o.rows.at(-1)).toMatchObject({ kind: "level", name: "Kanji 296" });
  });

  it("meaning mode: kanji groups only, no coverage", () => {
    const fresh = view(meaningProgress(), true);
    expect(fresh.title).toBe("Kanji 1 of 296 · Foundations");
    expect(fresh.coverage).toBeNull();
    expect(fresh.gain).toBeNull();
    expect(fresh.rows.map((r) => r.name)).toEqual([
      "Foundations",
      "Kanji 1",
      "Kanji 2",
      "Everyday",
    ]);
    const o = view(placeMeaning(meaningProgress(), 30, KANJI), true);
    expect(o.rows[0]).toMatchObject({ name: "Foundations", finished: 25 });
    expect(o.learned).toBe(KANJI.filter((k) => k.level <= 30).length);
  });

  it("labels the gain to the whole percent, <1% when under half", () => {
    expect(gainLabel(0.012)).toBe("+1%");
    expect(gainLabel(0.003)).toBe("+<1%");
    expect(gainLabel(0)).toBe("+0%");
  });
});
