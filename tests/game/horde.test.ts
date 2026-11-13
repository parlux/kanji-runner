import { Scene, type InstancedBufferAttribute, type Vector4 } from "three";
import { describe, expect, it } from "vitest";
import { crowdWidth } from "../../src/core/crowd";
import {
  createRunState,
  crowdFront,
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
} from "../../src/core/tuning";
import { createHorde, DIE_DIST } from "../../src/game/three/horde";
import {
  crowdHalfDepth,
  DIST_SCALE,
  FIGURE_RADIUS,
  HORDE_CAP,
  HORDE_JITTER,
  HORDE_WANDER,
  hordePlace,
  hordeStride,
  type HordeLayout,
  STREAM_TURN,
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
        c.depth * DIST_SCALE + j + 1e-9,
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
    for (let run = 0.05; run < 20; run += 0.05) {
      const p = places(layout(500, run));
      p.forEach((q, k) => {
        const r = last[k] as { x: number; z: number };
        expect(Math.hypot(q.x - r.x, q.z - r.z)).toBeLessThan(0.5);
      });
      last = p;
    }
  });

  it("runs in the army's lane once turned: as wide as the army, centred on it (the core's span)", () => {
    const L = layout(500, 15);
    const lo = L.laneX - L.laneW / 2;
    const hi = L.laneX + L.laneW / 2;
    let turned = 0;
    for (const q of places(L))
      if (q.t === 1) {
        turned++;
        expect(q.x).toBeGreaterThanOrEqual(lo - 1e-9);
        expect(q.x).toBeLessThanOrEqual(hi + 1e-9);
      }
    expect(turned).toBeGreaterThan(50);
    // the front figure is the head, turned within STREAM_TURN of running
    const front = hordePlace(499, L);
    expect(front.t).toBe(1);
    // (−Z is ahead: pulled towards the army's front rows, never past the head)
    expect(front.z).toBeLessThanOrEqual(L.headZ);
    expect(front.z).toBeGreaterThanOrEqual(L.headZ - L.off - 1e-9);
    expect(STREAM_TURN).toBeLessThan(15);
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
    expect(before.length).toBe(3 * HORDE_CAP);
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
    expect(death.updateRanges).toEqual([{ start: 3 * 19_950, count: 3 * 50 }]);
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

  it("figures that reach the army vanish into it; shot ones fall", () => {
    const { h, slot } = setup();
    const a = { ...horde([0.5], 0), packs: [{ pos: 0, x: 0.5 }] };
    h.update(a, 0);
    // 5 arrive (5 × 0.2 HP of damage), then 3 are shot
    h.update({ ...a, damage: [1], arrived: [5], dist: 0.01 }, 0.02);
    const d = slot(0).death.array;
    for (let k = 195; k < 200; k++) expect(d[3 * k]).toBeLessThan(-1e6);
    h.update({ ...a, damage: [1.6], arrived: [5], dist: 0.02 }, 0.04);
    for (let k = 192; k < 195; k++) expect(d[3 * k]).toBeCloseTo(0.02, 6);
    expect(slot(0).state.x).toBe(192);
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
