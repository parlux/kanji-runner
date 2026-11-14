import { describe, expect, it } from "vitest";
import { stepRun, type RunState } from "../../src/core/sim";
import {
  gateOpenings,
  wallSolids,
  nearestOpening,
  type Opening,
} from "../../src/core/gates";
import { ROWS_PER_RUN, STARTING_ARMY } from "../../src/core/tuning";
import {
  DT,
  runToNextRow,
  goToOpening,
  at,
  fresh,
  rowPos,
} from "./sim-helpers";

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
      expect(nearestOpening(gateOpenings(3), r.left + 0.001)).toBe(i);
      expect(nearestOpening(gateOpenings(3), r.right - 0.001)).toBe(i);
    });
  });

  it("picks the nearest opening when the centre is on solid wall", () => {
    const o = gateOpenings(2);
    const [a, b] = [at(o, 0), at(o, 1)];
    expect(nearestOpening(gateOpenings(2), 0)).toBe(0);
    expect(nearestOpening(gateOpenings(2), 1)).toBe(1);
    expect(nearestOpening(gateOpenings(2), a.right + 0.01)).toBe(0);
    expect(nearestOpening(gateOpenings(2), b.left - 0.01)).toBe(1);
    expect(nearestOpening(gateOpenings(3), 0.01)).toBe(0);
    expect(nearestOpening(gateOpenings(3), 0.99)).toBe(2);
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

  it("records the last answer and its army change for feedback", () => {
    let s = fresh();
    expect(s.lastAnswer).toBeNull();
    const answer = s.rows[0]?.answerIndex ?? 0;
    s = runToNextRow(goToOpening(s, answer));
    expect(s.lastAnswer).toMatchObject({
      correct: true,
      choice: answer,
      change: 3,
    });
    s = runToNextRow(goToOpening(s, 1 - (s.rows[1]?.answerIndex ?? 0)));
    expect(s.lastAnswer?.correct).toBe(false);
    expect(s.lastAnswer?.change).toBeLessThan(0);
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

describe("wall clipping", () => {
  /** The first row with n options, with the crowd sitting just before it. */
  function atRow(n: number, army: number, streak = 0): RunState {
    const s = fresh();
    const i = s.rows.findIndex((r) => r.options.length === n);
    return { ...s, army, streak, next: i, dist: rowPos(s, i) - 1e-6 };
  }

  it("wall solids are the complement of the openings", () => {
    for (const n of [2, 3]) {
      const solids = wallSolids(gateOpenings(n));
      const open = gateOpenings(n);
      expect(solids).toHaveLength(n + 1);
      expect(at(open, 0).left).toBeCloseTo((solids[0] as Opening).right, 12);
      const total = solids.reduce((t, r) => t + r.right - r.left, 0);
      const openW = open.reduce((t, r) => t + r.right - r.left, 0);
      expect(total + openW).toBeCloseTo(1, 12);
    }
  });

  it("a max-width crowd threads a 2-answer opening without loss", () => {
    let s = atRow(2, 400);
    s = goToOpening(s, s.rows[s.next]?.answerIndex ?? 0);
    s = stepRun(s, DT);
    expect(s.lastClip).toBeNull();
    expect(s.army).toBeGreaterThan(400);
  });

  it("a max-width crowd centred in a 3-answer opening is clipped, then scored", () => {
    let s = atRow(3, 400);
    const answer = s.rows[s.next]?.answerIndex ?? 0;
    s = goToOpening(s, answer);
    // 0.30 crowd in a 0.26 opening: 0.04 of 0.30 overlaps → ceil(400 × 0.04 / 0.3)
    const clip = Math.ceil((400 * 0.04) / 0.3 - 1e-9);
    s = stepRun(s, DT);
    expect(s.lastClip?.loss).toBe(clip);
    expect(s.army).toBe(400 - clip + 3); // base reward on the remaining army
    expect(s.results.at(-1)).toBe(true);
  });

  it("clipping never changes the streak or the results", () => {
    for (const n of [2, 3]) {
      for (const pick of ["right", "wrong"] as const) {
        const base = atRow(n, 400, 2);
        const row = base.rows[base.next];
        const answer = row?.answerIndex ?? 0;
        const idx = pick === "right" ? answer : (answer + 1) % n;
        const o = at(gateOpenings(n), idx);
        // same chosen opening: centred (clean for 2) vs pushed against the wall
        const clean = stepRun({ ...base, x: o.centre, targetX: o.centre }, DT);
        const x = idx === 0 ? 0.2 : o.right; // centre still nearest idx
        const clipped = stepRun({ ...base, x, targetX: x }, DT);
        expect(clipped.lastClip?.loss ?? 0).toBeGreaterThan(0);
        expect(clipped.streak).toBe(clean.streak);
        expect(clipped.results).toEqual(clean.results);
      }
    }
  });

  it("a crowd clipped to nothing dies, but its answer is still recorded", () => {
    let s = atRow(2, 3);
    const answer = s.rows[s.next]?.answerIndex ?? 0;
    const x = answer === 0 ? 0.03 : 0.97; // fully on solid wall
    s = stepRun({ ...s, x, targetX: x }, DT);
    expect(s.army).toBe(0);
    expect(s.status).toBe("dead");
    expect(s.results.at(-1)).toBe(true);
  });
});
