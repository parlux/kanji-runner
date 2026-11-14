import { describe, expect, it } from "vitest";
import {
  createRunState,
  nudgeTarget,
  setTarget,
  stepRun,
  type RunState,
} from "../../src/core/sim";
import { gateOpenings } from "../../src/core/gates";
import { crowdWidth } from "../../src/core/crowd";
import { hazardSpan, type Block, type Saw } from "../../src/core/track";
import {
  BASE_SPEED,
  CROWD_MAX_W,
  ROWS_PER_RUN,
  STARTING_ARMY,
  STEER_MAX_SPEED,
  VIEW_DISTANCE,
} from "../../src/core/tuning";
import { forSeeds } from "../sweep";
import { DT, goToOpening, fresh, rowPos } from "./sim-helpers";

describe("createRunState", () => {
  it("starts running with the starting army at distance 0", () => {
    const s = fresh();
    expect(s).toMatchObject({
      status: "running",
      army: STARTING_ARMY,
      streak: 0,
      next: 0,
      dist: 0,
    });
    expect(s.results).toEqual([]);
  });
});

describe("lead time", () => {
  /** Seconds from a row entering view to the army reaching it. */
  function leadTimes(): number[] {
    let s = fresh();
    let t = 0;
    const appear: number[] = [];
    const reach: number[] = [];
    while (s.status === "running") {
      // keep the army alive: always pick the answer
      s = goToOpening(s, s.rows[s.next]?.answerIndex ?? 0);
      for (let i = 0; i < s.rows.length; i++) {
        if (appear[i] === undefined && rowPos(s, i) - s.dist <= VIEW_DISTANCE)
          appear[i] = t;
      }
      const before = s.next;
      s = stepRun(s, DT);
      t += DT;
      if (s.next > before) reach[before] = t;
    }
    return reach.map((r, i) => r - (appear[i] ?? 0));
  }

  it("is VIEW_DISTANCE / BASE_SPEED for the first row and 1.3× shorter for the last", () => {
    const lead = leadTimes();
    const first = VIEW_DISTANCE / BASE_SPEED;
    expect(lead).toHaveLength(ROWS_PER_RUN);
    expect(lead[0]).toBeCloseTo(first, 1);
    expect(lead[ROWS_PER_RUN - 1]).toBeGreaterThan(first / 1.3 - 0.1);
    expect(lead[ROWS_PER_RUN - 1]).toBeLessThan(first / 1.3 + 0.1);
  });

  it("never increases from one row to the next", () => {
    const lead = leadTimes();
    for (let i = 1; i < lead.length; i++)
      expect(lead[i]).toBeLessThanOrEqual((lead[i - 1] as number) + 1e-9);
  });
});

describe("steering", () => {
  it("never moves faster than STEER_MAX_SPEED", () => {
    let s = setTarget(fresh(), 1);
    for (let i = 0; i < 60; i++) {
      const before = s.x;
      s = stepRun(s, DT);
      expect(Math.abs(s.x - before)).toBeLessThanOrEqual(
        STEER_MAX_SPEED * DT + 1e-12,
      );
    }
  });

  it("reaches the target without overshooting", () => {
    let s = setTarget(fresh(), 0.9);
    for (let i = 0; i < 120; i++) {
      s = stepRun(s, DT);
      expect(s.x).toBeLessThanOrEqual(0.9 + 1e-12);
    }
    expect(s.x).toBeCloseTo(0.9, 3);
  });

  it("eases: slower near the target than far from it", () => {
    let s = { ...setTarget(fresh(), 0.52), x: 0.5 };
    const near = stepRun(s, DT).x - s.x;
    s = { ...setTarget(fresh(), 1), x: 0.5 };
    const far = stepRun(s, DT).x - s.x;
    expect(near).toBeLessThan(far);
  });

  it.each([5, 400])(
    "keeps the target and the whole crowd on the track (army %i)",
    (army) => {
      const half = crowdWidth(army) / 2;
      let s: RunState = { ...fresh(), army };
      s = nudgeTarget(s, 5);
      expect(s.targetX).toBeCloseTo(1 - half, 12);
      s = nudgeTarget(s, -5);
      expect(s.targetX).toBeCloseTo(half, 12);
      s = setTarget({ ...s, x: 0.01 }, -3);
      for (let i = 0; i < 30; i++) {
        s = stepRun(s, DT);
        expect(s.x - half).toBeGreaterThanOrEqual(-1e-12);
        expect(s.x + half).toBeLessThanOrEqual(1 + 1e-12);
      }
    },
  );

  it("does nothing once the run is over", () => {
    const s: RunState = { ...fresh(), status: "dead" };
    expect(setTarget(s, 1)).toBe(s);
    expect(nudgeTarget(s, 0.1)).toBe(s);
  });
});

describe("hazards", () => {
  /** A fresh run with one block just ahead of the crowd. */
  function beforeBlock(left: number, right: number, army = 100): RunState {
    const s = fresh();
    const block: Block = { kind: "block", pos: 1, left, right };
    return {
      ...s,
      army,
      track: { ...s.track, hazards: [block] },
      dist: 1 - 1e-6,
    };
  }

  it("a block overlapping the crowd clips it, without touching streak or results", () => {
    const base = { ...beforeBlock(0.4, 0.6), streak: 3 };
    // crowd width 0.30 at x 0.5: 0.2 of 0.3 overlaps
    const s = stepRun(base, DT);
    const clip = Math.ceil((100 * 0.2) / 0.3 - 1e-9);
    expect(s.lastClip?.loss).toBe(clip);
    expect(s.army).toBe(100 - clip);
    expect(s.streak).toBe(3);
    expect(s.results).toEqual([]);
    expect(s.nextHazard).toBe(1);
  });

  it("a crowd that steers clear of a block loses nothing", () => {
    const base = beforeBlock(0, 0.35);
    const x = 1 - CROWD_MAX_W / 2;
    const s = stepRun({ ...base, x, targetX: x }, DT);
    expect(s.army).toBe(100);
    expect(s.lastClip).toBeNull();
  });

  it("a crowd clipped to nothing by a block ends the run", () => {
    const s = stepRun(beforeBlock(0.3, 0.7, 4), DT);
    expect(s.army).toBe(0);
    expect(s.status).toBe("dead");
  });

  it("a saw clips where it is when the crowd passes, not where it started", () => {
    const s = fresh();
    // centre = 0.5 + 0.3·sin(π/2 + dist·SAW_RATE): 0.8 at dist 0, elsewhere at dist 1
    const saw: Saw = {
      kind: "saw",
      pos: 1,
      mid: 0.5,
      amp: 0.3,
      phase: Math.PI / 2,
    };
    const at = hazardSpan(saw, 1);
    const x = (at.left + at.right) / 2;
    const base: RunState = {
      ...s,
      army: 100,
      x,
      targetX: x,
      track: { ...s.track, hazards: [saw] },
      dist: 1 - 1e-6,
    };
    expect(stepRun(base, DT).lastClip?.loss).toBeGreaterThan(0);
    const away = { ...base, x: 0.85, targetX: 0.85 };
    expect(Math.abs(0.85 - x)).toBeGreaterThan(0.2);
    expect(stepRun(away, DT).lastClip).toBeNull();
  });

  /** Steers to the answer at each question and to the widest gap at each block or saw (packs removed). */
  function skilledRun(seed: number): { hazardLoss: number; time: number } {
    const withPacks = fresh(seed, true);
    const hazards = withPacks.track.hazards.filter((h) => h.kind !== "pack");
    let s = createRunState(withPacks.rows, { ...withPacks.track, hazards });
    let hazardLoss = 0;
    let time = 0;
    while (s.status === "running") {
      const h = s.track.hazards[s.nextHazard];
      const rowAt = s.track.questions[s.next] ?? Infinity;
      if (h && h.kind !== "pack" && h.pos < rowAt) {
        // where the hazard will be when the crowd reaches it
        const { left, right } = hazardSpan(h, h.pos);
        const x = left > 1 - right ? left / 2 : (1 + right) / 2;
        s = setTarget(s, x);
      } else {
        const n = s.rows[s.next]?.options.length ?? 2;
        const o = gateOpenings(n)[s.rows[s.next]?.answerIndex ?? 0];
        s = setTarget(s, o?.centre ?? 0.5);
      }
      const before = s;
      s = stepRun(s, DT);
      time += DT;
      if (s.nextHazard > before.nextHazard) hazardLoss += before.army - s.army;
    }
    return { hazardLoss, time };
  }

  it("a skilled player can dodge every hazard and finish (50 seeds)", () => {
    const results = forSeeds(50, 10).map((seed) => skilledRun(seed));
    expect(results.filter((r) => r.hazardLoss > 0)).toEqual([]);
  }, 30_000); // 50 full runs at 60 Hz; slow under parallel load

  it("a run to the last question takes about 60–75 seconds", () => {
    const times = Array.from(
      { length: 10 },
      (_, seed) => skilledRun(seed).time,
    );
    expect(Math.min(...times)).toBeGreaterThan(50);
    expect(Math.max(...times)).toBeLessThan(80); // a pack gap always has 3 beats (H5g): ~7% longer than 2–3
  }, 30_000);
});

describe("pace", () => {
  it("scales the scroll by the speed preset's multiplier", () => {
    const full = stepRun(fresh(), 0.1);
    const slow = stepRun(fresh(), 0.1, 0.7);
    expect(slow.dist).toBeCloseTo(full.dist * 0.7);
  });
});
