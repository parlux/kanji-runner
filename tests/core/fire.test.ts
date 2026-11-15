import { describe, expect, it } from "vitest";
import {
  expectedArmy,
  firepower,
  hazardHeads,
  hazardHp,
  laneHits,
  packCount,
  splitFire,
  type Threat,
} from "../../src/core/fire";
import { kanaRun } from "./kana-run";
import type { Block, Pack, Saw, Track } from "../../src/core/track";
import {
  BLOCK_HP_K,
  ENEMY_MIN,
  FIRE_PER_SOLDIER,
  FIRE_RANGE,
  HORDE_DEFAULTS,
  HORDE_K,
  KILL_SECONDS,
  PACK_MAX,
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
    const rows = kanaRun(1);
    const e = expectedArmy(rows);
    expect(e[0]).toBe(STARTING_ARMY);
    expect(e).toHaveLength(rows.length + 1);
  });

  it("is deterministic per run", () => {
    for (let seed = 0; seed < 50; seed++)
      expect(expectedArmy(kanaRun(seed))).toEqual(expectedArmy(kanaRun(seed)));
  });

  it("drops only on every 5th answer, and never after a correct one", () => {
    for (let seed = 0; seed < 50; seed++) {
      const e = expectedArmy(kanaRun(seed));
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
      KILL_SECONDS * firepower(11),
    ]);
    const slow = { ...HORDE_DEFAULTS, killSeconds: 6 };
    expect(hazardHp(track, [5, 8, 11, 40], slow)[3]).toBe(6 * firepower(11));
  });
});

describe("packCount", () => {
  it("is round(HORDE_K × expected army), clamped to [ENEMY_MIN, PACK_MAX]", () => {
    // the owner's default: 200, K 3 per 200
    expect(PACK_MAX).toBe(200);
    expect(HORDE_K).toBe(3);
    expect(packCount(0)).toBe(ENEMY_MIN);
    expect(packCount(5)).toBe(15);
    expect(packCount(10.4)).toBe(Math.round(HORDE_K * 10.4));
    expect(packCount(1000)).toBe(PACK_MAX);
    // never fewer heads for a bigger army
    for (const e of [0, 5, 20, 66]) {
      expect(packCount(e + 1)).toBeGreaterThanOrEqual(packCount(e));
    }
  });
});

describe("packCount with horde tuning", () => {
  it("defaults match the constants; overrides change the factor and the cap", () => {
    expect(HORDE_DEFAULTS).toMatchObject({
      hordeK: HORDE_K,
      packMax: PACK_MAX,
    });
    for (const e of [0, 5, 40, 1000])
      expect(packCount(e, HORDE_DEFAULTS)).toBe(packCount(e));
    const big = { ...HORDE_DEFAULTS, hordeK: 100, packMax: 20_000 };
    expect(packCount(5, big)).toBe(500);
    expect(packCount(1000, big)).toBe(20_000);
    expect(packCount(0, big)).toBe(ENEMY_MIN);
  });
});

describe("hazardHeads", () => {
  it("gives packs packCount of the expected army before them; blocks and saws 0", () => {
    const track: Track = {
      questions: [3, 10, 20],
      hazards: [block(5, 0, 0.3), saw(7), pack(2), pack(17)],
      charges: [],
    };
    expect(hazardHeads(track, [5, 8, 11, 400])).toEqual([
      0,
      0,
      packCount(5),
      packCount(11),
    ]);
  });
});

describe("splitFire (fire by lane)", () => {
  const t = (pos: number, left: number, right: number): Threat => ({
    pos,
    span: { left, right },
  });
  const pack = t;
  const close = (got: {
    shares: { index: number; share: number }[];
    free: number;
  }) => ({
    shares: got.shares.map((x) => [x.index, Math.round(x.share * 1000) / 1000]),
    free: Math.round(got.free * 1000) / 1000,
  });

  it("a crate in front of a pack takes the lanes it covers; the pack gets the rest", () => {
    // crate over the left half of the crowd, pack across all of it behind
    const got = splitFire([t(1, 0.3, 0.5), pack(5, 0, 1)], 0, 0, crowd);
    expect(close(got)).toEqual({
      shares: [
        [0, 0.5],
        [1, 0.5],
      ],
      free: 0,
    });
  });

  it("a crate covering the whole army blocks the pack entirely", () => {
    const got = splitFire([t(1, 0.3, 0.7), pack(5, 0, 1)], 0, 0, crowd);
    expect(close(got)).toEqual({ shares: [[0, 1]], free: 0 });
  });

  it("a pack in front of a crate takes the lanes it covers", () => {
    const got = splitFire([t(2, 0, 1), pack(1, 0.45, 0.55)], 0, 0, crowd);
    expect(close(got)).toEqual({
      shares: [
        [0, 0.5],
        [1, 0.5],
      ],
      free: 0,
    });
  });

  it("two crates side by side both take fire; the gap between them is free", () => {
    const got = splitFire([t(1, 0.3, 0.45), t(1.5, 0.55, 0.9)], 0, 0, crowd);
    expect(close(got)).toEqual({
      shares: [
        [0, 0.25],
        [1, 0.25],
      ],
      free: 0.5,
    });
  });

  it("with nothing ahead all the fire is free", () => {
    expect(splitFire([], 0, 0, crowd)).toEqual({ shares: [], free: 1 });
    expect(close(splitFire([t(1, 0, 0.3)], 0, 0, crowd))).toEqual({
      shares: [],
      free: 1,
    });
  });

  it("ties go to the lower index; shares always sum to 1 with free", () => {
    const got = splitFire([t(1, 0, 1), t(1, 0, 1)], 0, 0, crowd);
    expect(close(got)).toEqual({ shares: [[0, 1]], free: 0 });
    const mix = splitFire(
      [t(1, 0.42, 0.47), pack(3, 0.3, 0.52), t(2, 0.5, 0.58), null],
      0,
      0,
      crowd,
    );
    const sum = mix.shares.reduce((a, x) => a + x.share, mix.free);
    expect(sum).toBeCloseTo(1, 12);
  });

  it("keeps the range, `from` and `limit` rules", () => {
    expect(splitFire([t(FIRE_RANGE + 0.01, 0, 1)], 0, 0, crowd).free).toBe(1);
    expect(splitFire([t(0.9, 0, 1)], 0, 1, crowd).free).toBe(1);
    expect(splitFire([pack(12, 0, 1)], 0, 0, crowd).shares).toHaveLength(1);
    expect(splitFire([t(1, 0, 1), t(1.5, 0, 1)], 1, 0, crowd).shares).toEqual([
      { index: 1, share: 1 },
    ]);
    expect(splitFire([t(1, 0, 1)], 0, 0, crowd, 1).free).toBe(1);
  });
});

describe("laneHits (straight tracer ends)", () => {
  const t = (pos: number, left: number, right: number): Threat => ({
    pos,
    span: { left, right },
  });
  const xs = [0.3, 0.4, 0.5, 0.6, 0.7];
  const ends = (th: (Threat | null)[], limit?: number) =>
    laneHits(th, 0, 0, xs, limit).map((h) => (h ? h.index : null));

  it("a crate in front of a pack: its lanes stop at the crate, the rest at the pack", () => {
    expect(ends([t(2, 0.25, 0.45), t(8, 0.2, 0.8)])).toEqual([0, 0, 1, 1, 1]);
  });
  it("a crate covering every lane takes them all", () => {
    expect(ends([t(2, 0.1, 0.9), t(8, 0.2, 0.8)])).toEqual([0, 0, 0, 0, 0]);
  });
  it("a crate to one side leaves the other lanes flying on", () => {
    expect(ends([t(3, 0.1, 0.35)])).toEqual([0, null, null, null, null]);
  });
  it("nothing ahead: no lane hits anything", () => {
    expect(ends([])).toEqual([null, null, null, null, null]);
    // out of range, behind, or past the wall
    expect(ends([t(20, 0, 1), t(-1, 0, 1)])).toEqual(Array(5).fill(null));
    expect(ends([t(5, 0, 1)], 4)).toEqual(Array(5).fill(null));
  });
  it("agrees with splitFire on who is nearest", () => {
    const th = [t(2, 0.25, 0.45), t(8, 0.2, 0.8)];
    const hit = new Set(laneHits(th, 0, 0, xs).map((h) => h?.index));
    const got = splitFire(th, 0, 0, { left: 0.25, right: 0.75 });
    expect(got.shares.map((x) => x.index).every((i) => hit.has(i))).toBe(true);
  });
});
