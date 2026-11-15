import { describe, expect, it } from "vitest";
import { crateReward, isShattered } from "../../src/core/shooting";
import { stepRun, type RunState } from "../../src/core/sim";
import {
  packLength,
  packMouth,
  packSpan,
  streamSpan,
  packSurvivors,
} from "../../src/core/horde";
import { crowdWidth } from "../../src/core/crowd";
import { expectedArmy, firepower, hazardHp } from "../../src/core/fire";
import { buildTrack, type Block, type Saw } from "../../src/core/track";
import { kanaRun } from "./kana-run";
import {
  BLOCK_HP_K,
  CRATE_REWARD_K,
  ENEMY_HP,
  FIRE_RANGE,
  ROWS_PER_RUN,
  PACK_WAKE,
  TRACK_SPEED,
  ENEMY_SPEED,
} from "../../src/core/tuning";
import { DT, fresh, wide, range, pack, NARROW, stepFor } from "./sim-helpers";

describe("shooting", () => {
  it("deals firepower × time, only to the nearest overlapping block", () => {
    let s = range([wide(1.9), wide(1.95)], [1e9, 1e9]);
    s = stepFor(s, 0.5);
    expect(s.damage[0]).toBeCloseTo(firepower(20) * 0.5, 6);
    expect(s.damage[1]).toBe(0);
    expect(s.target).toBe(0);
  });

  it("never fires past the next question, even within FIRE_RANGE", () => {
    const s0 = range([wide(1.9)], [1e9]);
    const s = stepFor(
      { ...s0, track: { ...s0.track, questions: [1.5, 100] } },
      0.2,
    );
    expect(s.target).toBeNull();
    expect(s.damage[0]).toBe(0);
  });

  it("never fires past a charge's wall either, even within FIRE_RANGE", () => {
    const s0 = range([wide(1.9)], [1e9]);
    const track = { ...s0.track, questions: [1.5, 100], charges: [0] };
    const s = stepFor({ ...s0, track }, 0.2);
    expect(s.target).toBeNull();
    expect(s.damage[0]).toBe(0);
  });

  it("doesn't fire at blocks that don't overlap the crowd", () => {
    const side: Block = { kind: "block", pos: 1.5, left: 0, right: 0.2 };
    const s = stepFor(range([side], [1e9]), 0.5);
    expect(s.damage[0]).toBe(0);
    expect(s.target).toBe(null);
  });

  it("shatters a block exactly when damage reaches its hit points", () => {
    const hp = 10;
    const perStep = firepower(20) * DT;
    const at = (damage: number): RunState => ({
      ...range([wide(0.05)], [hp]),
      damage: [damage],
    });
    const short = stepRun(at(hp - 2 * perStep), DT);
    expect(isShattered(short, 0)).toBe(false);
    const enough = stepRun(at(hp - 0.5 * perStep), DT);
    expect(enough.damage[0]).toBe(hp);
    expect(isShattered(enough, 0)).toBe(true);
    expect(enough.lastShatter).toEqual({ index: 0, dist: enough.dist });
  });

  it("a shattered block never clips; an intact one clips as before", () => {
    const shattered = stepFor(range([wide(0.5)], [1]), 1);
    expect(isShattered(shattered, 0)).toBe(true);
    expect(shattered.nextHazard).toBe(1);
    expect(shattered.army).toBe(20);
    expect(shattered.lastClip).toBe(null);

    const intact = stepFor(range([wide(0.5)], [1e9]), 1);
    expect(intact.army).toBe(0);
    expect(intact.status).toBe("dead");
  });

  it("a shattered crate adds crateReward(hp) exactly once", () => {
    const hp = 40;
    const s0 = { ...range([wide(0.5)], [hp]), damage: [hp - 0.01] };
    const broke = stepRun(s0, DT);
    expect(isShattered(broke, 0)).toBe(true);
    expect(broke.army).toBe(20 + crateReward(hp));
    expect(crateReward(hp)).toBe(
      Math.round(CRATE_REWARD_K * Math.round(hp / BLOCK_HP_K)),
    );
    expect(broke.lastCrate).toEqual({
      gain: crateReward(hp),
      dist: broke.dist,
    });
    // passing it later pays nothing more and doesn't clip
    const passed = stepFor(broke, 1);
    expect(passed.nextHazard).toBe(1);
    expect(passed.army).toBe(broke.army);
  });

  it("a crate pays as many soldiers as before the retune for the same expected army: round(0.3 × it)", () => {
    // before: hp = 1.0 × e and the reward round(0.3 × hp)
    for (let e = 1; e <= 2000; e++)
      expect(crateReward(BLOCK_HP_K * e)).toBe(Math.round(0.3 * e));
    for (let seed = 1; seed <= 20; seed++) {
      const rows = kanaRun(seed);
      const track = buildTrack(seed, ROWS_PER_RUN, true);
      const expected = expectedArmy(rows, track.charges);
      const hp = hazardHp(track, expected);
      track.hazards.forEach((h, i) => {
        if (h.kind !== "block") return;
        const q = track.questions.filter((p) => p < h.pos).length;
        const e = expected[Math.min(q, expected.length - 1)] as number;
        expect(crateReward(hp[i] as number)).toBe(Math.round(0.3 * e));
      });
    }
  });

  it("crates and walls are hit from FIRE_RANGE (12) ahead, never past the next wall", () => {
    expect(FIRE_RANGE).toBe(PACK_WAKE);
    expect(FIRE_RANGE).toBe(12);
    const near = stepRun(range([wide(FIRE_RANGE - 0.1)], [1e9]), DT);
    expect(near.target).toBe(0);
    expect(near.damage[0]).toBeGreaterThan(0);
    const far = stepRun(range([wide(FIRE_RANGE + 0.1)], [1e9]), DT);
    expect(far.target).toBeNull();
    expect(far.damage[0]).toBe(0);
    // the wall: its opening grows from 12 ahead, not before
    const wallAt = (ahead: number): RunState => {
      const s = range([], []);
      return { ...s, track: { ...s.track, questions: [ahead, 100] } };
    };
    expect(stepRun(wallAt(FIRE_RANGE - 0.1), DT).gateTarget).not.toBeNull();
    expect(stepRun(wallAt(FIRE_RANGE + 0.1), DT).gateTarget).toBeNull();
    // a crate past the next wall takes nothing; the wall takes the fire
    const s0 = range([wide(8)], [1e9]);
    const walled = stepRun(
      { ...s0, track: { ...s0.track, questions: [5, 100] } },
      DT,
    );
    expect(walled.target).toBeNull();
    expect(walled.damage[0]).toBe(0);
    expect(walled.gateShare).toBe(1);
  });

  it("an unbroken crate adds nothing and clips as before", () => {
    const s = stepFor(range([wide(0.5)], [1e9], 20), 1);
    expect(s.lastCrate).toBe(null);
    expect(s.army).toBe(0);
  });

  it("a pack shot to 0 pays no crate reward", () => {
    const s0 = {
      ...range([pack(1.5)], [7 * ENEMY_HP], 20),
      damage: [7 * ENEMY_HP - 0.01],
    };
    const s = stepRun(s0, DT);
    expect(packSurvivors(s, 0)).toBe(0);
    expect(s.army).toBe(20);
    expect(s.lastCrate).toBe(null);
  });

  it("crate rewards never change streak or results", () => {
    let s = {
      ...range([wide(0.5)], [40]),
      damage: [39.99],
      streak: 3,
      results: [true, false],
    };
    s = stepFor(s, 1);
    expect(s.lastCrate).not.toBe(null);
    expect(s.streak).toBe(3);
    expect(s.results).toEqual([true, false]);
  });

  it("saws take no damage", () => {
    const sawAhead: Saw = { kind: "saw", pos: 1.5, mid: 0.5, amp: 0, phase: 0 };
    const s = stepFor(range([sawAhead], [0]), 0.5);
    expect(s.damage[0]).toBe(0);
    expect(s.target).toBe(null);
  });

  it("gives saws no hit points, and blocks and packs some", () => {
    const s = fresh(3, true);
    s.track.hazards.forEach((h, i) =>
      expect((s.hp[i] ?? 0) > 0).toBe(h.kind !== "saw"),
    );
  });

  it("never changes streak or results", () => {
    let s = { ...range([wide(0.5)], [1]), streak: 3, results: [true, false] };
    s = stepFor(s, 1);
    expect(isShattered(s, 0)).toBe(true);
    expect(s.streak).toBe(3);
    expect(s.results).toEqual([true, false]);
  });

  it("a pack runs at the army ENEMY_SPEED faster than the scroll from PACK_WAKE (12) ahead", () => {
    expect(PACK_WAKE).toBe(12);
    const far = range([pack(PACK_WAKE + 1)], [10 * ENEMY_HP]);
    expect(stepFor(far, 0.1).packs[0]?.pos).toBe(PACK_WAKE + 1);
    const near = range([pack(PACK_WAKE - 0.1)], [10 * ENEMY_HP]);
    const s = stepFor(near, 0.1);
    expect(s.packs[0]?.pos).toBeCloseTo(PACK_WAKE - 0.1 - ENEMY_SPEED * 0.1, 6);
  });

  it("a pack waits behind an unanswered wall, and runs once it is passed", () => {
    const s0 = range([pack(6)], [10 * ENEMY_HP]);
    const walled = { ...s0, track: { ...s0.track, questions: [0.3, 100] } };
    const waiting = stepFor(walled, 0.1);
    expect(waiting.packs[0]?.pos).toBe(6);
    const passed = stepFor(waiting, 0.3);
    expect(passed.next).toBe(1);
    expect(passed.packs[0]?.pos ?? 6).toBeLessThan(6);
  });

  it("a pack's crowd stays where it is across the track (it doesn't follow the army); its stream, the army's width, tracks the army no faster than TRACK_SPEED", () => {
    const s0 = {
      ...range([pack(5, 0.8)], [10 * ENEMY_HP]),
      horde: NARROW,
      x: 0.2,
      targetX: 0.2,
    };
    const s = stepFor({ ...s0, targetX: 0.6 }, 0.5);
    expect(s.packs[0]?.pos).toBeLessThan(5);
    expect(s.packs[0]?.x).toBe(0.8);
    expect(packMouth(s, 0)).toEqual(packMouth(s0, 0));
    const w = crowdWidth(s.army);
    const sp = packSpan(s, 0);
    expect(sp).toEqual(streamSpan(s, 0));
    expect(sp.right - sp.left).toBeCloseTo(w, 12);
    const moved = 0.8 - (sp.left + sp.right) / 2;
    expect(moved).toBeGreaterThan(0.05);
    expect(moved).toBeLessThanOrEqual(TRACK_SPEED * 0.5 + 1e-9);
  });

  it("fire kills one enemy per ENEMY_HP; the pack thins from the front, never narrows", () => {
    const s0 = range([pack(1.9)], [1e6 * ENEMY_HP], 20);
    const s = stepFor(s0, 0.5);
    expect(s.target).toBe(0);
    expect(s.damage[0]).toBeCloseTo(firepower(20) * 0.5, 6);
    const killed = Math.floor((s.damage[0] ?? 0) / ENEMY_HP);
    expect(packSurvivors(s, 0)).toBe(1e6 - killed);
    const narrow = { ...s, damage: [(1e6 - 4) * ENEMY_HP] };
    expect(packMouth(narrow, 0)).toEqual(packMouth(s, 0));
    expect(packSpan(narrow, 0)).toEqual(packSpan(s, 0));
    expect(packLength(narrow, 0)).toBeLessThan(packLength(s, 0));
  });
});

describe("fire by lane", () => {
  const cw = crowdWidth(20);
  const L = 0.5 - cw / 2;
  const R = 0.5 + cw / 2;
  const block = (pos: number, left: number, right: number): Block => ({
    kind: "block",
    pos,
    left,
    right,
  });
  const per = firepower(20) * DT;

  it("a crate in front of a pack takes the lanes it covers; the pack gets only the rest", () => {
    const s0 = range([block(1.5, 0, 0.5), pack(5)], [1e9, 1e9], 20, [0, 100]);
    expect(packSpan(s0, 1).left).toBeLessThanOrEqual(L);
    expect(packSpan(s0, 1).right).toBeGreaterThanOrEqual(R);
    const s = stepRun(s0, DT);
    const share = (0.5 - L) / cw;
    expect(s.damage[0]).toBeCloseTo(per * share, 9);
    expect(s.damage[1]).toBeCloseTo(per * (1 - share), 9);
    expect(s.targets.map((t) => t.index)).toEqual([0, 1]);
    expect(s.targets.reduce((a, t) => a + t.share, 0)).toBeCloseTo(1, 9);
  });

  it("a crate covering the whole army blocks the pack entirely", () => {
    const s0 = range([wide(1.5), pack(5)], [1e9, 1e9], 20, [0, 100]);
    const s = stepFor(s0, 0.5);
    expect(s.damage[0]).toBeCloseTo(firepower(20) * 0.5, 6);
    expect(s.damage[1]).toBe(0);
    expect(s.targets).toEqual([{ index: 0, share: 1 }]);
    expect(s.target).toBe(0);
  });

  it("two crates side by side both take fire", () => {
    const s0 = range([block(1.5, 0, 0.5), block(1.8, 0.5, 1)], [1e9, 1e9]);
    const s = stepRun(s0, DT);
    expect(s.damage[0]).toBeCloseTo(per / 2, 9);
    expect(s.damage[1]).toBeCloseTo(per / 2, 9);
    expect(s.targets).toHaveLength(2);
  });

  it("a crate pays out once; two shattering in one step both pay", () => {
    const hp = 40;
    const s0 = {
      ...range([block(1.5, 0, 0.5), block(1.8, 0.5, 1)], [hp, hp]),
      damage: [hp - 0.01, hp - 0.01],
    };
    const broke = stepRun(s0, DT);
    expect(isShattered(broke, 0) && isShattered(broke, 1)).toBe(true);
    expect(broke.army).toBe(20 + 2 * crateReward(hp));
    expect(broke.lastCrate).toEqual({
      gain: 2 * crateReward(hp),
      dist: broke.dist,
    });
    const later = stepFor(broke, 0.5);
    expect(later.army).toBe(broke.army);
    expect(later.targets).toEqual([]);
  });
});
