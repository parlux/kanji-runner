import { Scene, type InstancedBufferAttribute, type Vector4 } from "three";
import { describe, expect, it } from "vitest";
import { crowdWidth } from "../../src/core/crowd";
import {
  createRunState,
  packConverge,
  packMouth,
  packSpan,
  type RunState,
} from "../../src/core/sim";
import type { Track } from "../../src/core/track";
import {
  HORDE_AREA,
  HORDE_SCALE,
  STREAM_DISTANCE,
} from "../../src/core/tuning";
import { createHorde, DIE_DIST } from "../../src/game/three/horde";
import {
  DIST_SCALE,
  FIGURE_RADIUS,
  HORDE_CAP,
  HORDE_COLUMN,
  HORDE_GAP,
  hordePlace,
  type HordeShape,
  TRACK_W,
  worldX,
} from "../../src/game/three/world";

const scale = HORDE_SCALE;
const area = (HORDE_GAP * scale) ** 2;
/** A charging pack: a column at a 200 army's width on the left, funnelling to `pw` wide in the middle. */
const shape = (pw: number): HordeShape => ({
  cx: -2,
  cw: crowdWidth(200) * TRACK_W,
  px: 0,
  pw,
  area,
});

describe("horde layout", () => {
  it("keeps 200, 2,000 and 20,000 figures inside the funnel and on the track, whole or shot down", () => {
    const o = { x: 0, z: 0 };
    for (const heads of [200, 2_000, 20_000])
      for (const share of [1, 0.5, 0.05])
        for (const pw of [TRACK_W, 4, 1]) {
          const sh = shape(pw);
          const n = Math.max(1, Math.round(heads * share));
          const lo = Math.min(sh.cx - sh.cw / 2, sh.px - sh.pw / 2);
          const hi = Math.max(sh.cx + sh.cw / 2, sh.px + sh.pw / 2);
          let left = Infinity;
          let right = -Infinity;
          let back = 0;
          let front = Infinity;
          for (let k = 0; k < n; k++) {
            hordePlace(k, n, sh, scale, o);
            left = Math.min(left, o.x);
            right = Math.max(right, o.x);
            back = Math.max(back, o.z);
            front = Math.min(front, o.z);
          }
          expect(front).toBeGreaterThanOrEqual(0);
          const r = FIGURE_RADIUS * scale;
          expect(left - r).toBeGreaterThanOrEqual(lo - 1e-6);
          expect(right + r).toBeLessThanOrEqual(hi + 1e-6);
          expect(Number.isFinite(back)).toBe(true);
        }
  });

  it("is a column at the army's width at the front, as wide as the span at the back", () => {
    const sh = shape(TRACK_W);
    const o = { x: 0, z: 0 };
    const n = 2_000;
    for (let k = n - 1; k >= 0; k--) {
      hordePlace(k, n, sh, scale, o);
      if (o.z < HORDE_COLUMN * 0.8)
        expect(Math.abs(o.x - sh.cx)).toBeLessThanOrEqual(sh.cw / 2);
    }
    // the back rows reach across the whole track
    let wide = 0;
    for (let k = 0; k < 100; k++)
      wide = Math.max(wide, Math.abs(hordePlace(k, n, sh, scale, o).x));
    expect(wide).toBeGreaterThan(0.4 * TRACK_W);
  });

  it("runs further back the bigger it is: into the haze at 20,000", () => {
    const sh = shape(TRACK_W);
    const length = (n: number) => hordePlace(0, n, sh, scale).z;
    expect(length(2_000)).toBeGreaterThan(length(200));
    expect(length(20_000)).toBeGreaterThan(5 * length(2_000));
    expect(length(20_000)).toBeGreaterThan(100);
  });

  it("puts the figures that die first (the highest) at the front", () => {
    const sh = shape(TRACK_W);
    const n = 2_000;
    const front = hordePlace(n - 1, n, sh, scale).z;
    expect(front).toBeLessThan(HORDE_GAP);
    expect(hordePlace(n - 50, n, sh, scale).z).toBeLessThan(
      hordePlace(n - 1000, n, sh, scale).z,
    );
    // when the front falls the rest step up
    expect(hordePlace(0, n - 100, sh, scale).z).toBeLessThan(
      hordePlace(0, n, sh, scale).z,
    );
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

  it("stays spread wide where it is far away, whatever the army does; within STREAM_DISTANCE its front is the core's span", () => {
    const { h, slot } = setup();
    const far = { ...horde([STREAM_DISTANCE + 2], 0), x: 0.2, targetX: 0.2 };
    far.packs = [{ pos: STREAM_DISTANCE + 2, x: 0.7 }];
    h.update(far, 0);
    const mouth = packMouth(far, 0);
    const front = slot(0).front.clone();
    expect(front.z).toBeCloseTo((mouth.right - mouth.left) * TRACK_W, 6);
    expect(front.w).toBeCloseTo(front.z, 6);
    expect(slot(0).back.z).toBe(0);
    // the army steers across: the far pack doesn't follow
    h.update({ ...far, x: 0.8, targetX: 0.8 }, 0.1);
    expect(slot(0).front.x).toBeCloseTo(front.x, 9);
    expect(slot(0).front.z).toBeCloseTo(front.z, 9);
    // near the army: the front closes onto it, exactly as the core's span
    for (const ahead of [STREAM_DISTANCE / 2, 0.1, 0]) {
      const near = {
        ...far,
        x: 0.3,
        targetX: 0.3,
        packs: [{ pos: ahead, x: 0.7 }],
      };
      h.update(near, 0.2);
      const span = packSpan(near, 0);
      expect(slot(0).front.x).toBeCloseTo(
        worldX((span.left + span.right) / 2),
        9,
      );
      expect(slot(0).front.z).toBeCloseTo(
        (span.right - span.left) * TRACK_W,
        9,
      );
      expect(slot(0).back.z).toBeCloseTo(packConverge(near, 0), 12);
    }
    expect(slot(0).front.z).toBeCloseTo(crowdWidth(200) * TRACK_W, 9);
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

  it("spaces its figures as the core's column density (HORDE_AREA)", () => {
    expect(HORDE_GAP ** 2 / (TRACK_W * DIST_SCALE)).toBeCloseTo(HORDE_AREA, 15);
  });

  it("stands still while paused (the clock and distance stop)", () => {
    const { h, slot } = setup();
    const a = horde([3], 0);
    h.update(a, 1);
    const form = slot(0).back.z;
    h.update({ ...a, packs: [{ pos: 2.9, x: 0.5 }] as RunState["packs"] }, 1);
    expect(slot(0).back.z).toBe(form);
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
