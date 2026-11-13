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
  hazardPos,
  isShattered,
  packAwake,
  packHeadsLeft,
  packMouth,
  packSurvivors,
  type RunState,
} from "../../core/sim";
import { HORDE_HIP, makeHordeGeometry } from "./figures";
import {
  DIST_SCALE,
  FIGURE_RADIUS,
  HORDE_CAP,
  HORDE_COLUMN,
  HORDE_FUNNEL,
  HORDE_GAP,
  HORDE_JITTER,
  hordePlace,
  type HordeShape,
  shapeDistance,
  TRACK_W,
  worldX,
  worldZ,
} from "./world";

/**
 * The enemy packs, every figure animated on the GPU. Each pack in view gets
 * a slot: one instanced mesh of up to HORDE_CAP figures whose places come
 * from the instance index (as `hordePlace`: a column at the army's width
 * funnelling back to the pack's span) and a few uniforms, so a frame costs
 * the same at 200 or 20,000. The only per-figure data is its death: when
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
/** A waiting pack mills about, drawing in this far (0..1) towards its column; a charging one forms it fully. */
export const MILL_FORM = 0.3;
/** Seconds (clock) a charging pack takes to form its column, and a waiting one to draw in. */
const FORM_TIME = 0.4;
const MILL_TIME = 3;

const f = (x: number): string => x.toFixed(6);

/** The vertex shader's figure: placed, striding or falling, from its index and the slot's uniforms. */
const VERTEX_HEAD = `
attribute float leg;
attribute vec3 death;
uniform vec4 hordeFront;
uniform vec4 hordeBack;
uniform vec4 hordeState;
uint hordeHash(uint v) {
  uint s = v * 747796405u + 2891336453u;
  uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
  return (w >> 22u) ^ w;
}
float hordeRand(uint v) { return float(hordeHash(v)) / 4294967296.0; }
`;
const VERTEX_BODY = `
{
  // hordeFront: column centre x, front world z, column width, span width
  // hordeBack: span centre x, area per figure, form (0 milling .. 1 a column), figure size
  // hordeState: alive, front figure's share left, run distance, clock
  // death: run distance, world x and z (with the army at distance 0) where it fell
  uint id = uint(gl_InstanceID);
  float k = float(gl_InstanceID);
  float size = hordeBack.w;
  float gap = ${f(HORDE_GAP)} * size;
  float form = hordeBack.z;
  float mill = 1.0 - form;
  float r1 = hordeRand(2u * id);
  float r2 = hordeRand(2u * id + 1u);
  // as hordePlace: front to back by area, across at a golden-ratio fraction
  float cw = hordeFront.z;
  float pw = hordeFront.w;
  float a = (hordeState.x - 0.5 - k) * hordeBack.y;
  float column = cw * ${f(HORDE_COLUMN)};
  float z;
  if (a <= column) {
    z = a / max(cw, 1e-6);
  } else {
    float b = a - column;
    float funnel = (cw + pw) * 0.5 * ${f(HORDE_FUNNEL)};
    if (b <= funnel) {
      float slope = (pw - cw) / ${f(HORDE_FUNNEL)};
      z = ${f(HORDE_COLUMN)} + 2.0 * b / max(1e-6, cw + sqrt(max(0.0, cw * cw + 2.0 * slope * b)));
    } else {
      z = ${f(HORDE_COLUMN + HORDE_FUNNEL)} + (b - funnel) / max(pw, 1e-6);
    }
  }
  float fl = clamp((z - ${f(HORDE_COLUMN)}) / ${f(HORDE_FUNNEL)}, 0.0, 1.0);
  float w = mix(cw, pw, fl);
  float u = clamp(fract(k * 0.6180339887) - 0.5 + ${f(HORDE_JITTER)} * gap * (2.0 * r1 - 1.0) / max(w, gap), -0.5, 0.5);
  vec2 off = vec2(
    mix(hordeFront.x, hordeBack.x, fl) + u * max(0.0, w - ${f(2 * FIGURE_RADIUS)} * size),
    hordeFront.y - max(0.0, z + ${f(HORDE_JITTER)} * gap * (2.0 * r2 - 1.0))
  );
  // a waiting pack mills about: each figure wanders a little and turns
  float clock = hordeState.w;
  off += mill * 0.8 * gap * vec2(sin(clock * 0.9 + 6.2831853 * r2), cos(clock * 0.7 + 6.2831853 * r1));
  float yaw = 3.14159265 + mill * 0.9 * sin(clock * 0.5 + 6.2831853 * r1);
  float stride = 6.2831853 * (clock * ${f(STRIDE_HZ)} + r1);
  float s = size;
  float lean = -0.2 * form + 0.06 * sin(2.0 * stride);
  float sway = 0.1 * sin(stride);
  float swing = mix(0.3, 0.75, form) * sin(stride);
  vec3 lift = vec3(0.0, abs(sin(stride)) * mix(0.03, 0.08, form) * size, 0.0);
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
  // sway (z), face the army (y), lean into the run (x)
  p.xy = vec2(p.x * cos(sway) - p.y * sin(sway), p.x * sin(sway) + p.y * cos(sway));
  p.xz = vec2(p.x * cos(yaw) + p.z * sin(yaw), -p.x * sin(yaw) + p.z * cos(yaw));
  p.yz = vec2(p.y * cos(lean) - p.z * sin(lean), p.y * sin(lean) + p.z * cos(lean));
  transformed = p * s + lift + vec3(off.x, 0.0, off.y);
}
`;

type Slot = {
  mesh: Mesh<InstancedBufferGeometry, MeshLambertMaterial>;
  death: InstancedBufferAttribute;
  front: Vector4;
  back: Vector4;
  state: Vector4;
  /** The pack's shape as last drawn. */
  shape: HordeShape;
  /** The pack drawn here (hazard index), −1 for none. */
  hazard: number;
  /** Figures alive last frame. */
  was: number;
  /** Figures up to here may still be falling. */
  hi: number;
  /** Run distance of the last kill. */
  killedAt: number;
  /** The pack's front, world z with the army at distance 0, as last drawn. */
  z0: number;
  /** How formed its column is (0 milling .. 1). */
  form: number;
  /** Its track distance and the clock last frame. */
  pos: number;
  clock: number;
};

export type Horde = {
  /** Places the packs in view for the run as it is now (`clock` drives the stride; both stand still while paused). */
  update(run: RunState, clock: number): void;
  /** The slots' meshes (for tests; `userData.uniforms` holds their front, back and state). */
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
    const front = new Vector4();
    const back = new Vector4();
    const state = new Vector4();
    const material = new MeshLambertMaterial({
      vertexColors: true,
      flatShading: true,
    });
    material.onBeforeCompile = (shader) => {
      shader.uniforms.hordeFront = { value: front };
      shader.uniforms.hordeBack = { value: back };
      shader.uniforms.hordeState = { value: state };
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", `#include <common>\n${VERTEX_HEAD}`)
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>\n${VERTEX_BODY}`,
        );
    };
    const mesh = new Mesh(geometry, material);
    mesh.userData.uniforms = { front, back, state };
    // figures are placed in the shader; the geometry's bounds mean nothing
    mesh.frustumCulled = false;
    mesh.visible = false;
    scene.add(mesh);
    slots.push({
      mesh,
      death,
      front,
      back,
      state,
      shape: { cx: 0, cw: 0, px: 0, pw: 0, area: 0 },
      hazard: -1,
      was: 0,
      hi: 0,
      killedAt: -Infinity,
      z0: 0,
      form: 0,
      pos: 0,
      clock: 0,
    });
  }

  let track: RunState["track"] | null = null;
  // per hazard: its pack's place among the packs (it picks the slot)
  let order = new Int32Array(0);

  const o = { x: 0, z: 0 };
  /** Survivors drop to n: the front figures between fall from now, where they stood last frame. */
  const kill = (s: Slot, n: number, dist: number): void => {
    if (n < s.was) {
      const a = s.death.array as Float32Array;
      for (let k = n; k < s.was; k++) {
        hordePlace(k, s.was, s.shape, s.back.w, o);
        a[3 * k] = dist;
        a[3 * k + 1] = o.x;
        a[3 * k + 2] = s.z0 - o.z;
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
      const armyX = worldX(run.x);
      const armyW = crowdWidth(run.army) * TRACK_W;
      for (let i = run.nextHazard; i < hazards.length; i++) {
        if (hazards[i]?.kind !== "pack") continue;
        const pos = hazardPos(run, i);
        if (pos - dist > shapeDistance()) continue;
        const s = slots[(order[i] as number) % HORDE_SLOTS] as Slot;
        const heads = Math.min(HORDE_CAP, run.heads[i] ?? 0);
        const n = isShattered(run, i)
          ? 0
          : Math.min(HORDE_CAP, packSurvivors(run, i));
        if (s.hazard !== i) {
          // a nearer pack holds the slot, or the last one's figures still fall
          if (s.hazard >= 0 || dist - s.killedAt < DIE_DIST) continue;
          s.hazard = i;
          s.was = s.hi = n;
          s.form = 0;
          s.pos = pos;
          s.clock = clock;
        }
        kill(s, n, dist);
        // a charging pack forms its column; a waiting one mills, drawing in slowly
        const charging = packAwake(run, i);
        const target = charging ? 1 : Math.max(s.form, MILL_FORM);
        const dt = Math.max(0, clock - s.clock);
        s.form +=
          (target - s.form) *
          (1 - Math.exp(-dt / (charging ? FORM_TIME : MILL_TIME)));
        s.pos = pos;
        s.clock = clock;
        s.state.x = n;
        // heads past the cap are not drawn: then every drawn figure is whole
        s.state.y =
          heads < (run.heads[i] ?? 0) ? 1 : packHeadsLeft(run, i) - (n - 1);
        if (n === 0) continue;
        const span = packMouth(run, i);
        const size = run.horde.hordeScale;
        const sh = s.shape;
        sh.pw = (span.right - span.left) * TRACK_W;
        sh.px = worldX((span.left + span.right) / 2);
        sh.cw = sh.pw + (armyW - sh.pw) * s.form;
        sh.cx = sh.px + (armyX - sh.px) * s.form;
        sh.area = (HORDE_GAP * size) ** 2;
        s.z0 = worldZ(pos, 0);
        s.front.set(sh.cx, s.z0 + dist * DIST_SCALE, sh.cw, sh.pw);
        s.back.set(sh.px, sh.area, s.form, size);
      }
      for (const s of slots) {
        if (dist - s.killedAt >= DIE_DIST) s.hi = s.was;
        if (s.hazard < 0) s.state.x = 0;
        s.state.z = dist;
        s.state.w = clock;
        const count = Math.max(s.was, s.hi);
        s.mesh.geometry.instanceCount = count;
        s.mesh.visible = count > 0;
      }
    },
  };
}
