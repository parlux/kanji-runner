import { describe, expect, it } from "vitest";
import {
  DEFAULT_HORDE_SETTINGS,
  HORDE_KEY,
  hordeTuning,
  loadHorde,
  saveHorde,
  type HordeSettings,
} from "../../src/storage/horde";
import { HORDE_DEFAULTS } from "../../src/core/tuning";

const memory = (init: Record<string, string> = {}) => {
  const data = { ...init };
  return {
    data,
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
    removeItem: (k: string) => {
      Reflect.deleteProperty(data, k);
    },
  };
};

const tuned: HordeSettings = {
  count: 2000,
  scale: 1.1,
  killSeconds: 2,
  width: 0.6,
};

describe("horde storage", () => {
  it("round-trips, and clears on null", () => {
    const m = memory();
    expect(loadHorde(m)).toBeNull();
    saveHorde(m, tuned);
    expect(loadHorde(m)).toEqual(tuned);
    saveHorde(m, null);
    expect(loadHorde(m)).toBeNull();
  });

  it("falls back to null for malformed, partial or out-of-range saves", () => {
    for (const raw of [
      "nope",
      "null",
      "5",
      "{}",
      JSON.stringify({ ...tuned, count: 199 }),
      JSON.stringify({ ...tuned, count: 20001 }),
      JSON.stringify({ ...tuned, scale: 0.1 }),
      JSON.stringify({ ...tuned, killSeconds: 6 }),
      JSON.stringify({ ...tuned, width: "wide" }),
      JSON.stringify({ ...tuned, width: null }),
    ])
      expect(loadHorde(memory({ [HORDE_KEY]: raw }))).toBeNull();
  });

  it("never throws on broken storage", () => {
    const bad = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("full");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(loadHorde(bad)).toBeNull();
    expect(() => saveHorde(bad, tuned)).not.toThrow();
  });

  it("the default settings build the default tuning: the owner's 200 enemies, 3.5 s, size 1, width 0.8", () => {
    expect(DEFAULT_HORDE_SETTINGS).toEqual({
      count: 200,
      scale: 1,
      killSeconds: 3.5,
      width: 0.8,
    });
    expect(hordeTuning(DEFAULT_HORDE_SETTINGS)).toEqual(HORDE_DEFAULTS);
    expect(HORDE_DEFAULTS).toEqual({
      hordeK: 3,
      packMax: 200,
      killSeconds: 3.5,
      packWidth: 0.8,
      hordeScale: 1,
    });
  });

  it("an old save (200 enemies, the earlier defaults) stays valid and builds as before", () => {
    const old = { count: 200, scale: 0.7, killSeconds: 1, width: 1 };
    const store = new Map([[HORDE_KEY, JSON.stringify(old)]]);
    const loaded = loadHorde({ getItem: (k) => store.get(k) ?? null });
    expect(loaded).toEqual(old);
    expect(hordeTuning(old)).toEqual({
      hordeK: 3,
      packMax: 200,
      killSeconds: 1,
      packWidth: 1,
      hordeScale: 0.7,
    });
  });

  it("a bigger count raises the cap and K so normal runs reach it", () => {
    const t = hordeTuning(tuned);
    expect(t.packMax).toBe(2000);
    expect(t.hordeK).toBeCloseTo(30);
    expect(t.killSeconds).toBe(2);
    expect(t.packWidth).toBe(0.6);
    expect(t.hordeScale).toBe(1.1);
  });
});
