import { Scene, type InstancedBufferAttribute, type Vector4 } from "three";
import { describe, expect, it } from "vitest";
import { crowdWidth } from "../../src/core/crowd";
import {
  createRunState,
  crowdFront,
  enemiesWon,
  packCrowd,
  packMouth,
  packSpan,
  stepRun,
  type RunState,
} from "../../src/core/sim";
import type { Track } from "../../src/core/track";
import {
  HORDE_DEFAULTS,
  PACK_COLUMN_MAX,
  PACK_WAKE,
  TRACK_SPEED,
} from "../../src/core/tuning";
import {
  cheerOf,
  startGauntlet,
  stepGauntlet,
  waveRun,
  type Gauntlet,
} from "../../src/game/sandbox/gauntlet";
import { GAUNTLET, type WavePreset } from "../../src/game/sandbox/presets";
import { createHorde, DIE_DIST } from "../../src/game/three/horde";
import {
  CHEER_WIDTH,
  cheerX,
  crowdHalfDepth,
  DIST_SCALE,
  FIGURE_RADIUS,
  HORDE_CAP,
  HORDE_JITTER,
  HORDE_RAG,
  HORDE_STRIDE_HZ,
  HORDE_TURN,
  HORDE_TURN_RATE,
  HORDE_WANDER,
  HORDE_WANDER_RATE,
  hordePlace,
  MELEE_LUNGE,
  meleeStep,
  hordeStride,
  type HordeLayout,
  type HordeSpot,
  TRACK_W,
  worldX,
  worldZ,
} from "../../src/game/three/world";

/**
 * A pack of `n0` at the owner's width (0.8) and figure size 1, its crowd's
 * front 20 world units ahead of the army, the head `run` world units in front
 * of it, an army of 200 on the left.
 */
function layout(n0: number, run = 0, clock = 0, n = n0): HordeLayout {
  const c = packCrowd(n0, 0.8, 1);
  return {
    laneX: -2,
    laneW: crowdWidth(200) * TRACK_W,
    headZ: -20 + run,
    left: -4,
    gx: c.gx * TRACK_W,
    gz: c.gz * DIST_SCALE,
    run,
    size: 1,
    n,
    n0,
    cols: c.cols,
    stride: hordeStride(c.cols),
    step: (PACK_COLUMN_MAX * DIST_SCALE) / n0,
    off: crowdHalfDepth(200) * DIST_SCALE,
    clock,
    melee: 0,
    band: meleeStep(crowdWidth(200) * TRACK_W, 1),
    closing: 1,
    armyX: -2,
    armyW: crowdWidth(200) * TRACK_W,
    contact: 1,
    cheer: -1,
  };
}
const places = (L: HordeLayout) =>
  Array.from({ length: L.n }, (_, k) => ({ ...hordePlace(k, L) }));
const W = 2 * FIGURE_RADIUS;

describe("horde layout: a scattered crowd", () => {
  it("visits every column once per row (a scattered order)", () => {
    for (const cols of [1, 2, 7, 14, 28, 60]) {
      const st = hordeStride(cols);
      const seen = new Set(
        Array.from({ length: cols }, (_, j) => (j * st) % cols),
      );
      expect(seen.size).toBe(cols);
    }
  });

  it("has no straight front row: columns stand back by different whole rows (up to HORDE_RAG)", () => {
    for (const n0 of [200, 500, 2_000]) {
      const L = layout(n0);
      const p = places(L);
      // each column's front figure: the nearest one in its x band
      const fronts = new Map<number, number>();
      for (const q of p) {
        const c = Math.floor((q.x - L.left) / L.gx);
        fronts.set(c, Math.max(fronts.get(c) ?? -Infinity, q.z));
      }
      const zs = [...fronts.values()];
      const spread = Math.max(...zs) - Math.min(...zs);
      expect(spread).toBeGreaterThan(1.2 * L.gz);
      expect(spread).toBeLessThan((HORDE_RAG + 1) * L.gz);
    }
  });

  it("stands 200, 500 and 2,000 apart (min gap) across the mouth and down the track, deeper with more", () => {
    let lastDepth = 0;
    for (const [n0, minGap] of [
      [200, 2 * W],
      [500, 1.6 * W],
      [2_000, 0.8 * W],
    ] as const) {
      const L = layout(n0);
      const c = packCrowd(n0, 0.8, 1);
      const p = places(L);
      let gap = Infinity;
      for (let a = 0; a < p.length; a++)
        for (let b = a + 1; b < p.length; b++) {
          const pa = p[a] as { x: number; z: number };
          const pb = p[b] as { x: number; z: number };
          gap = Math.min(gap, Math.hypot(pa.x - pb.x, pa.z - pb.z));
        }
      expect(gap).toBeGreaterThan(minGap);
      expect(gap).toBeGreaterThan(0.7 * Math.sqrt(L.gx * L.gz));
      // across the mouth (0.8 of the track), on it, and as deep as the crowd
      const xs = p.map((q) => q.x);
      const zs = p.map((q) => L.headZ - q.z);
      expect(Math.min(...xs) - FIGURE_RADIUS).toBeGreaterThanOrEqual(-4 - 1e-9);
      expect(Math.max(...xs) + FIGURE_RADIUS).toBeLessThanOrEqual(4 + 1e-9);
      expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(0.85 * 8);
      const j = HORDE_JITTER * Math.min(L.gx, L.gz);
      expect(Math.min(...zs)).toBeGreaterThanOrEqual(-j - 1e-9);
      expect(Math.max(...zs)).toBeLessThanOrEqual(
        c.depth * DIST_SCALE + HORDE_RAG * L.gz + j + 1e-9,
      );
      expect(Math.max(...zs)).toBeGreaterThan(
        0.9 * c.depth * DIST_SCALE - L.gz,
      );
      // deeper with more, up to CROWD_DEPTH_MAX (500 reaches it; 2,000 stands closer)
      expect(c.depth).toBeGreaterThanOrEqual(lastDepth);
      lastDepth = c.depth;
      // nobody has left: all wait in the crowd
      expect(p.every((q) => q.t === 0)).toBe(true);
    }
    // 500: a loose crowd about 2 track units deep, ~2.4 figure widths apart
    expect(lastDepth).toBeGreaterThan(1.9);
  });

  it("each waiting figure wanders about its place (within 2 × HORDE_WANDER gaps), the crowd staying where it is", () => {
    const rest = places(layout(500));
    let moved = 0;
    for (const clock of [0.7, 3.1, 11.4]) {
      const L = layout(500, 0, clock);
      const g = Math.min(L.gx, L.gz);
      places(L).forEach((q, k) => {
        const r = rest[k] as { x: number; z: number };
        const d = Math.hypot(q.x - r.x, q.z - r.z);
        expect(d).toBeLessThanOrEqual(2 * Math.SQRT2 * HORDE_WANDER * g + 1e-9);
        expect(q.t).toBe(0);
        if (d > 0.2 * HORDE_WANDER * g) moved++;
      });
    }
    expect(moved).toBeGreaterThan(0.5 * 3 * 500);
  });
});

describe("horde layout: the stream", () => {
  it("empties the crowd from its front into the stream as the head runs, the rest standing where they are", () => {
    const rest = places(layout(500));
    for (const run of [0.5, 2, 4, 6]) {
      const p = places(layout(500, run));
      const out = p.map((q) => q.t > 0);
      // fed from the front: a few front rows peel off at once, and once a
      // figure has left, every one more than 5 rows in front of it has
      const L = layout(500, run);
      const row = (k: number) => Math.floor((L.n0 - 1 - k) / L.cols);
      for (let k = 0; k < p.length; k++)
        if (out[k])
          for (let f = k + 1; f < p.length; f++)
            if (row(f) < row(k) - 5) expect(out[f]).toBe(true);
      const left = out.filter(Boolean).length;
      expect(left).toBeGreaterThan(0);
      expect(left).toBeLessThan(500);
      // those still in the crowd haven't moved (the head ran, the crowd stood)
      p.forEach((q, k) => {
        if (q.t > 0) return;
        const r = rest[k] as { x: number; z: number };
        expect(q.x).toBeCloseTo(r.x, 9);
        expect(q.z).toBeCloseTo(r.z, 9);
      });
    }
    // more leave the further the head runs
    const gone = (run: number) =>
      places(layout(500, run)).filter((q) => q.t > 0).length;
    expect(gone(6)).toBeGreaterThan(gone(3));
  });

  it("no figure jumps as the head runs: each moves at most a step's worth per step", () => {
    let last = places(layout(500));
    for (let run = 0.1; run < 12; run += 0.1) {
      const p = places(layout(500, run));
      p.forEach((q, k) => {
        const r = last[k] as { x: number; z: number };
        expect(Math.hypot(q.x - r.x, q.z - r.z)).toBeLessThan(0.5);
      });
      last = p;
    }
  });

  /**
   * A pack woken `ahead` world units off, played in time: its head closes on
   * the army at C (21 world units a second, the scroll and its own run) and
   * runs over the ground at G (5); per figure, the steepest sideways move
   * per forward move on screen, and how much of its way across into its
   * lane it had come halfway along its run.
   */
  const charge = (ahead: number) => {
    const C = 21;
    const G = 5;
    const dt = 1 / 60;
    const base = { ...layout(200), closing: C / G };
    let worst = 0;
    let fastest = 0;
    const half: number[] = [];
    const startX: number[] = [];
    const leftAt: number[] = [];
    let last: HordeSpot[] = [];
    for (let time = 0; ahead - C * time > 0; time += dt) {
      const L = { ...base, headZ: -(ahead - C * time), run: G * time };
      const p = places(L);
      p.forEach((q, k) => {
        const r = last[k];
        if (q.t === 0) startX[k] = q.x;
        if (r && r.t > 0 && q.t > 0) {
          const dz = Math.abs(q.z - r.z);
          if (dz > 1e-6) worst = Math.max(worst, Math.abs(q.x - r.x) / dz);
          fastest = Math.max(fastest, Math.abs(q.x - r.x) / dt);
        }
        const lane = laneOf(k, L);
        const from = startX[k] ?? q.x;
        if (q.t > 0 && leftAt[k] === undefined) leftAt[k] = -q.z;
        // halfway: its distance to the army half what it was when it left
        const d0 = leftAt[k];
        if (
          d0 !== undefined &&
          half[k] === undefined &&
          -q.z <= d0 / 2 &&
          Math.abs(from - lane) > 1
        )
          half[k] = 1 - Math.abs(q.x - lane) / Math.abs(from - lane);
      });
      last = p;
    }
    // fastest sideways, in track widths a second
    return {
      worst,
      fastest: fastest / TRACK_W,
      half: half.filter((v) => v !== undefined),
    };
  };
  /** Figure k's lane in the stream: where it is once all the way across. */
  const laneOf = (k: number, L: HordeLayout) =>
    hordePlace(k, { ...L, headZ: 0, run: 1e4, melee: L.n }).x;

  it("curves into the army's lane gradually over its run: sideways at most 30% of its speed at the army, about halfway across halfway there", () => {
    const { worst, half } = charge(120);
    console.log(
      "charge 120",
      worst,
      Math.min(...half),
      Math.max(...half),
      half.length,
      charge(20).worst,
    );
    expect(worst).toBeLessThan(0.3);
    expect(half.length).toBeGreaterThan(50);
    for (const h of half) {
      expect(h).toBeGreaterThan(0.2);
      expect(h).toBeLessThan(0.8);
    }
  });

  it("a pack woken close (2 track units out, behind a wall) never comes across faster than the core's stream (TRACK_SPEED): no snapping into line", () => {
    const close = charge(20);
    console.log("charge 20", close.worst, close.fastest, charge(120).fastest);
    expect(close.fastest).toBeLessThanOrEqual(TRACK_SPEED + 1e-6);
    expect(charge(120).fastest).toBeLessThanOrEqual(TRACK_SPEED + 1e-6);
    // it gets somewhere: not frozen in its crowd's place
    expect(close.fastest).toBeGreaterThan(TRACK_SPEED / 2);
  });

  it("a waiting crowd is calmer: it wanders less far and about 3× slower than in H5b", () => {
    // H5b: 0.2 gaps each way at up to 0.22 gaps a second per axis
    expect(HORDE_WANDER).toBe(0.12);
    expect(HORDE_WANDER_RATE).toBe(0.5);
    const L0 = layout(500);
    const g = Math.min(L0.gx, L0.gz);
    let fastest = 0;
    let last = places(L0);
    for (let clock = 0.05; clock < 30; clock += 0.05) {
      const p = places({ ...L0, clock });
      p.forEach((q, k) => {
        const r = last[k] as HordeSpot;
        fastest = Math.max(fastest, Math.hypot(q.x - r.x, q.z - r.z) / 0.05);
      });
      last = p;
    }
    expect(fastest / g).toBeLessThan((Math.SQRT2 * 0.2 * 1.1) / 3);
    expect(fastest).toBeGreaterThan(0);
    // a steady stride: slower than H5b's 3 a second, and the turns gentler
    expect(HORDE_STRIDE_HZ).toBeLessThan(3);
    expect(HORDE_TURN).toBeLessThan(1.4);
    expect(HORDE_TURN_RATE).toBeLessThan(0.3);
  });

  it("runs into the army's lane by the time it meets it: as wide as the army, centred on it (the core's span)", () => {
    const L = { ...layout(500, 40), headZ: 0, closing: 4.2 };
    const lo = L.laneX - L.laneW / 2;
    const hi = L.laneX + L.laneW / 2;
    // the front figure is the head, at the army: in its lane, at its front rows
    const front = hordePlace(499, L);
    expect(front.t).toBe(1);
    expect(front.x).toBeGreaterThanOrEqual(lo - 1e-9);
    expect(front.x).toBeLessThanOrEqual(hi + 1e-9);
    expect(front.z).toBeCloseTo(-L.off, 9);
  });

  it("at contact the front crashes into the army's front rows; as the front dies the rest step up", () => {
    const L = { ...layout(500, 20), headZ: 0 };
    // the army's front rows are L.off ahead (−Z) of its centre
    expect(hordePlace(499, L).z).toBeCloseTo(-L.off, 9);
    // nobody is drawn inside or behind the army
    for (const q of places(L)) expect(q.z).toBeLessThanOrEqual(-L.off + 1e-9);
    const shot = { ...L, n: 400 };
    expect(hordePlace(0, shot).z).toBeGreaterThan(hordePlace(0, L).z - 1e-9);
    expect(hordePlace(399, shot).z).toBeCloseTo(-L.off, 9);
  });
});

const rows = [
  {
    type: "reading" as const,
    prompt: "山",
    options: ["やま", "かわ"],
    answerIndex: 0,
    answer: "やま",
  },
];

/** A run with packs of `heads` (40 HP each) at these distances ahead, `damage` dealt to each. */
function horde(at: number[], damage: number, heads = 200): RunState {
  const track: Track = {
    questions: [9],
    hazards: at.map((pos) => ({ kind: "pack" as const, pos, x: 0.5 })),
    charges: [],
  };
  const run = createRunState(rows, track);
  run.army = 200;
  run.hp = at.map(() => 40);
  run.heads = at.map(() => heads);
  run.damage = at.map(() => damage);
  // the stream's head at the given place
  run.packs = at.map((pos) => ({ pos, x: 0.5 }));
  return run;
}

function setup() {
  const h = createHorde(new Scene());
  const slot = (k: number) => {
    const mesh = h.meshes[k];
    if (!mesh) throw new Error("no slot");
    const u = mesh.userData.uniforms as Record<string, Vector4>;
    return {
      count: mesh.visible ? mesh.geometry.instanceCount : 0,
      death: mesh.geometry.getAttribute("death") as InstancedBufferAttribute,
      front: u.front as Vector4,
      back: u.back as Vector4,
      state: u.state as Vector4,
    };
  };
  return { h, slot };
}

describe("drawing the horde", () => {
  it("draws every live enemy of a pack, and two packs at once", () => {
    const { h, slot } = setup();
    h.update(horde([2, 3], 0), 0);
    expect(slot(0).count).toBe(200);
    expect(slot(1).count).toBe(200);
    // a third pack waits for a slot
    h.update(horde([2, 3, 4], 0), 0);
    expect(slot(0).count + slot(1).count).toBe(400);
  });

  it("sizes its buffers once, at the cap, and keeps them across frames and runs", () => {
    const { h, slot } = setup();
    const before = slot(0).death.array;
    expect(before.length).toBe(4 * HORDE_CAP);
    h.update(horde([2], 0, 20_000), 0);
    h.update({ ...horde([2], 30, 20_000), dist: 0.01 }, 0.1);
    h.update(horde([2], 0), 0);
    expect(slot(0).death.array).toBe(before);
    expect(slot(0).count).toBe(200);
  });

  it("writes only the killed figures' deaths: nothing on a frame without kills", () => {
    const { h, slot } = setup();
    const a = horde([2], 0, 20_000);
    h.update(a, 0);
    const { death } = slot(0);
    death.clearUpdateRanges();
    // a frame later, nothing killed: only uniforms change
    h.update({ ...a, dist: 0.01 }, 0.02);
    expect(death.updateRanges).toHaveLength(0);
    // 20,000 heads on 40 HP: 0.1 damage kills 50
    h.update({ ...a, dist: 0.02, damage: [0.1] }, 0.04);
    expect(death.updateRanges).toEqual([{ start: 4 * 19_950, count: 4 * 50 }]);
    expect(slot(0).state.x).toBe(19_950);
    expect(Array.from(death.array).some(Number.isNaN)).toBe(false);
  });

  it("lets killed figures fall for a moment, then stops drawing them", () => {
    const { h, slot } = setup();
    const a = horde([2], 0);
    h.update(a, 0);
    // 10 of 200 killed (0.2 HP each)
    h.update({ ...a, damage: [2], dist: 0.01 }, 0.02);
    expect(slot(0).count).toBe(200);
    expect(slot(0).state.x).toBe(190);
    h.update({ ...a, damage: [2], dist: 0.01 + DIE_DIST }, 0.5);
    expect(slot(0).count).toBe(190);
  });

  it("figures that reach the army fight at its front: killed ones fall there, none vanish", () => {
    const { h, slot } = setup();
    const a = { ...horde([0.5], 0), packs: [{ pos: 0, x: 0.5 }] };
    h.update(a, 0);
    // 5 at the front, then 3 of them killed
    h.update({ ...a, arrived: [5], front: [5], dist: 0.01 }, 0.02);
    expect(slot(0).state.x).toBe(200);
    h.update(
      { ...a, damage: [0.6], arrived: [5], front: [5], dist: 0.02 },
      0.04,
    );
    const d = slot(0).death.array;
    for (let k = 197; k < 200; k++) {
      expect(d[4 * k]).toBeCloseTo(0.02, 6);
      // killed, not run past
      expect(d[4 * k + 3]).toBe(0);
    }
    expect(slot(0).state.x).toBe(197);
    // the 2 left at the front fight there
    expect(h.meshes[0]?.userData.layout.melee).toBeCloseTo(2, 9);
  });

  it("enemies that miss the army run past it, beside it, and on off the screen; killed ones fall", () => {
    const { h, slot } = setup();
    const a = { ...horde([0.5], 0), packs: [{ pos: 0, x: 0.5 }] };
    h.update(a, 0);
    // 3 reach the army's line beside it and run past (counted dead, no kill), 2 more are shot
    h.update({ ...a, damage: [1], missed: [3], front: [3], dist: 0.02 }, 0.04);
    expect(slot(0).state.x).toBe(195);
    const d = slot(0).death.array;
    const ax = worldX(a.x);
    const half = (crowdWidth(a.army) * TRACK_W) / 2;
    const ran = [];
    for (let k = 195; k < 200; k++) {
      expect(d[4 * k]).toBeCloseTo(0.02, 6);
      if (d[4 * k + 3] === 1) {
        ran.push(k);
        // beside the army, never through it
        expect(Math.abs((d[4 * k + 1] ?? 0) - ax)).toBeGreaterThan(half);
      }
    }
    expect(ran).toEqual([195, 196, 197]);
    // they are drawn while they run off, then the slot lets them go
    expect(slot(0).count).toBe(200);
  });

  it("a melee is a press of rows against the army's front, as wide as its lane, the stream right behind; fighters lunge, nobody jumps as it grows", () => {
    // the head at the army, the crowd long emptied, 60 of 200 at the front
    const base = { ...layout(200, 200), headZ: 0 };
    const L = { ...base, melee: 60 };
    const lo = L.laneX - L.laneW / 2;
    const hi = L.laneX + L.laneW / 2;
    const depth = L.melee * L.band;
    for (let k = 0; k < 200; k++) {
      const j = 199 - k;
      const p = hordePlace(k, L);
      if (j < 60) {
        expect(p.t).toBe(1);
        expect(p.x).toBeGreaterThanOrEqual(lo);
        expect(p.x).toBeLessThanOrEqual(hi);
        // pressed against the front rows (a lunge reaches a little into them)
        expect(p.z).toBeLessThanOrEqual(-L.off + 2 * MELEE_LUNGE + 1e-9);
        expect(p.z).toBeGreaterThanOrEqual(-L.off - depth - 1e-9);
      } else expect(p.z).toBeLessThanOrEqual(-L.off - depth + 1e-9);
    }
    // a few rows: as many to a row as fit across the lane
    expect(depth).toBeGreaterThan(2 * FIGURE_RADIUS * 3);
    expect(depth).toBeLessThan(L.laneW);
    // the fighters lunge with the clock; the stream doesn't
    const later = { ...L, clock: 0.3 };
    expect(hordePlace(199, later).z).not.toBeCloseTo(hordePlace(199, L).z, 3);
    expect(hordePlace(0, later).z).toBeCloseTo(hordePlace(0, L).z, 9);
    // the melee growing by one figure moves nobody far
    const grown = { ...L, melee: 61 };
    for (let k = 0; k < 200; k++) {
      const a = hordePlace(k, L);
      const b = hordePlace(k, grown);
      expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeLessThan(
        2 * MELEE_LUNGE + L.step + 1e-6,
      );
    }
  });

  it("stands still while paused (the clock and distance stop); the clock alone makes the crowd mill", () => {
    const { h, slot } = setup();
    const a = horde([3], 0, 500);
    const lay = (): HordeLayout =>
      ({ ...h.meshes[0]?.userData.layout }) as HordeLayout;
    h.update(a, 1);
    const first = places(lay());
    h.update(a, 1);
    expect(places(lay())).toEqual(first);
    expect(slot(0).state.w).toBe(1);
    h.update(a, 2.5);
    expect(places(lay())).not.toEqual(first);
  });

  it("draws the crowd where the core's pack stands, not following the army, and the stream on the army as wide as it (the core's span), from its head", () => {
    const { h } = setup();
    const lay = (): HordeLayout => h.meshes[0]?.userData.layout as HordeLayout;
    const track: Track = {
      questions: [0.5, 30],
      hazards: [{ kind: "pack", pos: 5, x: 0.7 }],
      charges: [],
    };
    let run: RunState = {
      ...createRunState([...rows, ...rows], track),
      army: 200,
    };
    // so many hit points that the fire doesn't kill it yet
    run = { ...run, x: 0.2, targetX: 0.2, hp: [1e9] };
    h.update(run, 0);
    const mouth = packMouth(run, 0);
    expect(lay().left).toBeCloseTo(worldX(mouth.left), 9);
    expect(lay().cols * lay().gx).toBeCloseTo(
      (mouth.right - mouth.left) * TRACK_W,
      9,
    );
    expect(lay().run).toBeCloseTo(0, 9);
    expect(lay().headZ).toBeCloseTo(worldZ(crowdFront(run, 0), 0), 9);
    // waiting behind the wall: the army steers across, the crowd stays put
    const still = places({ ...lay() });
    h.update({ ...run, x: 0.8, targetX: 0.8 }, 0);
    expect(places({ ...lay() })).toEqual(still);
    // past the wall it wakes: the head leaves the crowd's front at once
    let s = run;
    while (s.next === 0) s = stepRun(s, 1 / 60);
    for (let n = 0; n < 30; n++) s = stepRun(s, 1 / 60);
    h.update(s, 0.5);
    const L = lay();
    expect(L.run).toBeGreaterThan(0);
    expect(places(L).some((q) => q.t > 0)).toBe(true);
    const span = packSpan(s, 0);
    expect(L.laneX).toBeCloseTo(worldX((span.left + span.right) / 2), 9);
    expect(L.laneW).toBeCloseTo((span.right - span.left) * TRACK_W, 9);
    expect(L.headZ).toBeCloseTo(worldZ(s.packs[0]?.pos ?? 0, s.dist), 9);
    expect(L.step * L.n0).toBeCloseTo(PACK_COLUMN_MAX * DIST_SCALE, 9);
    expect(-L.headZ).toBeLessThan(PACK_WAKE * DIST_SCALE);
    expect(HORDE_DEFAULTS.packWidth).toBe(0.8);
  });

  it("starts empty on a new run", () => {
    const { h, slot } = setup();
    const a = horde([2], 0);
    h.update(a, 0);
    h.update({ ...a, damage: [2], dist: 0.01 }, 0.02);
    const b = horde([2], 0, 50);
    h.update(b, 0);
    expect(slot(0).count).toBe(50);
    expect(slot(1).count).toBe(0);
  });
});

describe("the enemies cheer a win (Task H5f)", () => {
  /**
   * Gauntlet wave 7 (outmatched) frame by frame through the wipe-out, held
   * (and once steered off and back), each figure's place from the drawn
   * layout: the biggest move of any figure from one frame to the next, over
   * the last second before the army dies, and over the cheer.
   */
  function wave7(dx: number) {
    const h = createHorde(new Scene());
    const lay = () => h.meshes[0]?.userData.layout as HordeLayout;
    const preset = GAUNTLET[6] as WavePreset;
    let g: Gauntlet = {
      ...startGauntlet(GAUNTLET),
      index: 6,
      run: waveRun(preset),
      phase: "play",
    };
    const dt = 1 / 60;
    let before = 0;
    let cheering = 0;
    let wipe = -1;
    let prev: HordeSpot[] = [];
    let width = 0;
    for (let f = 0; f < 4000 && g.phase === "play"; f++) {
      g = stepGauntlet(g, dt, f < 30 ? dx / 30 : f < 60 ? -dx / 30 : 0);
      const cheer = cheerOf(g);
      h.update(g.run, f * dt, cheer);
      if (wipe < 0 && g.run.status === "dead") wipe = f;
      const now = places(lay());
      const move = Math.max(
        0,
        ...now.map((q, k) => {
          const p = prev[k];
          return p ? Math.hypot(q.x - p.x, q.z - p.z) : 0;
        }),
      );
      if (cheer >= 0) {
        cheering = Math.max(cheering, move);
        width = Math.max(width, ...now.map((q) => Math.abs(q.x)));
      } else if (g.run.status === "running" && g.run.army <= preset.army)
        before = Math.max(before, move);
      prev = now;
    }
    return { before, cheering, wipe, width, won: enemiesWon(g.run) };
  }

  it("no figure snaps into a line as the army dies, or when the cheer starts", () => {
    for (const dx of [0, 0.25]) {
      const r = wave7(dx);
      expect(r.won).toBe(true);
      expect(r.wipe).toBeGreaterThan(0);
      // a figure runs about 0.3 world units a frame; nothing jumps sideways
      expect(r.before).toBeLessThan(0.6);
      expect(r.cheering).toBeLessThan(0.3);
      // they spread out, about half the track, and stay on it
      expect(r.width).toBeGreaterThan(CHEER_WIDTH / 2 - 0.5);
      expect(r.width).toBeLessThan(TRACK_W / 2);
    }
  });

  it("cheerX starts where the figure stands and spreads it out from its lane", () => {
    expect(cheerX(0.2, 0, 0.6, 1, -1)).toBe(0.2);
    expect(cheerX(0.2, 0, 0.6, 1, 0)).toBeCloseTo(0.2, 9);
    expect(cheerX(0.2, 0, 0.6, 1, 5)).toBeCloseTo(0.2 * (CHEER_WIDTH / 0.6), 9);
    expect(cheerX(-0.4, 0, 0.6, 1, 5)).toBeCloseTo(-CHEER_WIDTH / 2, 9);
    // a figure already out beyond the spread stays where it is
    expect(cheerX(4, 0, 0.6, 1, 5)).toBeCloseTo(4, 9);
    // one still waiting in the crowd too; one half across goes half as far
    expect(cheerX(1, 0, 0.6, 0, 5)).toBe(1);
    expect(cheerX(1, 0, 0.6, 0.5, 5)).toBeCloseTo(1.75, 9);
  });
});
