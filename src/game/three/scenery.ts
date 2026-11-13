import { createRng, type Rng } from "../../core/rng";
import { DIST_SCALE, HAZE_MAX } from "./world";

/**
 * Pure data for the 3D run's scenery: which look a run gets, and each look's
 * layout (sky colours, ground, and the props and backdrop as plain parts).
 * No Three.js here; `sceneryMeshes.ts` builds the meshes from it.
 *
 * Roadside props scroll with the run and wrap from behind the camera to the
 * far end (`wrapZ`); the backdrop (hills, clouds) stands beyond the haze and
 * only drifts sideways.
 */

/** Every look's id, as `?scenery=<id>` names it. */
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
  "trunk" | "crown" | "pine" | "bush" | "fence" | "hill" | "puff";

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
};

export type Layout = {
  /** Roadside props: scroll with the run, fogged. */
  props: Part[];
  /** Beyond the haze: never scrolls, drawn without fog. */
  backdrop: Part[];
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

/** Wraps `v` into [lo, lo + span). */
export const wrap = (v: number, lo: number, span: number): number =>
  lo + ((((v - lo) % span) + span) % span);

/** A prop's world Z with the army at `runDist`: scrolled towards the camera, wrapped into [PROP_FAR, PROP_NEAR). */
export const wrapZ = (z0: number, runDist: number): number =>
  wrap(z0 + runDist * DIST_SCALE, PROP_FAR, PROP_SPAN);

const range = (rng: Rng, a: number, b: number): number => a + rng() * (b - a);
const pick = <T>(rng: Rng, items: readonly T[]): T =>
  items[Math.floor(rng() * items.length)] as T;
const side = (rng: Rng): number => (rng() < 0.5 ? -1 : 1);

const part = (
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

/** Fence posts sit this far out from the track's centre (just beyond the kerb). */
export const FENCE_X = 6.6;
/** One fence section's length: it divides PROP_SPAN, so the wrap has no seam. */
export const FENCE_STEP = 4;

/** Countryside: trees, bushes and a white fence by the road; hills and drifting clouds beyond. */
function countryLayout(): Layout {
  const rng = createRng(7);
  const props: Part[] = [];
  const backdrop: Part[] = [];
  for (let z = PROP_FAR; z < PROP_NEAR; z += FENCE_STEP)
    for (const s of [-1, 1])
      props.push(part("fence", s * FENCE_X, 0, z, 1, 0xffffff));
  for (let i = 0; i < 90; i++) {
    const x = side(rng) * range(rng, 8.5, 40);
    const z = range(rng, PROP_FAR, PROP_NEAR);
    const s = range(rng, 0.9, 1.5);
    const rot = rng() * Math.PI * 2;
    props.push(part("trunk", x, 0, z, s, 0x8a5a3b, { rot }));
    if (rng() < 0.35)
      props.push(
        part(
          "pine",
          x,
          2.8 * s,
          z,
          s,
          pick(rng, [0x2f8f4e, 0x3aa35a, 0x2b7d46]),
          {
            rot,
          },
        ),
      );
    else
      props.push(
        part(
          "crown",
          x,
          2.4 * s,
          z,
          range(rng, 1.2, 1.6) * s,
          pick(rng, [0x4caf50, 0x5cbf5a, 0x3f9f4a]),
          { rot },
        ),
      );
  }
  for (let i = 0; i < 50; i++) {
    const r = range(rng, 0.4, 0.8);
    props.push(
      part(
        "bush",
        side(rng) * range(rng, 7.2, 20),
        0.3,
        range(rng, PROP_FAR, PROP_NEAR),
        r,
        pick(rng, [0x5cbf5a, 0x6fd06a, 0x4aa84d]),
        { sy: r * 0.7, rot: rng() * Math.PI * 2 },
      ),
    );
  }
  for (let i = 0; i < 7; i++) {
    const r = range(rng, 50, 90);
    backdrop.push(
      part(
        "hill",
        -270 + i * 90 + range(rng, -20, 20),
        -6,
        -300 - range(rng, 0, 40),
        r,
        pick(rng, [0x9fd99a, 0x8dcf8f, 0xa9dfa2]),
        { sy: r * 0.35 },
      ),
    );
  }
  for (let i = 0; i < 9; i++) {
    const scale = range(rng, 1.4, 2.6);
    const cx = range(rng, -160, 160);
    const cy = range(rng, 28, 70);
    const cz = range(rng, -200, -320);
    const n = 3 + Math.floor(rng() * 3);
    for (let k = 0; k < n; k++) {
      const r = range(rng, 2, 3.4) * scale;
      backdrop.push(
        part(
          "puff",
          cx + ((k - n / 2) * 2.6 + range(rng, -0.6, 0.6)) * scale,
          cy + range(rng, -0.4, 1.2) * scale,
          cz + range(rng, -1, 1) * scale,
          r,
          0xffffff,
          { sy: r * 0.7, drift: 1.5 },
        ),
      );
    }
  }
  return { props, backdrop };
}

/** The built looks. Later looks add an entry here and a layout function. */
export const LOOKS: Partial<Record<LookId, Look>> = {
  country: {
    id: "country",
    sky: { top: 0x5fb8f5, horizon: 0xd8f0ff, below: 0xd8f0ff },
    ground: 0x7fcf6a,
    layout: countryLayout,
  },
};

/** The ids of the looks that exist, in LOOK_IDS order. */
export const builtLooks = (): LookId[] => LOOK_IDS.filter((id) => LOOKS[id]);

/** The look a run's `seed` gets: one of the built looks, roughly evenly. */
export function sceneryFor(seed: number): LookId {
  const built = builtLooks();
  // a stream of its own, so the pick doesn't follow the track's own randomness
  const u = createRng((seed ^ 0x5ce4e7) >>> 0)();
  return built[Math.floor(u * built.length)] as LookId;
}

/** The look `?scenery=<id>` forces, or null (absent, unknown or not built yet). */
export function sceneryParam(search: string): LookId | null {
  const id = new URLSearchParams(search).get("scenery");
  return LOOK_IDS.find((l) => l === id && LOOKS[l]) ?? null;
}

/** Haze is at most this far ahead (world units): props past it are always hidden, so PROP_FAR lies beyond it. */
export const HAZE_FAR_Z = -HAZE_MAX * DIST_SCALE;
