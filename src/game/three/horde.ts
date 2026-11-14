import {
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  MeshLambertMaterial,
  Vector4,
  type Scene,
} from "three";
import { crowdWidth } from "../../core/crowd";
import {
  crowdFront,
  crowdOf,
  hazardPos,
  isShattered,
  packHeadsLeft,
  packMouth,
  packSurvivors,
  type RunState,
} from "../../core/sim";
import { PACK_COLUMN_MAX } from "../../core/tuning";
import { HORDE_HIP, makeHordeGeometry } from "./figures";
import {
  crowdHalfDepth,
  DIST_SCALE,
  FIGURE_RADIUS,
  HORDE_CAP,
  COL_SALT,
  HORDE_JITTER,
  HORDE_RAG,
  HORDE_WANDER,
  hordePlace,
  hordeStride,
  type HordeLayout,
  type HordeSpot,
  shapeDistance,
  STREAM_CRASH,
  STREAM_TURN,
  TRACK_W,
  worldX,
  worldZ,
} from "./world";

/**
 * The enemy packs, every figure animated on the GPU. Each pack in view gets
 * a slot: one instanced mesh of up to HORDE_CAP figures whose places come
 * from the instance index (as `hordePlace`: a loose crowd milling where
 * it stands, emptying from its front into a stream that runs at the army,
 * as wide as it, from the moment the pack wakes) and a few uniforms, so a
 * frame costs the same at 200 or 20,000. The only per-figure data is its death: when
 * survivors drop from `was` to n, figures n..was − 1 (the front rows) get
 * the run distance and the world place they stood on, uploaded as that one
 * range, and fall there while the rest step up.
 */

/** Packs drawn at once (two fit within the shape horizon). */
export const HORDE_SLOTS = 2;
/** A killed figure topples back and shrinks away over this much run distance (about a third of a second). */
export const DIE_DIST = 0.45;
/** Strides per second of clock. */
const STRIDE_HZ = 3;

const f = (x: number): string => x.toFixed(6);

/** The vertex shader's figure: placed, striding or falling, from its index and the slot's uniforms. */
const VERTEX_HEAD = `
attribute float leg;
attribute vec3 death;
uniform vec4 hordeLane;
uniform vec4 hordeCrowd;
uniform vec4 hordeCount;
uniform vec4 hordeState;
uniform float hordeSize;
uint hordeHash(uint v) {
  uint s = v * 747796405u + 2891336453u;
  uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
  return (w >> 22u) ^ w;
}
float hordeRand(uint v) { return float(hordeHash(v)) / 4294967296.0; }
`;
const VERTEX_BODY = `
{
  // as hordePlace (world.ts)
  // hordeLane: lane centre x, lane width, head z, the army's half depth
  // hordeCrowd: mouth's left edge, gx, gz, run (how far back of the head the crowd's front is)
  // hordeCount: n0, cols, stride, step
  // hordeState: alive, front figure's share left, run distance, clock
  // death: run distance, world x and z (with the army at distance 0) where it fell
  uint id = uint(gl_InstanceID);
  float k = float(gl_InstanceID);
  float size = hordeSize;
  float n0 = hordeCount.x;
  float cols = hordeCount.y;
  float R = n0 - 1.0 - k;
  float row = floor(R / cols);
  float col = mod(mod(R, cols) * hordeCount.z, cols);
  float gx = hordeCrowd.y;
  float gz = hordeCrowd.z;
  float g = min(gx, gz);
  float r1 = hordeRand(2u * id);
  float r2 = hordeRand(2u * id + 1u);
  float ph1 = 6.2831853 * r2;
  float ph2 = 6.2831853 * r1;
  float clock = hordeState.w;
  float wander = ${f(HORDE_WANDER)} * g;
  float wx = wander * (sin(clock * (0.5 + 0.6 * r1) + ph1) - sin(ph1));
  float wz = wander * (cos(clock * (0.4 + 0.5 * r2) + ph2) - cos(ph2));
  float rag = floor(hordeRand(uint(col) + ${COL_SALT}u) * ${f(HORDE_RAG + 1)});
  float rad = ${f(FIGURE_RADIUS)} * size;
  float left = hordeCrowd.x;
  float cx = clamp(
    left + (col + 0.5 + (mod(row + rag, 2.0) > 0.5 ? 0.25 : -0.25)) * gx + ${f(HORDE_JITTER)} * g * (2.0 * r1 - 1.0) + wx,
    left + rad, left + cols * gx - rad);
  float cz = ${f(HORDE_JITTER)} * g * (2.0 * r2 - 1.0) + wz + rag * gz;
  float spot = hordeCrowd.w + row * gz;
  float slot = (hordeState.x - 1.0 - k) * hordeCount.w;
  float ahead = -hordeLane.z;
  float e = spot - slot;
  float form = e <= 0.0 ? 0.0 : min(1.0, e / max(1e-3, min(${f(STREAM_TURN)}, spot + ahead)));
  float lane = hordeLane.x + (fract(k * 0.6180339887) - 0.5) * max(0.0, hordeLane.y - 2.0 * rad);
  float crash = clamp(1.0 - (ahead + slot) / ${f(STREAM_CRASH)}, 0.0, 1.0);
  float back = e <= 0.0 ? spot + cz : slot + (1.0 - form) * cz + hordeLane.w * crash * form;
  vec2 off = vec2(mix(cx, lane, form), hordeLane.z - back);
  float mill = 1.0 - form;
  // waiting, each figure turns about now and then; in the stream it faces the army
  float yaw = 3.14159265 + mill * 1.4 * sin(clock * 0.3 * (0.5 + r1) + ph1);
  float stride = 6.2831853 * (clock * ${f(STRIDE_HZ)} * mix(0.35, 1.0, form) + r1);
  float s = size;
  float lean = -0.2 * form + 0.06 * sin(2.0 * stride);
  float sway = 0.1 * sin(stride);
  float swing = mix(0.25, 0.75, form) * sin(stride);
  vec3 lift = vec3(0.0, abs(sin(stride)) * mix(0.02, 0.08, form) * size, 0.0);
  if (k >= hordeState.x) {
    // knocked back, toppling over backwards as it shrinks away
    float t = (hordeState.z - death.x) / ${f(DIE_DIST)};
    if (t < 0.0 || t >= 1.0) s = 0.0;
    t = clamp(t, 0.0, 1.0);
    lean = -0.2 - 1.5 * t;
    sway = 0.0;
    swing = 0.0;
    yaw = 3.14159265;
    lift = vec3(0.0, sin(3.14159265 * t) * 0.15, -0.6 * t);
    off = vec2(death.y, death.z + hordeState.z * ${f(DIST_SCALE)});
    s *= 1.0 - t * t;
  } else if (k + 1.0 >= hordeState.x) {
    // the front figure shrinks as it takes damage
    s *= 0.4 + 0.6 * clamp(hordeState.y, 0.0, 1.0);
  }
  vec3 p = transformed;
  // legs swing about the hip
  float sl = swing * leg;
  float hy = p.y - ${f(HORDE_HIP)};
  p.yz = vec2(${f(HORDE_HIP)} + hy * cos(sl) - p.z * sin(sl), hy * sin(sl) + p.z * cos(sl));
  // sway (z), face (y), lean into the run (x)
  p.xy = vec2(p.x * cos(sway) - p.y * sin(sway), p.x * sin(sway) + p.y * cos(sway));
  p.xz = vec2(p.x * cos(yaw) + p.z * sin(yaw), -p.x * sin(yaw) + p.z * cos(yaw));
  p.yz = vec2(p.y * cos(lean) - p.z * sin(lean), p.y * sin(lean) + p.z * cos(lean));
  transformed = p * s + lift + vec3(off.x, 0.0, off.y);
}
`;

type Slot = {
  mesh: Mesh<InstancedBufferGeometry, MeshLambertMaterial>;
  death: InstancedBufferAttribute;
  lane: Vector4;
  crowd: Vector4;
  count: Vector4;
  state: Vector4;
  size: { value: number };
  /** The pack's layout as last drawn (the shader's uniforms). */
  lay: HordeLayout;
  /** Run distance it was last drawn at. */
  drawnAt: number;
  /** The pack drawn here (hazard index), −1 for none. */
  hazard: number;
  /** Figures alive last frame. */
  was: number;
  /** Figures up to here may still be falling. */
  hi: number;
  /** Run distance of the last kill. */
  killedAt: number;
};

export type Horde = {
  /** Places the packs in view for the run as it is now (`clock` drives the stride and the wander; both stand still while paused). */
  update(run: RunState, clock: number): void;
  /** The slots' meshes (for tests; `userData.uniforms` holds their lane, crowd, count and state, and `userData.layout` the HordeLayout). */
  readonly meshes: readonly Mesh<InstancedBufferGeometry>[];
};

export function createHorde(scene: Scene): Horde {
  const figure = makeHordeGeometry();
  const slots: Slot[] = [];
  for (let n = 0; n < HORDE_SLOTS; n++) {
    const geometry = new InstancedBufferGeometry();
    for (const name of ["position", "normal", "color", "leg"])
      geometry.setAttribute(name, figure.getAttribute(name));
    const death = new InstancedBufferAttribute(
      new Float32Array(3 * HORDE_CAP),
      3,
    );
    death.setUsage(DynamicDrawUsage);
    geometry.setAttribute("death", death);
    geometry.instanceCount = 0;
    const lane = new Vector4();
    const crowd = new Vector4();
    const count = new Vector4(1, 1, 1, 0);
    const state = new Vector4();
    const size = { value: 1 };
    const material = new MeshLambertMaterial({
      vertexColors: true,
      flatShading: true,
    });
    material.onBeforeCompile = (shader) => {
      shader.uniforms.hordeLane = { value: lane };
      shader.uniforms.hordeCrowd = { value: crowd };
      shader.uniforms.hordeCount = { value: count };
      shader.uniforms.hordeState = { value: state };
      shader.uniforms.hordeSize = size;
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", `#include <common>\n${VERTEX_HEAD}`)
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>\n${VERTEX_BODY}`,
        );
    };
    const mesh = new Mesh(geometry, material);
    const lay: HordeLayout = {
      laneX: 0,
      laneW: 0,
      headZ: 0,
      left: 0,
      gx: 1,
      gz: 1,
      run: 0,
      size: 1,
      n: 0,
      n0: 1,
      cols: 1,
      stride: 1,
      step: 0,
      off: 0,
      clock: 0,
    };
    mesh.userData.uniforms = { lane, crowd, count, state };
    mesh.userData.layout = lay;
    // figures are placed in the shader; the geometry's bounds mean nothing
    mesh.frustumCulled = false;
    mesh.visible = false;
    scene.add(mesh);
    slots.push({
      mesh,
      death,
      lane,
      crowd,
      count,
      state,
      size,
      lay,
      drawnAt: 0,
      hazard: -1,
      was: 0,
      hi: 0,
      killedAt: -Infinity,
    });
  }

  let track: RunState["track"] | null = null;
  // per hazard: its pack's place among the packs (it picks the slot)
  let order = new Int32Array(0);

  const o: HordeSpot = { x: 0, z: 0, t: 0 };
  /** Survivors drop to n: the figures between were killed and fall from now, where they stood last frame. */
  const kill = (s: Slot, n: number, dist: number): void => {
    if (n < s.was) {
      const a = s.death.array as Float32Array;
      for (let k = n; k < s.was; k++) {
        hordePlace(k, s.lay, o);
        a[3 * k] = dist;
        a[3 * k + 1] = o.x;
        a[3 * k + 2] = o.z - s.drawnAt * DIST_SCALE;
      }
      s.death.addUpdateRange(3 * n, 3 * (s.was - n));
      s.death.needsUpdate = true;
      s.killedAt = dist;
      s.hi = Math.max(s.hi, s.was);
    }
    s.was = n;
  };

  return {
    meshes: slots.map((s) => s.mesh),
    update(run, clock) {
      const { hazards } = run.track;
      if (run.track !== track) {
        // a new run: every slot empty, nothing falling
        track = run.track;
        order = new Int32Array(hazards.length);
        let p = 0;
        hazards.forEach((h, i) => {
          order[i] = h.kind === "pack" ? p++ : -1;
        });
        for (const s of slots) {
          s.hazard = -1;
          s.was = s.hi = 0;
          s.killedAt = -Infinity;
        }
      }
      const { dist } = run;
      // a pack gone (passed, or met the army): its figures go
      for (const s of slots)
        if (s.hazard >= 0 && s.hazard < run.nextHazard) {
          s.hazard = -1;
          s.was = 0;
        }
      for (let i = run.nextHazard; i < hazards.length; i++) {
        if (hazards[i]?.kind !== "pack") continue;
        const pos = hazardPos(run, i);
        if (Math.min(pos, crowdFront(run, i)) - dist > shapeDistance())
          continue;
        const s = slots[(order[i] as number) % HORDE_SLOTS] as Slot;
        const all = run.heads[i] ?? 0;
        const heads = Math.min(HORDE_CAP, all);
        const n = isShattered(run, i)
          ? 0
          : Math.min(HORDE_CAP, packSurvivors(run, i));
        if (s.hazard !== i) {
          // a nearer pack holds the slot, or the last one's figures still fall
          if (s.hazard >= 0 || dist - s.killedAt < DIE_DIST) continue;
          s.hazard = i;
          s.was = s.hi = n;
        }
        kill(s, n, dist);
        s.state.x = n;
        // heads past the cap are not drawn: then every drawn figure is whole
        s.state.y = heads < all ? 1 : packHeadsLeft(run, i) - (n - 1);
        if (n === 0) continue;
        // the crowd where it stands (its mouth, at its own x); the stream on the army
        const mouth = packMouth(run, i);
        const c = crowdOf(run, i);
        const L = s.lay;
        L.laneX = worldX(run.x);
        L.laneW = crowdWidth(run.army) * TRACK_W;
        L.headZ = worldZ(pos, dist);
        L.off = crowdHalfDepth(run.army) * DIST_SCALE;
        L.left = worldX(mouth.left);
        L.gx = c.gx * TRACK_W;
        L.gz = c.gz * DIST_SCALE;
        L.run = (crowdFront(run, i) - pos) * DIST_SCALE;
        L.size = run.horde.hordeScale;
        L.n = n;
        L.n0 = heads;
        if (L.cols !== c.cols) L.stride = hordeStride(c.cols);
        L.cols = c.cols;
        L.step = (PACK_COLUMN_MAX * DIST_SCALE) / Math.max(1, all);
        L.clock = clock;
        s.drawnAt = dist;
        s.lane.set(L.laneX, L.laneW, L.headZ, L.off);
        s.crowd.set(L.left, L.gx, L.gz, L.run);
        s.count.set(L.n0, L.cols, L.stride, L.step);
        s.size.value = L.size;
      }
      for (const s of slots) {
        if (dist - s.killedAt >= DIE_DIST) s.hi = s.was;
        if (s.hazard < 0) s.state.x = 0;
        s.state.z = dist;
        s.state.w = clock;
        s.lay.clock = clock;
        const count = Math.max(s.was, s.hi);
        s.mesh.geometry.instanceCount = count;
        s.mesh.visible = count > 0;
      }
    },
  };
}
