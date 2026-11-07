import { describe, expect, it } from "vitest";
import {
  expectedArmy,
  firepower,
  hazardHp,
  packStrength,
  pickTarget,
  type Threat,
} from "../../src/core/fire";
import { buildKanaRun } from "../../src/core/run";
import { KANA } from "../../src/core/kana";
import type { Block, Pack, Saw, Track } from "../../src/core/track";
import {
  BLOCK_HP_K,
  ENEMY_HP,
  ENEMY_K,
  ENEMY_MIN,
  FIRE_PER_SOLDIER,
  FIRE_RANGE,
  STARTING_ARMY,
} from "../../src/core/tuning";

const block = (pos: number, left: number, right: number): Block => ({
  kind: "block",
  pos,
  left,
  right,
});
const saw = (pos: number): Saw => ({
  kind: "saw",
  pos,
  mid: 0.5,
  amp: 0,
  phase: 0,
});
const pack = (pos: number): Pack => ({ kind: "pack", pos, x: 0.5 });
const crowd = { left: 0.4, right: 0.6 };

describe("firepower", () => {
  it("is FIRE_PER_SOLDIER × army", () => {
    expect(firepower(0)).toBe(0);
    expect(firepower(37)).toBe(FIRE_PER_SOLDIER * 37);
  });
});

describe("expectedArmy", () => {
  it("starts at STARTING_ARMY and has one entry per answer", () => {
    const rows = buildKanaRun(1, KANA);
    const e = expectedArmy(rows);
    expect(e[0]).toBe(STARTING_ARMY);
    expect(e).toHaveLength(rows.length + 1);
  });

  it("is deterministic per run", () => {
    for (let seed = 0; seed < 50; seed++)
      expect(expectedArmy(buildKanaRun(seed, KANA))).toEqual(
        expectedArmy(buildKanaRun(seed, KANA)),
      );
  });

  it("drops only on every 5th answer, and never after a correct one", () => {
    for (let seed = 0; seed < 50; seed++) {
      const e = expectedArmy(buildKanaRun(seed, KANA));
      for (let q = 1; q < e.length; q++) {
        const prev = e[q - 1] as number;
        const cur = e[q] as number;
        if (q % 5 === 0) expect(cur).toBeLessThan(prev);
        else expect(cur).toBeGreaterThan(prev);
      }
    }
  });
});

describe("hazardHp", () => {
  it("scales blocks and packs by the expected army after the questions before them; saws get 0", () => {
    const track: Track = {
      questions: [3, 10, 20],
      hazards: [block(5, 0, 0.3), saw(7), block(15, 0.5, 0.8), pack(17)],
      charges: [],
    };
    expect(hazardHp(track, [5, 8, 11, 40])).toEqual([
      BLOCK_HP_K * 8,
      0,
      BLOCK_HP_K * 11,
      ENEMY_HP * packStrength(11),
    ]);
  });
});

describe("packStrength", () => {
  it("is round(ENEMY_K × expected army), at least ENEMY_MIN", () => {
    expect(packStrength(0)).toBe(ENEMY_MIN);
    expect(packStrength(1000)).toBe(Math.round(ENEMY_K * 1000));
    expect(ENEMY_MIN).toBe(3);
  });
});

describe("pickTarget", () => {
  const t = (pos: number, left: number, right: number): Threat => ({
    pos,
    span: { left, right },
  });

  it("picks the nearest overlapping threat in range", () => {
    expect(pickTarget([t(1, 0.5, 0.7), t(1.5, 0.3, 0.5)], 0, 0, crowd)).toBe(0);
    expect(pickTarget([t(1.5, 0.5, 0.7), t(1, 0.3, 0.5)], 0, 0, crowd)).toBe(1);
  });

  it("skips threats that don't overlap the crowd", () => {
    expect(pickTarget([t(1, 0, 0.4), t(1.5, 0.55, 0.9)], 0, 0, crowd)).toBe(1);
  });

  it("ignores threats beyond FIRE_RANGE and behind the crowd", () => {
    expect(pickTarget([t(FIRE_RANGE + 0.01, 0, 1)], 0, 0, crowd)).toBe(null);
    expect(pickTarget([t(FIRE_RANGE, 0, 1)], 0, 0, crowd)).toBe(0);
    expect(pickTarget([t(0.9, 0, 1)], 0, 1, crowd)).toBe(null);
  });

  it("never targets null entries", () => {
    expect(pickTarget([null, t(1.5, 0, 1)], 0, 0, crowd)).toBe(1);
    expect(pickTarget([null], 0, 0, crowd)).toBe(null);
  });

  it("starts at `from`", () => {
    expect(pickTarget([t(1, 0, 1), t(1.5, 0, 1)], 1, 0, crowd)).toBe(1);
  });

  it("skips threats at or past `limit` (the next question)", () => {
    expect(pickTarget([t(1, 0, 1)], 0, 0, crowd, 1)).toBe(null);
    expect(pickTarget([t(1, 0, 0.4), t(2, 0, 1)], 0, 0, crowd, 1.5)).toBe(null);
    expect(pickTarget([t(1, 0, 1)], 0, 0, crowd, 1.01)).toBe(0);
  });
});
