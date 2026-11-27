import { describe, expect, it } from "vitest";
import { KANA } from "../../src/core/kana";
import { KANJI } from "../../src/core/kanji";
import { levelProgress, meaningProgress } from "../../src/core/progression";
import { itemKey, LEARNED_BOX } from "../../src/core/srs";
import type { ItemProgress, Progress } from "../../src/core/types";
import {
  loadMeaningProgress,
  loadProgress,
  MEANING_STORAGE_KEY,
  migrate,
  STORAGE_KEY,
  type KeyValueStore,
} from "../../src/storage/storage";
import { OLD_ORDER_LEVELS_2_TO_12 } from "./fixtures/old-order";

const rec = (box: number): ItemProgress => ({
  box,
  seen: 3,
  correct: 2,
  wrong: 1,
  lastSeen: 500,
});

const v1 = (unlockedLevel: number, items: Record<string, ItemProgress>) => ({
  version: 1,
  unlockedLevel,
  items,
  stats: { runs: 7, wins: 4, losses: 3 },
});

const kanaItems = () =>
  Object.fromEntries(
    KANA.map((k) => [itemKey(k.char, "kana"), rec(LEARNED_BOX)]),
  );
const oldOrderItems = () => ({
  ...kanaItems(),
  ...Object.fromEntries(
    [...OLD_ORDER_LEVELS_2_TO_12].map((c) => [
      itemKey(c, "meaning"),
      rec(LEARNED_BOX),
    ]),
  ),
});

function store(key: string, value: unknown): KeyValueStore {
  const data = new Map([[key, JSON.stringify(value)]]);
  return { getItem: (k) => data.get(k) ?? null, setItem: () => undefined };
}

describe("schema 2 migration", () => {
  it("keeps every item and the stats, only the level changes", () => {
    const items = {
      ...oldOrderItems(),
      "今日:word": rec(2),
      "日:reading": rec(0),
      "日:meaning": rec(5),
    };
    const out = migrate(v1(13, items));
    expect(out?.version).toBe(2);
    expect(out?.items).toEqual(items);
    expect(out?.stats).toEqual({ runs: 7, wins: 4, losses: 3 });
  });

  it("a v1 save with nothing learned lands on level 0, like a fresh start", () => {
    expect(migrate(v1(9, {}))?.unlockedLevel).toBe(0);
    expect(migrate(v1(0, {}))?.items).toEqual({});
  });

  it("kana learned at 80% or more roll forward to Kanji 1", () => {
    expect(migrate(v1(0, kanaItems()))?.unlockedLevel).toBe(2);
  });

  it("placement marks (box 4) count as learned", () => {
    const items = Object.fromEntries(
      Object.keys(kanaItems()).map((k) => [k, rec(4)]),
    );
    expect(migrate(v1(0, items))?.unlockedLevel).toBe(2);
  });

  it("never worse than a fresh start, whatever the old level", () => {
    for (const lvl of [0, 1, 5, 40])
      expect(migrate(v1(lvl, {}))?.unlockedLevel).toBe(0);
  });

  it("drops bad item records but keeps the rest", () => {
    const out = migrate(
      v1(0, { "日:meaning": rec(1), bad: { box: 9 } } as never),
    );
    expect(Object.keys(out?.items ?? {})).toEqual(["日:meaning"]);
  });

  it("v2 saves are not recomputed", () => {
    expect(migrate({ ...v1(5, {}), version: 2 })?.unlockedLevel).toBe(5);
  });

  it("levels 2-12 learned in the old order land on the first level not fully learned", () => {
    const items = {
      ...oldOrderItems(),
      ...Object.fromEntries(
        [...OLD_ORDER_LEVELS_2_TO_12].map((c) => [
          itemKey(c, "reading"),
          rec(LEARNED_BOX),
        ]),
      ),
    };
    const out = migrate(v1(13, items)) as Progress;
    const perLevel: Record<number, string> = {};
    for (let l = 2; l <= 7; l++) {
      const p = levelProgress(out, l, KANA, KANJI);
      perLevel[l] = `${p.learned}/${p.total}`;
    }
    const here = levelProgress(out, out.unlockedLevel, KANA, KANJI);
    expect(here.learned).toBeLessThan(here.total);
    for (let l = 0; l < out.unlockedLevel; l++) {
      const p = levelProgress(out, l, KANA, KANJI);
      expect(p.learned).toBeGreaterThanOrEqual(p.total);
    }
    expect(out.unlockedLevel).toBeGreaterThanOrEqual(2);
  });

  it("loadProgress migrates a stored v1 save", () => {
    const out = loadProgress(store(STORAGE_KEY, v1(9, kanaItems())));
    expect(out.version).toBe(2);
    expect(out.unlockedLevel).toBe(2);
  });
});

describe("schema 2 migration, Meaning store", () => {
  it("starts from Kanji 1 (level 2), never below, and keeps items", () => {
    const out = loadMeaningProgress(store(MEANING_STORAGE_KEY, v1(7, {})));
    expect(out.unlockedLevel).toBe(meaningProgress().unlockedLevel);
    expect(out.version).toBe(2);
  });

  it("rolls forward over learned kanji levels", () => {
    const items = Object.fromEntries(
      KANJI.filter((k) => k.level === 2).map((k) => [
        itemKey(k.char, "meaning"),
        rec(LEARNED_BOX),
      ]),
    );
    const out = loadMeaningProgress(store(MEANING_STORAGE_KEY, v1(2, items)));
    expect(out.unlockedLevel).toBe(3);
    expect(out.items).toEqual(items);
  });
});
