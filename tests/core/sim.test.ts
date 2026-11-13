import { describe, expect, it } from "vitest";
import {
  crateReward,
  createRunState,
  gateOpenings,
  hazardPos,
  isShattered,
  packConverge,
  packLength,
  packStreaming,
  rowOpenings,
  packMouth,
  packSpan,
  packSurvivors,
  wallSolids,
  nearestOpening,
  nudgeTarget,
  setTarget,
  stepRun,
  type Opening,
  type RunState,
} from "../../src/core/sim";
import { crowdWidth } from "../../src/core/crowd";
import {
  expectedArmy,
  firepower,
  packCount,
  packStrength,
} from "../../src/core/fire";
import { kanaRun } from "./kana-run";
import {
  buildTrack,
  hazardSpan,
  type Block,
  type Pack,
  type Saw,
} from "../../src/core/track";
import {
  BASE_SPEED,
  CRATE_REWARD_K,
  CROWD_MAX_W,
  ENEMY_HP,
  HORDE_AREA,
  HORDE_DEFAULTS,
  HORDE_THREAT,
  PACK_COLUMN_MAX,
  STREAM_DISTANCE,
  KILL_SECONDS,
  PACK_WIDTH,
  PACK_WAKE,
  ENEMY_SPEED,
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

/** A seeded run of wall gates (squad charges are in squad.test.ts). Hazards are off unless asked for, so row tests stay about rows. */
function fresh(seed = 1, hazards = false): RunState {
  const track = buildTrack(seed, ROWS_PER_RUN, false);
  return createRunState(
    kanaRun(seed),
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
    const results = Array.from({ length: 50 }, (_, seed) => skilledRun(seed));
    expect(results.filter((r) => r.hazardLoss > 0)).toEqual([]);
  }, 30_000); // 50 full runs at 60 Hz; slow under parallel load

  it("a run to the last question takes about 60 seconds", () => {
    const times = Array.from(
      { length: 10 },
      (_, seed) => skilledRun(seed).time,
    );
    expect(Math.min(...times)).toBeGreaterThan(50);
    expect(Math.max(...times)).toBeLessThan(70);
  }, 30_000);
});

describe("shooting", () => {
  const wide = (pos: number): Block => ({
    kind: "block",
    pos,
    left: 0,
    right: 1,
  });
  /**
   * One far-off question, the given hazards, and chosen hit points; packs get
   * one enemy per ENEMY_HP unless `heads` says otherwise.
   */
  function range(
    hazards: (Block | Saw | Pack)[],
    hp: number[],
    army = 20,
    heads = hp.map((h) => Math.round(h / ENEMY_HP)),
    strength = hp.map((h) => h / ENEMY_HP),
  ): RunState {
    const s = createRunState(kanaRun(1), {
      questions: [100],
      hazards,
      charges: [],
    });
    return { ...s, hp, heads, strength, army };
  }
  const pack = (pos: number, x = 0.5): Pack => ({ kind: "pack", pos, x });
  /** Packs narrower than the track, so they can miss the crowd. */
  const NARROW = { ...HORDE_DEFAULTS, packWidth: 0.1 };
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

  it("a shattered crate adds round(CRATE_REWARD_K × hp) exactly once", () => {
    const hp = 40;
    const s0 = { ...range([wide(0.5)], [hp]), damage: [hp - 0.01] };
    const broke = stepRun(s0, DT);
    expect(isShattered(broke, 0)).toBe(true);
    expect(broke.army).toBe(20 + crateReward(hp));
    expect(crateReward(hp)).toBe(Math.round(CRATE_REWARD_K * hp));
    expect(broke.lastCrate).toEqual({
      gain: crateReward(hp),
      dist: broke.dist,
    });
    // passing it later pays nothing more and doesn't clip
    const passed = stepFor(broke, 1);
    expect(passed.nextHazard).toBe(1);
    expect(passed.army).toBe(broke.army);
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

  it("a pack stays where it is across the track as it charges (it doesn't follow the army)", () => {
    const s0 = {
      ...range([pack(5, 0.8)], [10 * ENEMY_HP]),
      horde: NARROW,
      x: 0.2,
      targetX: 0.2,
    };
    const s = stepFor({ ...s0, targetX: 0.6 }, 0.5);
    expect(s.packs[0]?.pos).toBeLessThan(5);
    expect(s.packs[0]?.x).toBe(0.8);
    expect(packSpan(s, 0)).toEqual(packMouth(s0, 0));
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

  describe("stream contact", () => {
    /** Steps until pack 0 is passed (or the run ends), recording the army and the losses per step. */
    const stream = (s0: RunState, max = 5) => {
      let s = s0;
      const losses: number[] = [];
      const states: RunState[] = [];
      for (let n = 0; n < max / DT && s.nextHazard === 0; n++) {
        const next = stepRun(s, DT);
        losses.push(s.army - next.army);
        states.push(next);
        s = next;
        if (s.status !== "running") break;
      }
      return { s, losses, states };
    };

    it("a pack that arrives untouched costs HORDE_THREAT × strength in total, a few soldiers at a time", () => {
      for (const [heads, strength] of [
        [200, 160],
        [2_000, 133],
        [20_000, 100],
        [15, 7],
      ] as const) {
        // so many hit points that the fire never kills one
        const s0 = range([pack(0.3)], [1e12], 1000, [heads], [strength]);
        const { s, losses, states } = stream(s0);
        expect(s.nextHazard).toBe(1);
        expect(1000 - s.army).toBe(Math.round(HORDE_THREAT * strength));
        // each enemy that arrives costs HORDE_THREAT × strength / heads (the running total rounded)
        for (const r of states)
          expect(1000 - r.army).toBe(
            Math.round((HORDE_THREAT * strength * (r.arrived[0] ?? 0)) / heads),
          );
        if (HORDE_THREAT * strength >= 10)
          expect(losses.filter((l) => l > 0).length).toBeGreaterThanOrEqual(5);
      }
    });

    it("the front stays at the army while enemies stream in, and the survivors drop as they arrive", () => {
      const s0 = range([pack(0.3)], [1e12], 1000, [200], [160]);
      const { states } = stream(s0);
      const streaming = states.filter((r) => packStreaming(r, 0));
      expect(streaming.length).toBeGreaterThan(5);
      for (const r of streaming) {
        expect(hazardPos(r, 0)).toBe(r.dist);
        expect(packSurvivors(r, 0)).toBe(
          Math.ceil(200 - (r.arrived[0] ?? 0) - 1e-6),
        );
      }
    });

    it("stops costing soldiers when the pack is shot out mid-stream", () => {
      // 100 soldiers fire 100 HP/s: 12 HP lasts 0.12 s, the stream about 0.2 s
      const s0 = range([pack(0.001)], [12], 100, [200], [100]);
      const { s, states } = stream(s0);
      expect(s.nextHazard).toBe(1);
      const lost = 100 - s.army;
      expect(lost).toBeGreaterThan(0);
      expect(lost).toBeLessThan(Math.round(HORDE_THREAT * 100));
      const out = states.findIndex((r) => packSurvivors(r, 0) === 0);
      expect(out).toBeGreaterThan(0);
      expect(states[out]?.lastShatter?.index).toBe(0);
      // nothing is lost after it is shot out
      for (const r of states.slice(out)) expect(r.army).toBe(s.army);
      expect(stepFor(s, 0.5).army).toBe(s.army);
    });

    it("fits a pack's column in PACK_COLUMN_MAX: even 20,000 stream in within PACK_COLUMN_MAX / the closing speed", () => {
      const scale = HORDE_DEFAULTS.hordeScale;
      for (const heads of [3, 200, 2_000, 20_000]) {
        const s0 = range([pack(0.001)], [1e12], 1000, [heads], [100]);
        const natural = (heads * HORDE_AREA * scale ** 2) / crowdWidth(1000);
        expect(packLength(s0, 0)).toBeCloseTo(
          Math.min(natural, PACK_COLUMN_MAX),
          9,
        );
        const { s, states } = stream(s0);
        expect(s.nextHazard).toBe(1);
        const secs = states.length * DT;
        expect(secs).toBeLessThanOrEqual(
          Math.min(natural, PACK_COLUMN_MAX) / (BASE_SPEED + ENEMY_SPEED) +
            2 * DT,
        );
      }
    });

    it("holds the hazards behind a streaming pack until it is done", () => {
      const s0 = range(
        [pack(0.001), wide(0.05)],
        [1e12, 1e12],
        1000,
        [20_000, 0],
        [100, 0],
      );
      let s = s0;
      while (packStreaming(s, 0) || s.dist < 0.01) {
        expect(s.nextHazard).toBe(0);
        s = stepRun(s, DT);
      }
      expect(s.nextHazard).toBeGreaterThanOrEqual(1);
    });

    it("merges a pack charging right behind another into one column: one target, one stream", () => {
      const s0 = range(
        [pack(2), pack(4)],
        [1e12, 1e12],
        1000,
        [200, 200],
        [100, 100],
      );
      let s = s0;
      let joined = false;
      let gap = Infinity;
      let lastFirst = -1;
      for (let n = 0; n < 5 / DT && s.nextHazard < 2; n++) {
        s = stepRun(s, DT);
        if (s.nextHazard === 0) {
          const tail = hazardPos(s, 0) + packLength(s, 0);
          if (Math.abs(hazardPos(s, 1) - tail) < 1e-9) joined = true;
          // the pack in front takes the fire
          if (s.target !== null) expect(s.target).toBe(0);
        }
        if (s.nextHazard === 1 && lastFirst < 0) lastFirst = n;
        if (lastFirst >= 0 && gap === Infinity && packStreaming(s, 1))
          gap = n - lastFirst;
      }
      expect(joined).toBe(true);
      // the second streams in right after the first
      expect(gap).toBeLessThanOrEqual(1);
      expect(s.nextHazard).toBe(2);
      expect(1000 - s.army).toBe(2 * Math.round(HORDE_THREAT * 100));
    });

    it("a 2,000 or 20,000 pack never streams across a wall in a real run", () => {
      for (const packMax of [2_000, 20_000])
        for (const seed of [1, 2, 3]) {
          const tuning = { ...HORDE_DEFAULTS, hordeK: 10_000, packMax };
          let s = createRunState(
            kanaRun(seed),
            buildTrack(seed, ROWS_PER_RUN, false),
            null,
            tuning,
          );
          s = { ...s, army: 5000 };
          for (let n = 0; n < 200 / DT && s.status === "running"; n++) {
            const row = s.rows[s.next];
            const o = rowOpenings(s, s.next)[row?.answerIndex ?? 0];
            const next = stepRun(setTarget(s, o?.centre ?? 0.5), DT);
            if (next.next > s.next)
              for (let i = s.nextHazard; i < s.packs.length; i++)
                expect(packStreaming(s, i)).toBe(false);
            s = next;
          }
          expect(s.status).toBe("finished");
        }
    });
  });

  describe("hordes", () => {
    it("packs start with packCount heads sharing KILL_SECONDS × the expected army's firepower", () => {
      const rows = kanaRun(1);
      const track = buildTrack(1, ROWS_PER_RUN, false);
      const s = createRunState(rows, track);
      const expected = expectedArmy(rows, track.charges);
      let packs = 0;
      track.hazards.forEach((h, i) => {
        if (h.kind !== "pack") {
          expect(s.strength[i]).toBe(0);
          return expect(s.heads[i]).toBe(0);
        }
        packs++;
        const q = track.questions.filter((p) => p < h.pos).length;
        const e = expected[Math.min(q, expected.length - 1)] ?? 0;
        expect(s.hp[i]).toBeCloseTo(KILL_SECONDS * firepower(e), 9);
        expect(s.strength[i]).toBe(packStrength(e));
        expect(s.heads[i]).toBe(packCount(e));
        expect(packSurvivors(s, i)).toBe(packCount(e));
      });
      expect(packs).toBeGreaterThan(0);
    });

    it("a full pack under the expected army's steady fire dies in KILL_SECONDS (± 10%)", () => {
      for (const [expected, heads] of [
        [5, 15],
        [40, 120],
        [300, 200],
        [300, 20_000],
      ] as const) {
        const hp = KILL_SECONDS * firepower(expected);
        let s = range([pack(1.9)], [hp], expected, [heads]);
        let t = 0;
        // held in front of the army, so only the fire counts
        while (packSurvivors(s, 0) > 0 && t < 10) {
          s = stepRun({ ...s, packs: [{ pos: s.dist + 1.9, x: 0.5 }] }, DT);
          t += DT;
        }
        expect(t).toBeGreaterThan(0.9 * KILL_SECONDS);
        expect(t).toBeLessThan(1.1 * KILL_SECONDS);
      }
    });

    it("is built with HORDE_DEFAULTS unless given a tuning, which changes the heads", () => {
      const rows = kanaRun(1);
      const track = buildTrack(1, ROWS_PER_RUN, false);
      const s = createRunState(rows, track);
      expect(s.horde).toEqual(HORDE_DEFAULTS);
      const big = { ...HORDE_DEFAULTS, hordeK: 10_000, packMax: 20_000 };
      const t = createRunState(rows, track, null, big);
      expect(t.horde).toBe(big);
      const expected = expectedArmy(rows, track.charges);
      track.hazards.forEach((h, i) => {
        if (h.kind !== "pack") return expect(t.heads[i]).toBe(0);
        const q = track.questions.filter((p) => p < h.pos).length;
        const e = expected[Math.min(q, expected.length - 1)] ?? 0;
        expect(t.heads[i]).toBe(packCount(e, big));
        expect(t.heads[i]).toBe(20_000);
        expect(t.hp[i]).toBe(s.hp[i]);
      });
    });

    it("survivors drop by one per per-enemy HP of damage, exactly", () => {
      for (const [strength, heads] of [
        [6, 15],
        [7, 21],
        [41, 200],
        [133, 200],
        [133, 20_000],
      ] as const) {
        const hp = strength * ENEMY_HP;
        const per = hp / heads;
        const s0 = range([pack(1.9)], [hp], 20, [heads]);
        expect(packSurvivors(s0, 0)).toBe(heads);
        for (let k = 0; k <= heads; k += heads > 1000 ? 97 : 1) {
          const at = (d: number): RunState => ({ ...s0, damage: [d] });
          expect(packSurvivors(at(k * per), 0)).toBe(heads - k);
          if (k < heads)
            expect(packSurvivors(at((k + 0.5) * per), 0)).toBe(heads - k);
        }
        expect(packSurvivors({ ...s0, damage: [hp] }, 0)).toBe(0);
      }
    });

    it("its mouth is PACK_WIDTH wide, centred where the pack is and on the track, whole or shot", () => {
      expect(PACK_WIDTH).toBe(1);
      const s0 = range([pack(1.9, 0.3)], [70], 20, [210], [28]);
      const half = { ...HORDE_DEFAULTS, packWidth: 0.5 };
      for (const f of [1, 0.5, 0.01])
        for (const horde of [HORDE_DEFAULTS, half, NARROW]) {
          const span = packMouth({ ...s0, horde, damage: [70 * (1 - f)] }, 0);
          const w = horde.packWidth;
          expect(span.right - span.left).toBeCloseTo(w, 12);
          expect(span.left).toBeGreaterThanOrEqual(-1e-12);
          expect(span.right).toBeLessThanOrEqual(1 + 1e-12);
          expect((span.left + span.right) / 2).toBeCloseTo(
            Math.min(1 - w / 2, Math.max(w / 2, 0.3)),
            12,
          );
        }
    });

    it("a pack dies in the same steps under steady fire, whatever its head count", () => {
      const steps = (heads: number): number => {
        let s = range([pack(1.9)], [12 * ENEMY_HP], 20, [heads]);
        let n = 0;
        while (packSurvivors(s, 0) > 0 && n < 10_000) {
          s = stepRun(s, DT);
          n++;
        }
        return n;
      };
      const today = steps(12);
      expect(today).toBeGreaterThan(1);
      expect(today).toBeLessThan(10_000);
      expect(steps(36)).toBe(today);
      expect(steps(200)).toBe(today);
    });
  });

  it("a pack's span is its mouth beyond STREAM_DISTANCE, closing into the army's column (as wide as the army, centred on it) at contact", () => {
    for (const [army, x, packX] of [
      [20, 0.1, 0.9],
      [200, 0.5, 0.2],
      [5, 0.85, 0.5],
    ] as const) {
      const s0 = {
        ...range([pack(5, packX)], [1e9], army),
        horde: NARROW,
        x,
        targetX: x,
      };
      const at = (ahead: number): RunState => ({
        ...s0,
        packs: [{ pos: ahead, x: packX }],
      });
      expect(packConverge(at(STREAM_DISTANCE + 0.5), 0)).toBe(0);
      expect(packSpan(at(STREAM_DISTANCE + 0.5), 0)).toEqual(packMouth(s0, 0));
      expect(packConverge(at(STREAM_DISTANCE / 2), 0)).toBeCloseTo(0.5, 12);
      const w = crowdWidth(army);
      const col = packSpan(at(0), 0);
      expect(packConverge(at(0), 0)).toBe(1);
      expect(col.left).toBeCloseTo(x - w / 2, 12);
      expect(col.right).toBeCloseTo(x + w / 2, 12);
      // waiting behind a wall it stays wide
      const walled = {
        ...at(1),
        track: { ...s0.track, questions: [0.5, 100] },
      };
      expect(packConverge(walled, 0)).toBe(0);
    }
    // a narrow pack far to the side still reaches the army
    const s = stepFor(
      {
        ...range([pack(1, 0.9)], [1e9], 20, [20], [20]),
        horde: NARROW,
        x: 0.1,
        targetX: 0.1,
      },
      1,
    );
    expect(s.army).toBeLessThan(20);
  });

  it("a pack shot to 0 costs nothing", () => {
    const s0 = {
      ...range([pack(0.02)], [7 * ENEMY_HP], 20),
      damage: [7 * ENEMY_HP],
    };
    const s = stepRun(s0, DT);
    expect(s.nextHazard).toBe(1);
    expect(s.army).toBe(20);
  });

  it("enemy losses never change streak or results, and an army reaching 0 ends the run", () => {
    const s0 = {
      ...range([pack(0.02)], [500 * ENEMY_HP], 5),
      streak: 3,
      results: [true, false],
    };
    const s = stepFor(s0, 1);
    expect(s.army).toBe(0);
    expect(s.status).toBe("dead");
    expect(s.streak).toBe(3);
    expect(s.results).toEqual([true, false]);
  });
});

describe("pace", () => {
  it("scales the scroll by the speed preset's multiplier", () => {
    const full = stepRun(fresh(), 0.1);
    const slow = stepRun(fresh(), 0.1, 0.7);
    expect(slow.dist).toBeCloseTo(full.dist * 0.7);
  });
});
