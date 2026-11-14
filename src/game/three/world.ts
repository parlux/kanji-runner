import { crowdWidth } from "../../core/crowd";
import { hazardPos, packSurvivors } from "../../core/horde";
import { type RunState } from "../../core/sim";
import { isShattered } from "../../core/shooting";
import { hazardSpan } from "../../core/track";
import { VIEW_DISTANCE } from "../../core/tuning";

/**
 * Pure maths for the 3D run: where the sim's track lands in the world, how a
 * crowd is laid out, and the haze settings. No Three.js here. The camera and
 * fog maths are in `camera.ts`; wall, squad, hazard, horde and boss placement
 * are in `wallLayout.ts`, `hazardLayout.ts`, `hordeLayout.ts` and `bossLayout.ts`.
 *
 * World axes: X right, Y up, Z towards the camera. The army stands at Z = 0
 * and runs towards −Z; everything is placed relative to the army's distance.
 */

/** Track width in world units (track x 0..1 spans this). */
export const TRACK_W = 10;
/** World units per unit of track distance. */
export const DIST_SCALE = 10;
/** Most figures drawn per crowd; above it the count on the crowd tells the real number. */
export const MAX_DRAWN_SOLDIERS = 200;
/** A figure's footprint radius: the layout keeps it inside the crowd's width. */
export const FIGURE_RADIUS = 0.12;
/** A crowd is this many times deeper (along the track) than it is wide. */
export const CROWD_DEPTH = 1.8;
/**
 * The default shape horizon (track distance ahead of the army): solid objects
 * are drawn up to here, faint in the haze, and so is their text. Must stay below the
 * closest a re-ask can replace a row (tested): `HAZE_MAX` is the safe limit.
 */
export const SHAPE_DISTANCE = 4 * VIEW_DISTANCE;
/** The farthest the haze slider goes: just inside the closest a re-ask can replace a row. */
export const HAZE_MAX = 21;
/** The shape horizon in use (`SHAPE_DISTANCE`). */
export const shapeDistance = (): number => SHAPE_DISTANCE;
/** The default distance haze colour (the fog's), as 0xrrggbb. */
export const HAZE_COLOUR = 0xd4eeff;
let hazeHex = HAZE_COLOUR;
/** The haze colour in use: the scenery look's horizon (`HAZE_COLOUR` until set). */
export const hazeColour = (): number => hazeHex;
/** Sets the haze colour in use (the 3D view does, to its look's horizon). */
export const setHazeColour = (c: number): void => {
  hazeHex = c;
};
/** Tallest thing on the track (world units): the haze hides it whole at SHAPE_DISTANCE. */
export const FOG_TOP_H = 3;

/** Screen position (CSS px) of a track point (x, distance, height), or null when behind the camera. */
export type Projector = (
  x: number,
  dist: number,
  height: number,
) => { x: number; y: number } | null;

/** Track x (0 left .. 1 right) → world X. */
export const worldX = (x: number): number => (x - 0.5) * TRACK_W;
/** World X → track x. */
export const trackX = (wx: number): number => wx / TRACK_W + 0.5;
/** Track distance `dist` → world Z, with the army at `runDist`. */
export const worldZ = (dist: number, runDist: number): number =>
  -(dist - runDist) * DIST_SCALE;

/** Figures drawn for an army of this size. */
const drawnCount = (army: number): number =>
  Math.max(0, Math.min(Math.floor(army), MAX_DRAWN_SOLDIERS));

/**
 * Each drawn figure's offset from the crowd's centre, written as (x, z) pairs
 * into `out`; returns the count. Sunflower packing on an ellipse as wide as
 * `crowdWidth(army)`, so the same army always gets the same layout and
 * higher indices sit at the edge (new soldiers join at the rim).
 */
export function crowdLayout(army: number, out: Float32Array): number {
  const n = Math.min(drawnCount(army), out.length >> 1);
  const r = Math.max(0, (crowdWidth(army) * TRACK_W) / 2 - FIGURE_RADIUS);
  for (let k = 0; k < n; k++) {
    const d = r * Math.sqrt((k + 0.5) / n);
    const a = k * 2.39996;
    out[2 * k] = d * Math.cos(a);
    out[2 * k + 1] = d * Math.sin(a) * CROWD_DEPTH;
  }
  return n;
}

/** Open-road spread: the drawn crowd is SPREAD_K × √army of the track wide, up to SPREAD_MAX_W (look only). */
const SPREAD_K = 0.05;
const SPREAD_MAX_W = 0.55;
/**
 * The crowd pulls in to its true width over this much track before anything
 * that can clip it, and spreads out again over SPREAD_OUT_DIST once its rear
 * is past (both counted from where the crowd's front, or rear, meets it).
 */
export const SQUEEZE_DIST = 0.8;
const SPREAD_OUT_DIST = 0.4;

/** How wide (track share) the crowd is drawn on open road: wider than `crowdWidth`, never narrower. */
export const spreadWidth = (army: number): number =>
  Math.max(
    crowdWidth(army),
    Math.min(SPREAD_MAX_W, SPREAD_K * Math.sqrt(Math.max(0, army))),
  );

/** How far (track distance) the crowd reaches ahead of and behind its centre. */
export const crowdHalfDepth = (army: number): number =>
  ((crowdWidth(army) * TRACK_W) / 2) * (CROWD_DEPTH / DIST_SCALE);

const smooth = (t: number): number => {
  const u = Math.min(1, Math.max(0, t));
  return u * u * (3 - 2 * u);
};

/**
 * How spread out (0 = squeezed to `crowdWidth`, 1 = `spreadWidth`) the crowd
 * is, with the nearest thing that can clip it `ahead` and `behind` of its
 * centre (track distance, Infinity for none). Fully squeezed while an
 * obstacle is within the crowd's depth; continuous in both distances.
 */
export function spreadShare(
  army: number,
  ahead: number,
  behind: number,
): number {
  const hold = crowdHalfDepth(army);
  return Math.min(
    smooth((ahead - hold) / SQUEEZE_DIST),
    smooth((behind - hold) / SPREAD_OUT_DIST),
  );
}

/** The drawn crowd's width (track share) with the nearest clipping obstacle `ahead` and `behind`. */
export function drawnWidth(
  army: number,
  ahead: number,
  behind: number,
): number {
  const cw = crowdWidth(army);
  return cw + (spreadWidth(army) - cw) * spreadShare(army, ahead, behind);
}

/** Half the spread of figure centres (world units) in a crowd `width` (track share) wide. */
const layoutHalf = (width: number): number =>
  Math.max(0, (width * TRACK_W) / 2 - FIGURE_RADIUS);

/** Sideways stretch of `crowdLayout` that draws the crowd `width` wide (1 at `crowdWidth`). */
export function spreadScale(army: number, width: number): number {
  const base = layoutHalf(crowdWidth(army));
  return base > 0 ? layoutHalf(width) / base : 1;
}

/** Width (track share) of a crowd whose layout is stretched sideways by `scale`. */
export const scaledWidth = (army: number, scale: number): number =>
  ((layoutHalf(crowdWidth(army)) * scale + FIGURE_RADIUS) * 2) / TRACK_W;

/** Where (track x) a crowd `width` wide is drawn for an army centred at `x`: kept on the track. */
export const drawnCentre = (x: number, width: number): number =>
  Math.min(1 - width / 2, Math.max(width / 2, x));

/**
 * Track distance from the army to the nearest thing that would clip it
 * ahead and behind. Every wall row counts (charges too). A hazard counts only
 * while it is still standing (a shattered crate or a dead pack does not) and
 * its span overlaps where the crowd is drawn when spread (`spreadWidth`, centred
 * by `drawnCentre`). That test ignores the current squeeze, so squeezing never
 * feeds back into it, and whatever the sim clips always overlaps it.
 * A saw is tested where it will be when the crowd reaches it (`hazardSpan` at
 * its own position, which is exactly what the sim clips with), not its
 * sweep: it stays steady as it swings and still never lies at contact.
 */
export function clipGaps(run: RunState): { ahead: number; behind: number } {
  let ahead = Infinity;
  let behind = Infinity;
  const near = (pos: number): void => {
    const d = pos - run.dist;
    if (d >= 0) ahead = Math.min(ahead, d);
    else behind = Math.min(behind, -d);
  };
  const sw = spreadWidth(run.army);
  const c = drawnCentre(run.x, sw);
  const left = c - sw / 2;
  const right = c + sw / 2;
  for (const q of run.track.questions) near(q);
  run.track.hazards.forEach((h, i) => {
    const span =
      h.kind === "saw"
        ? hazardSpan(h, h.pos)
        : h.kind === "pack"
          ? // a pack closes onto the army: in its path until it is shot out (one that streamed in met it)
            packSurvivors(run, i) || (run.arrived[i] ?? 0) > 0
            ? { left, right }
            : null
          : isShattered(run, i)
            ? null
            : { left: h.left, right: h.right };
    if (span && span.right > left && span.left < right) near(hazardPos(run, i));
  });
  return { ahead, behind };
}

/** Most the spread share may change per second: out towards open road, and in towards a squeeze. */
const SHARE_OUT_RATE = 2.5;
const SHARE_IN_RATE = 8;

/**
 * One frame of the spread share (0 squeezed .. 1 spread), `prev` last frame.
 * The geometric target (`spreadShare`) is continuous in distance, but can jump
 * when something stops or starts counting (a crate shatters, the player
 * steers into or off a hazard). So the share follows the target with a limit
 * on its speed: a normal approach is tracked exactly (the squeeze rate is
 * above the target's steepest slope at running speed), a sudden change is
 * spread over a fraction of a second. On top, it never exceeds the geometric
 * cap of the last quarter of the squeeze distance, which is 0 when the
 * obstacle is within the crowd's depth: a sudden squeeze can lag, but never
 * arrives late, so at contact the width is exactly `crowdWidth`.
 */
export function stepShare(
  prev: number,
  army: number,
  ahead: number,
  behind: number,
  dt: number,
): number {
  const target = spreadShare(army, ahead, behind);
  const eased = Math.min(
    prev + SHARE_OUT_RATE * dt,
    Math.max(target, prev - SHARE_IN_RATE * dt),
  );
  const hold = crowdHalfDepth(army);
  const cap = Math.min(
    smooth((ahead - hold) / (SQUEEZE_DIST / 4)),
    smooth((behind - hold) / (SPREAD_OUT_DIST / 4)),
  );
  return Math.min(eased, cap);
}
