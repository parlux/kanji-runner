import { createRng, type Rng } from "../../core/rng";
import { DIST_SCALE, HAZE_MAX, TRACK_W } from "./world";

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
  | "fin";

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
/** Spring village's stone lanterns: every 12 (divides PROP_SPAN), at this x. */
export const LANTERN_STEP = 12;
export const LANTERN_X = 6.8;

/** Race day: stand segments, posts and flags are laid in steps that divide PROP_SPAN. */
export const STAND_STEP = 12;
export const FLAG_STEP = 12;
export const FLAG_X = 6.4;
/** Stepped stands: tiers start at this |x|, are this wide and this much higher each. */
export const STAND_X = 9;
export const TIER_W = 1.4;
export const TIER_H = 0.8;
export const TIERS = 6;
const CROWD_COLOURS = [
  0xff5a5a, 0xffc94a, 0x3d7bff, 0xffffff, 0x50d27a, 0xff8fd0, 0x9b6bff,
];

/** Block city: street lamps and pavement tiles are laid every 12 (divides PROP_SPAN). */
export const LAMP_STEP = 12;
export const LAMP_X = 6.2;
export const WALK_STEP = 12;
/** The pavement runs from the kerb's outer edge: centred at this |x|, this wide. */
export const WALK_X = 7;
export const WALK_W = 3;
/** Building row 1 starts at this |x| (beyond the pavement). */
export const BLOCK_X = 9;
/** A window is this wide and high (world units): block sizes are multiples, so the pattern fits. */
export const WINDOW_W = 2;
export const WINDOW_H = 2.4;
const PASTELS = [
  0xffb5a7, 0xffd6a5, 0xfdffb6, 0xcaffbf, 0x9bf6ff, 0xa0c4ff, 0xbdb2ff,
  0xffc6ff,
];

/**
 * One side's row of blocks from `inner` outwards: depths from `depths` (and
 * widths from `widths`) fill PROP_SPAN exactly, the leftover spread as small
 * gaps, so the row tiles the wrap with no hole at the seam.
 */
function blockRow(
  rng: Rng,
  s: number,
  inner: number,
  widths: number[],
  depths: number[],
  floors: [number, number],
  props: Part[],
): void {
  const ds: number[] = [];
  let total = 0;
  for (;;) {
    const d = pick(rng, depths);
    if (total + d + (ds.length + 1) > PROP_SPAN) break;
    ds.push(d);
    total += d;
  }
  const weights = ds.map(() => range(rng, 0.4, 2.5));
  const wsum = weights.reduce((a, b) => a + b, 0);
  let z = PROP_FAR;
  ds.forEach((d, i) => {
    const w = pick(rng, widths);
    const h =
      WINDOW_H * (floors[0] + Math.floor(rng() * (floors[1] - floors[0] + 1)));
    props.push(
      part(
        "block",
        s * (inner + w / 2 + range(rng, 0, 1.5)),
        0,
        z + d / 2,
        1,
        pick(rng, PASTELS),
        { sx: w, sy: h, sz: d },
      ),
    );
    z += d + ((PROP_SPAN - total) * (weights[i] as number)) / wsum;
  });
}

/** Block city: pastel blocks in near-continuous rows, pavement and street lamps by the road. */
function cityLayout(): Layout {
  const rng = createRng(31);
  const props: Part[] = [];
  const backdrop: Part[] = [];
  for (let z = PROP_FAR; z < PROP_NEAR; z += WALK_STEP)
    for (const s of [-1, 1])
      props.push(
        part("box", s * WALK_X, 0, z + WALK_STEP / 2, 1, 0xe4e7ee, {
          sx: WALK_W,
          sy: 0.12,
          sz: WALK_STEP,
        }),
      );
  for (let z = PROP_FAR; z < PROP_NEAR; z += LAMP_STEP)
    for (const s of [-1, 1]) {
      const zl = z + LAMP_STEP / 2;
      props.push(
        part("box", s * LAMP_X, 0, zl, 1, 0x4a5568, {
          sx: 0.14,
          sy: 3.6,
          sz: 0.14,
        }),
        // the arm and lamp reach out over the pavement, never over the kerb
        part("box", s * (LAMP_X + 0.4), 3.5, zl, 1, 0x4a5568, {
          sx: 0.9,
          sy: 0.08,
          sz: 0.08,
        }),
        part("box", s * (LAMP_X + 0.8), 3.2, zl, 1, 0xfff3b0, {
          sx: 0.35,
          sy: 0.2,
          sz: 0.3,
        }),
      );
    }
  for (const s of [-1, 1]) {
    blockRow(rng, s, BLOCK_X, [6, 8, 10], [6, 8, 10], [3, 9], props);
    blockRow(rng, s, 24, [14, 16, 18, 20, 22], [8, 10, 12], [5, 12], props);
  }
  // a pale skyline beyond the haze (within the drift wrap, so it stays put)
  for (let i = 0; i < 40; i++) {
    const h = range(rng, 14, 50);
    backdrop.push(
      part(
        "box",
        range(rng, -210, 210),
        -2,
        range(rng, -340, -300),
        1,
        pick(rng, [0xf2f7ff, 0xe6eefa, 0xdde8f6]),
        {
          sx: range(rng, 12, 26),
          sy: h,
          sz: 12,
        },
      ),
    );
  }
  // a blimp drifting slowly: a white body with an orange tail fin
  backdrop.push(
    part("blimp", -8, 34, -260, 1, 0xf0f2f7, {
      sx: 12,
      sy: 5,
      sz: 5,
      drift: 2,
    }),
    part("fin", -19, 35, -260, 1, 0xff7a59, {
      sx: 4,
      sy: 6,
      sz: 0.4,
      drift: 2,
    }),
  );
  for (let i = 0; i < 5; i++) {
    const scale = range(rng, 1.5, 2.4);
    const cx = range(rng, -160, 160);
    const cy = range(rng, 70, 100);
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
  return { props, backdrop, petals: [] };
}

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
  return { props, backdrop, petals: [] };
}

/** Spring village: cherry trees, stone lanterns and small houses by the road; a snowy mountain, a pale sun and clouds beyond; petals. */
function springLayout(): Layout {
  const rng = createRng(11);
  const props: Part[] = [];
  const backdrop: Part[] = [];
  const stone = 0xc4c0b8;
  for (let z = PROP_FAR; z < PROP_NEAR; z += LANTERN_STEP)
    for (const s of [-1, 1]) {
      const x = s * LANTERN_X;
      props.push(
        part("box", x, 0, z, 1, stone, { sx: 0.7, sy: 0.25, sz: 0.7 }),
        part("box", x, 0.25, z, 1, 0xd2cec6, { sx: 0.3, sy: 0.8, sz: 0.3 }),
        part("box", x, 1.05, z, 1, 0xfff3c4, { sx: 0.5, sy: 0.45, sz: 0.5 }),
        part("roof", x, 1.5, z, 1, 0x8c8880, { sx: 0.65, sy: 0.4, sz: 0.65 }),
      );
    }
  for (let i = 0; i < 60; i++) {
    const x = side(rng) * range(rng, 8, 34);
    const z = range(rng, PROP_FAR, PROP_NEAR);
    const s = range(rng, 0.9, 1.4);
    props.push(part("trunk", x, 0, z, s, 0x6b4a3a, { rot: rng() * 6 }));
    const puffs = 3 + Math.floor(rng() * 2);
    for (let k = 0; k < puffs; k++) {
      const a = (k / puffs) * Math.PI * 2 + rng();
      const r = range(rng, 0.9, 1.3) * s;
      props.push(
        part(
          "crown",
          x + Math.cos(a) * 0.8 * s,
          (2.3 + (k % 2) * 0.5) * s,
          z + Math.sin(a) * 0.8 * s,
          r,
          pick(rng, [0xffb7d0, 0xffa6c4, 0xffc8da, 0xf79bbb]),
          { rot: rng() * 6 },
        ),
      );
    }
  }
  for (let i = 0; i < 26; i++) {
    const w = range(rng, 3, 5);
    const d = range(rng, 3, 4.5);
    const x = side(rng) * range(rng, 14, 40);
    const z = range(rng, PROP_FAR, PROP_NEAR);
    const rot = range(rng, -0.2, 0.2);
    props.push(
      part("box", x, 0, z, 1, 0xf5efe4, { sx: w, sy: 2.2, sz: d, rot }),
      part("roof", x, 2.2, z, 1, pick(rng, [0x3e4a5c, 0x5a3e3e, 0x2f3b4a]), {
        sx: w * 0.82,
        sy: 1.6,
        sz: d * 0.82,
        rot,
      }),
    );
  }
  // one big snowy mountain, two lesser peaks, a pale sun and a few clouds
  backdrop.push(
    part("peak", 34, 22, -360, 1, 0x8fa3c4, { sx: 95, sy: 70, sz: 95 }),
    part("peak", 34, 45.5, -359.5, 1, 0xffffff, { sx: 31, sy: 23, sz: 31 }),
    part("peak", -120, 18, -345, 1, 0xa6b6d2, { sx: 70, sy: 50, sz: 70 }),
    part("peak", 150, 14, -345, 1, 0xa6b6d2, { sx: 60, sy: 42, sz: 60 }),
    part("sun", -60, 55, -355, 14, 0xfff1f4),
  );
  for (let i = 0; i < 5; i++) {
    const scale = range(rng, 1.5, 2.4);
    const cx = range(rng, -160, 160);
    const cy = range(rng, 45, 80);
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
  // petals: a few high over the track, the rest at the sides at any height
  const petals: Petal[] = [];
  for (let i = 0; i < 260; i++) {
    const over = i < 80;
    const lo = over ? PETAL_TRACK_MIN_Y + 0.5 : 0.2;
    const hi = over ? 14 : 12;
    petals.push({
      x: over
        ? range(rng, -TRACK_W / 2, TRACK_W / 2)
        : side(rng) * range(rng, TRACK_W / 2 + 1.8, 30),
      y: range(rng, lo, hi),
      z: range(rng, PETAL_FAR, PETAL_NEAR),
      lo,
      hi,
      fall: range(rng, 0.5, 1.2),
      sway: range(rng, 0.2, 0.6),
      phase: rng() * Math.PI * 2,
    });
  }
  return { props, backdrop, petals };
}

/** Race day: stepped stands with a crowd and an orange roof on both sides, flags along the kerbs, floodlights; balloons and clouds in the sky. */
function stadiumLayout(): Layout {
  const rng = createRng(23);
  const props: Part[] = [];
  const backdrop: Part[] = [];
  const grey = [0xe4e6ea, 0xc8ccd2];
  const roofX = STAND_X + TIER_W * (TIERS - 1) - 0.4;
  const roofW = 5.2;
  const standTop = TIERS * TIER_H;
  for (let z = PROP_FAR; z < PROP_NEAR; z += STAND_STEP) {
    const zc = z + STAND_STEP / 2;
    for (const s of [-1, 1]) {
      for (let i = 0; i < TIERS; i++) {
        const x = s * (STAND_X + TIER_W * (i + 0.5));
        const top = (i + 1) * TIER_H;
        props.push(
          part("box", x, 0, zc, 1, grey[i % 2] as number, {
            sx: TIER_W,
            sy: top,
            sz: STAND_STEP,
          }),
        );
        for (let k = 0; k < STAND_STEP; k++) {
          if (rng() < 0.2) continue;
          props.push(
            part(
              "box",
              x + range(rng, -0.2, 0.2),
              top,
              zc + (k - STAND_STEP / 2 + 0.5) + range(rng, -0.15, 0.15),
              1,
              pick(rng, CROWD_COLOURS),
              { sx: 0.4, sy: range(rng, 0.5, 0.7), sz: 0.4 },
            ),
          );
        }
      }
      // roof over the upper tiers: low edge at the front, rising to the back
      props.push(
        part(
          "awning",
          s * (roofX + roofW / 2 - 0.1),
          standTop + 2.2,
          zc,
          1,
          0xff7a59,
          {
            sx: roofW,
            sz: STAND_STEP,
            rot: s < 0 ? Math.PI : 0,
          },
        ),
        part("box", s * (roofX + roofW - 0.3), 0, zc, 1, 0xf2f2f4, {
          sx: 0.35,
          sy: standTop + 2.7,
          sz: 0.35,
        }),
        part("box", s * (roofX + 0.2), 0, zc, 1, 0xf2f2f4, {
          sx: 0.35,
          sy: standTop + 1.7,
          sz: 0.35,
        }),
      );
    }
  }
  // flags on poles along the kerbs, alternating kerb orange and army blue
  for (let z = PROP_FAR, n = 0; z < PROP_NEAR; z += FLAG_STEP, n++)
    for (const s of [-1, 1]) {
      const x = s * FLAG_X;
      const zf = z + FLAG_STEP / 2;
      props.push(
        part("box", x, 0, zf, 1, 0xf2f2f2, { sx: 0.1, sy: 3.4, sz: 0.1 }),
        part("flag", x, 2.9, zf, 1, n % 2 ? 0x3d7bff : 0xff7a59, {
          sy: 0.9,
          sz: 1.3,
        }),
      );
    }
  // floodlight masts behind the stands
  for (let z = PROP_FAR + 42; z < PROP_NEAR; z += 84)
    for (const s of [-1, 1])
      props.push(
        part("box", s * 38, 0, z, 1, 0xbfc4cc, { sx: 0.6, sy: 16, sz: 0.6 }),
        part("box", s * 38, 16, z, 1, 0xfff6c8, { sx: 4, sy: 1.4, sz: 0.8 }),
      );
  // balloons high in the sky, and a few clouds
  for (let i = 0; i < 16; i++) {
    const r = range(rng, 1.3, 2);
    backdrop.push(
      part(
        "balloon",
        range(rng, -70, 70),
        range(rng, 20, 48),
        range(rng, -220, -110),
        r,
        pick(
          rng,
          CROWD_COLOURS.filter((c) => c !== 0xffffff),
        ),
        { sy: r * 1.2, drift: side(rng) * range(rng, 0.6, 1.4) },
      ),
    );
  }
  for (let i = 0; i < 4; i++) {
    const scale = range(rng, 1.5, 2.4);
    const cx = range(rng, -160, 160);
    const cy = range(rng, 40, 75);
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
  return { props, backdrop, petals: [] };
}

/** The built looks. Later looks add an entry here and a layout function. */
export const LOOKS: Partial<Record<LookId, Look>> = {
  country: {
    id: "country",
    sky: { top: 0x5fb8f5, horizon: 0xd8f0ff, below: 0xd8f0ff },
    ground: 0x7fcf6a,
    layout: countryLayout,
  },
  spring: {
    id: "spring",
    sky: { top: 0x7ec4f0, horizon: 0xfde8ef, below: 0xfde8ef },
    ground: 0x9fd68a,
    layout: springLayout,
  },
  stadium: {
    id: "stadium",
    sky: { top: 0x4aa8f0, horizon: 0xd4eeff, below: 0xd4eeff },
    ground: 0x6cc35c,
    layout: stadiumLayout,
  },
  city: {
    id: "city",
    sky: { top: 0x6cc0f5, horizon: 0xe2f2ff, below: 0xe2f2ff },
    ground: 0xbfc6d4,
    layout: cityLayout,
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
