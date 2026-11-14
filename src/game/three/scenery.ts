import { type Rng } from "../../core/rng";
import { DIST_SCALE } from "./world";

/**
 * Pure data for the 3D run's scenery: the part and look types and the shared
 * wrap, bob and petal maths. No Three.js here. Each look's layout is in
 * `lookCountry.ts`, `lookSpring.ts`, `lookStadium.ts`, `lookCity.ts` and
 * `lookSky.ts`; `looks.ts` lists them and picks one per run; `sceneryMeshes.ts`
 * builds the meshes.
 *
 * Roadside props scroll with the run and wrap from behind the camera to the
 * far end (`wrapZ`); the backdrop (hills, clouds) stands beyond the haze and
 * only drifts sideways.
 */

/** Every look's id. */
export const LOOK_IDS = [
  "country",
  "spring",
  "stadium",
  "sky",
  "city",
] as const;
export type LookId = (typeof LOOK_IDS)[number];

/** A part's mesh: each shape is one instanced mesh per layer (props, backdrop). */
export type Shape =
  | "trunk"
  | "crown"
  | "pine"
  | "bush"
  | "fence"
  | "hill"
  | "puff"
  | "box"
  | "roof"
  | "peak"
  | "sun"
  | "awning"
  | "flag"
  | "balloon"
  | "block"
  | "blimp"
  | "fin"
  | "isle"
  | "disc";

/**
 * One instance of a shape: its place (world units; `z` is where it starts,
 * before scrolling), its scale per axis, its turn about Y (radians), its colour,
 * and, for backdrop parts, its sideways drift (world units per second).
 */
export type Part = {
  shape: Shape;
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  rot: number;
  colour: number;
  drift: number;
  /** Props that bob up and down (Cloud road's islands): the phase of the bob (radians). */
  bob?: number;
};

/**
 * One falling petal: it starts at (`x`, `y`, `z`), falls `fall` units per
 * second within [`lo`, `hi`) and sways `sway` sideways. Positions come from
 * `petalX/Y/Z`, which are pure, so they stand still when the clock does.
 */
export type Petal = {
  x: number;
  y: number;
  z: number;
  lo: number;
  hi: number;
  fall: number;
  sway: number;
  phase: number;
};

export type Layout = {
  /** Roadside props: scroll with the run, fogged. */
  props: Part[];
  /** Beyond the haze: never scrolls, drawn without fog. */
  backdrop: Part[];
  /** Falling petals (one `Points` layer, at most `MAX_PETALS`); none for most looks. */
  petals: Petal[];
};

/**
 * A look. `sky.below` is the colour under the horizon (Cloud road shows it);
 * `ground: null` hides the ground (Cloud road).
 */
export type Look = {
  id: LookId;
  sky: { top: number; horizon: number; below: number };
  ground: number | null;
  layout: () => Layout;
};

/** Props scroll within this Z range (world units): from behind the camera to past the farthest haze. */
export const PROP_NEAR = 30;
export const PROP_SPAN = 252;
export const PROP_FAR = PROP_NEAR - PROP_SPAN;
/** Backdrop parts drift and wrap within ±this (world X), off screen. */
export const DRIFT_WRAP = 220;

/** Bobbing props rise and fall this much (world units) at this rate (rad/s). */
export const BOB_AMOUNT = 0.4;
const BOB_RATE = 0.9;
/** A bobbing prop's lift above its resting Y at time `clock` (s); stands still when the clock does. */
export const bobY = (phase: number, clock: number): number =>
  BOB_AMOUNT * Math.sin(clock * BOB_RATE + phase);

/** Wraps `v` into [lo, lo + span). */
export const wrap = (v: number, lo: number, span: number): number =>
  lo + ((((v - lo) % span) + span) % span);

/** A prop's world Z with the army at `runDist`: scrolled towards the camera, wrapped into [PROP_FAR, PROP_NEAR). */
export const wrapZ = (z0: number, runDist: number): number =>
  wrap(z0 + runDist * DIST_SCALE, PROP_FAR, PROP_SPAN);

/** Petals scroll within this Z range (world units), nearer than the props' far end. */
export const PETAL_NEAR = 8;
export const PETAL_FAR = -78;
export const MAX_PETALS = 300;
/** Petals over the track's column stay at least this high, so they never cross a gate's text. */
export const PETAL_TRACK_MIN_Y = 6;

export const petalZ = (p: Petal, runDist: number): number =>
  wrap(p.z + runDist * DIST_SCALE, PETAL_FAR, PETAL_NEAR - PETAL_FAR);
export const petalY = (p: Petal, clock: number): number =>
  wrap(p.y - clock * p.fall, p.lo, p.hi - p.lo);
export const petalX = (p: Petal, clock: number): number =>
  p.x + Math.sin(clock * 0.7 + p.phase) * p.sway;

export const range = (rng: Rng, a: number, b: number): number =>
  a + rng() * (b - a);
export const pick = <T>(rng: Rng, items: readonly T[]): T =>
  items[Math.floor(rng() * items.length)] as T;
export const side = (rng: Rng): number => (rng() < 0.5 ? -1 : 1);

export const part = (
  shape: Shape,
  x: number,
  y: number,
  z: number,
  s: number,
  colour: number,
  extra: Partial<Part> = {},
): Part => ({
  shape,
  x,
  y,
  z,
  sx: s,
  sy: s,
  sz: s,
  rot: 0,
  colour,
  drift: 0,
  ...extra,
});
