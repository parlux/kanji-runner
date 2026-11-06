import { describe, expect, it } from "vitest";
import {
  createRunState,
  rowPosition,
  steer,
  stepRun,
  type RunState,
} from "../../src/core/sim";
import { buildKanaRun } from "../../src/core/run";
import { KANA } from "../../src/core/kana";
import {
  ROWS_PER_RUN,
  STARTING_ARMY,
  VIEW_DISTANCE,
} from "../../src/core/tuning";

const DT = 1 / 60;

/** Steps until the next row resolves; returns the new state. */
function runToNextRow(s: RunState): RunState {
  const target = s.next + 1;
  while (s.next < target && s.status === "running") s = stepRun(s, DT);
  return s;
}

/** Puts the army in the given lane (from lane 0). */
function goToLane(s: RunState, lane: number): RunState {
  while (s.lane > 0) s = steer(s, -1);
  for (let i = 0; i < lane; i++) s = steer(s, 1);
  return s;
}

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
      s = goToLane(s, s.rows[s.next]?.answerIndex ?? 0);
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

describe("steer", () => {
  it("clamps to the lanes of the next row", () => {
    let s = fresh();
    const lanes = s.rows[0]?.options.length ?? 0;
    for (let i = 0; i < 5; i++) s = steer(s, 1);
    expect(s.lane).toBe(lanes - 1);
    for (let i = 0; i < 5; i++) s = steer(s, -1);
    expect(s.lane).toBe(0);
  });

  it("does nothing once the run is over", () => {
    const s: RunState = { ...fresh(), status: "dead" };
    expect(steer(s, 1)).toBe(s);
  });
});

describe("row resolution", () => {
  it("a correct lane grows the army and the streak", () => {
    let s = fresh();
    s = goToLane(s, s.rows[0]?.answerIndex ?? 0);
    s = runToNextRow(s);
    expect(s.army).toBe(STARTING_ARMY + 3);
    expect(s.streak).toBe(1);
    expect(s.results).toEqual([true]);
  });

  it("a wrong lane costs army and resets the streak, and 0 ends the run", () => {
    let s = fresh();
    s = goToLane(s, 1 - (s.rows[0]?.answerIndex ?? 0));
    s = runToNextRow(s);
    expect(s.army).toBe(0);
    expect(s.streak).toBe(0);
    expect(s.results).toEqual([false]);
    expect(s.status).toBe("dead");
  });

  it("keeps the lane on the same side when lanes go from 2 to 3", () => {
    let s = fresh();
    for (let i = 0; i < 9; i++) {
      s = goToLane(s, s.rows[s.next]?.answerIndex ?? 0);
      s = runToNextRow(s);
    }
    s = goToLane(s, 1); // right lane of row 10 (2 lanes)
    s = runToNextRow(s);
    expect(s.rows[s.next]?.options).toHaveLength(3);
    expect(s.lane).toBe(2);
  });

  it("finishes after all rows with 100% accuracy", () => {
    let s = fresh();
    while (s.status === "running") {
      s = goToLane(s, s.rows[s.next]?.answerIndex ?? 0);
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
