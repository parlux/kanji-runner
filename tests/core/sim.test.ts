import { describe, expect, it } from "vitest";
import {
  createRunState,
  gateOpenings,
  nearestOpening,
  nudgeTarget,
  rowPosition,
  setTarget,
  stepRun,
  type Opening,
  type RunState,
} from "../../src/core/sim";
import { buildKanaRun } from "../../src/core/run";
import { KANA } from "../../src/core/kana";
import {
  ROWS_PER_RUN,
  STARTING_ARMY,
  STEER_MAX_SPEED,
  VIEW_DISTANCE,
} from "../../src/core/tuning";

const DT = 1 / 60;

/** Steps until the next row resolves; returns the new state. */
function runToNextRow(s: RunState): RunState {
  const target = s.next + 1;
  while (s.next < target && s.status === "running") s = stepRun(s, DT);
  return s;
}

/** Places the crowd (and its target) at the centre of opening i of the next row. */
function goToOpening(s: RunState, i: number): RunState {
  const n = s.rows[s.next]?.options.length ?? 2;
  const x = gateOpenings(n)[i]?.centre ?? 0.5;
  return { ...s, x, targetX: x };
}

/** Indexes an openings array without undefined. */
const at = (o: Opening[], i: number): Opening => o[i] as Opening;

function fresh(seed = 1): RunState {
  return createRunState(buildKanaRun(seed, KANA));
}

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
        if (appear[i] === undefined && rowPosition(i) - s.dist <= VIEW_DISTANCE)
          appear[i] = t;
      }
      const before = s.next;
      s = stepRun(s, DT);
      t += DT;
      if (s.next > before) reach[before] = t;
    }
    return reach.map((r, i) => r - (appear[i] ?? 0));
  }

  it("is about 3.0 s for the first row and about 1.8 s for the last", () => {
    const lead = leadTimes();
    expect(lead).toHaveLength(ROWS_PER_RUN);
    expect(lead[0]).toBeCloseTo(3.0, 1);
    expect(lead[ROWS_PER_RUN - 1]).toBeGreaterThan(1.7);
    expect(lead[ROWS_PER_RUN - 1]).toBeLessThan(1.95);
  });

  it("never increases from one row to the next", () => {
    const lead = leadTimes();
    for (let i = 1; i < lead.length; i++)
      expect(lead[i]).toBeLessThanOrEqual((lead[i - 1] as number) + 1e-9);
  });
});

describe("gateOpenings", () => {
  it.each([2, 3])(
    "%i openings are equal width with equal solid between and at the edges",
    (n) => {
      const o = gateOpenings(n);
      expect(o).toHaveLength(n);
      const solids = [
        at(o, 0).left,
        ...o.slice(1).map((r, i) => r.left - at(o, i).right),
        1 - at(o, n - 1).right,
      ];
      for (const g of solids) expect(g).toBeCloseTo(solids[0] as number, 9);
      expect(at(o, 0).right - at(o, 0).left).toBeCloseTo(
        n === 2 ? 0.36 : 0.26,
        9,
      );
    },
  );
});

describe("nearestOpening", () => {
  it("picks the opening the centre is inside", () => {
    const o = gateOpenings(3);
    o.forEach((r, i) => {
      expect(nearestOpening(3, r.left + 0.001)).toBe(i);
      expect(nearestOpening(3, r.right - 0.001)).toBe(i);
    });
  });

  it("picks the nearest opening when the centre is on solid wall", () => {
    const o = gateOpenings(2);
    const [a, b] = [at(o, 0), at(o, 1)];
    expect(nearestOpening(2, 0)).toBe(0);
    expect(nearestOpening(2, 1)).toBe(1);
    expect(nearestOpening(2, a.right + 0.01)).toBe(0);
    expect(nearestOpening(2, b.left - 0.01)).toBe(1);
    expect(nearestOpening(3, 0.01)).toBe(0);
    expect(nearestOpening(3, 0.99)).toBe(2);
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

  it("keeps the target and the crowd within [0, 1]", () => {
    let s = fresh();
    s = nudgeTarget(s, 5);
    expect(s.targetX).toBe(1);
    s = nudgeTarget(s, -5);
    expect(s.targetX).toBe(0);
    s = setTarget({ ...fresh(), x: 0.01 }, -3);
    for (let i = 0; i < 30; i++) {
      s = stepRun(s, DT);
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThanOrEqual(1);
    }
  });

  it("does nothing once the run is over", () => {
    const s: RunState = { ...fresh(), status: "dead" };
    expect(setTarget(s, 1)).toBe(s);
    expect(nudgeTarget(s, 0.1)).toBe(s);
  });
});

describe("row resolution", () => {
  it("a correct opening grows the army and the streak", () => {
    let s = fresh();
    s = goToOpening(s, s.rows[0]?.answerIndex ?? 0);
    s = runToNextRow(s);
    expect(s.army).toBe(STARTING_ARMY + 3);
    expect(s.streak).toBe(1);
    expect(s.results).toEqual([true]);
  });

  it("a wrong opening costs army and resets the streak, and 0 ends the run", () => {
    let s = fresh();
    s = goToOpening(s, 1 - (s.rows[0]?.answerIndex ?? 0));
    s = runToNextRow(s);
    expect(s.army).toBe(0);
    expect(s.streak).toBe(0);
    expect(s.results).toEqual([false]);
    expect(s.status).toBe("dead");
  });

  it("scores the opening nearest the crowd even when it is on solid wall", () => {
    let s = fresh();
    const answer = s.rows[0]?.answerIndex ?? 0;
    const x = answer === 0 ? 0.01 : 0.99; // solid wall at the edge
    s = runToNextRow({ ...s, x, targetX: x });
    expect(s.results).toEqual([true]);
  });

  it("finishes after all rows with 100% accuracy", () => {
    let s = fresh();
    while (s.status === "running") {
      s = goToOpening(s, s.rows[s.next]?.answerIndex ?? 0);
      s = runToNextRow(s);
    }
    expect(s.status).toBe("finished");
    expect(s.results).toHaveLength(ROWS_PER_RUN);
    expect(s.results.every(Boolean)).toBe(true);
  });

  it("does not move once the run is over", () => {
    const s: RunState = { ...fresh(), status: "finished" };
    expect(stepRun(s, DT)).toBe(s);
  });
});
