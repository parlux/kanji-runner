import { describe, expect, it } from "vitest";
import {
  createRunState,
  gateOpenings,
  isShattered,
  wallSolids,
  nearestOpening,
  nudgeTarget,
  setTarget,
  stepRun,
  type Opening,
  type RunState,
} from "../../src/core/sim";
import { crowdWidth } from "../../src/core/crowd";
import { firepower } from "../../src/core/fire";
import { buildKanaRun } from "../../src/core/run";
import { KANA } from "../../src/core/kana";
import {
  buildTrack,
  hazardSpan,
  type Block,
  type Saw,
} from "../../src/core/track";
import {
  BASE_SPEED,
  CROWD_MAX_W,
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

/** A seeded run. Hazards are off unless asked for, so row tests stay about rows. */
function fresh(seed = 1, hazards = false): RunState {
  const track = buildTrack(seed, ROWS_PER_RUN);
  return createRunState(
    buildKanaRun(seed, KANA),
    hazards ? track : { ...track, hazards: [] },
  );
}

/** Track position of row i. */
const rowPos = (s: RunState, i: number): number =>
  s.track.questions[i] as number;

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
      const solids = wallSolids(n);
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

  /** Steers to the answer at each question and to the widest gap at each hazard. */
  function skilledRun(seed: number): { hazardLoss: number; time: number } {
    let s = fresh(seed, true);
    let hazardLoss = 0;
    let time = 0;
    while (s.status === "running") {
      const h = s.track.hazards[s.nextHazard];
      const rowAt = s.track.questions[s.next] ?? Infinity;
      if (h && h.pos < rowAt) {
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
    const results = Array.from({ length: 50 }, (_, seed) => skilledRun(seed));
    expect(results.filter((r) => r.hazardLoss > 0)).toEqual([]);
  }, 30_000); // 50 full runs at 60 Hz; slow under parallel load

  it("a run to the last question takes about 80 seconds", () => {
    const times = Array.from(
      { length: 10 },
      (_, seed) => skilledRun(seed).time,
    );
    expect(Math.min(...times)).toBeGreaterThan(70);
    expect(Math.max(...times)).toBeLessThan(110);
  }, 30_000);
});

describe("shooting", () => {
  const wide = (pos: number): Block => ({
    kind: "block",
    pos,
    left: 0,
    right: 1,
  });
  /** One far-off question, the given hazards, and chosen hit points. */
  function range(hazards: (Block | Saw)[], hp: number[], army = 20): RunState {
    const s = createRunState(buildKanaRun(1, KANA), {
      questions: [100],
      hazards,
    });
    return { ...s, hp, army };
  }
  const stepFor = (s: RunState, secs: number): RunState => {
    for (let t = 0; t < Math.round(secs / DT); t++) s = stepRun(s, DT);
    return s;
  };

  it("deals firepower × time, only to the nearest overlapping block", () => {
    let s = range([wide(1.9), wide(1.95)], [1e9, 1e9]);
    s = stepFor(s, 0.5);
    expect(s.damage[0]).toBeCloseTo(firepower(20) * 0.5, 6);
    expect(s.damage[1]).toBe(0);
    expect(s.target).toBe(0);
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

  it("saws take no damage", () => {
    const sawAhead: Saw = { kind: "saw", pos: 1.5, mid: 0.5, amp: 0, phase: 0 };
    const s = stepFor(range([sawAhead], [0]), 0.5);
    expect(s.damage[0]).toBe(0);
    expect(s.target).toBe(null);
  });

  it("gives saws no hit points, and blocks some", () => {
    const s = fresh(3, true);
    s.track.hazards.forEach((h, i) =>
      expect((s.hp[i] ?? 0) > 0).toBe(h.kind === "block"),
    );
  });

  it("never changes streak or results", () => {
    let s = { ...range([wide(0.5)], [1]), streak: 3, results: [true, false] };
    s = stepFor(s, 1);
    expect(isShattered(s, 0)).toBe(true);
    expect(s.streak).toBe(3);
    expect(s.results).toEqual([true, false]);
  });
});
