import { crowdWidth } from "../../core/crowd";
import { VIEW_DISTANCE } from "../../core/tuning";

/**
 * Pure maths for the 3D run: where the sim's track lands in the world, how a
 * crowd is laid out, and where the fog sits. No Three.js here.
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
/** Fog starts at this share of VIEW_DISTANCE ahead of the army. */
export const FOG_START = 0.7;
/** Tallest thing on the track (world units): fog hides it whole beyond VIEW_DISTANCE. */
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
/** World Z → track distance, with the army at `runDist`. */
export const trackDist = (wz: number, runDist: number): number =>
  runDist - wz / DIST_SCALE;

/** Figures drawn for an army of this size. */
export const drawnCount = (army: number): number =>
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

/** Where the camera sits and what it looks at, in world units (centred on the track). */
export type CameraPose = {
  height: number;
  back: number;
  lookAhead: number;
  lookHeight: number;
};

/** Depth of a point (on the track's centre plane) along the camera's view direction. */
export function viewDepth(pose: CameraPose, y: number, z: number): number {
  const fy = pose.lookHeight - pose.height;
  const fz = -pose.lookAhead - pose.back;
  const len = Math.hypot(fy, fz);
  return ((y - pose.height) * fy + (z - pose.back) * fz) / len;
}

/**
 * Linear fog range (view depths): it starts FOG_START × VIEW_DISTANCE ahead
 * and is total by VIEW_DISTANCE for anything up to FOG_TOP_H tall.
 */
export function fogRange(pose: CameraPose): { near: number; far: number } {
  const z = worldZ(VIEW_DISTANCE, 0);
  return {
    near: viewDepth(pose, 0, worldZ(FOG_START * VIEW_DISTANCE, 0)),
    far: Math.min(viewDepth(pose, 0, z), viewDepth(pose, FOG_TOP_H, z)),
  };
}

/** A posed camera and its vertical field of view (degrees). */
export type CameraFit = { pose: CameraPose; fov: number };

/** Where the camera is asked to put things, as shares of the screen height from the top. */
export type CameraAim = {
  /** The army (track centre at the army). */
  armyY: number;
  /** The fog line (track centre at VIEW_DISTANCE ahead). */
  fogY: number;
};

/** Screen position of a world point, as shares of the screen (0..1 from the left / top). */
export function screenAt(
  fit: CameraFit,
  aspect: number,
  x: number,
  y: number,
  z: number,
): { x: number; y: number } {
  const { pose } = fit;
  const pitch = Math.atan2(
    pose.height - pose.lookHeight,
    pose.back + pose.lookAhead,
  );
  const dy = y - pose.height;
  const dz = z - pose.back;
  const depth = -dy * Math.sin(pitch) - dz * Math.cos(pitch);
  const up = dy * Math.cos(pitch) - dz * Math.sin(pitch);
  const tanV = Math.tan((fit.fov * Math.PI) / 360);
  return {
    x: (1 + x / depth / (tanV * aspect)) / 2,
    y: (1 - up / depth / tanV) / 2,
  };
}

/**
 * Pitch and field of view for a camera `height` up and `back` behind the
 * army that put the army at `aim.armyY` and the fog line at `aim.fogY`.
 */
export function aimCamera(
  height: number,
  back: number,
  aim: CameraAim,
): CameraFit {
  const va = 1 - 2 * aim.armyY;
  const vf = 1 - 2 * aim.fogY;
  // depression angles of the army and of the fog line
  const da = Math.atan2(height, back);
  const df = Math.atan2(height, back - worldZ(VIEW_DISTANCE, 0));
  // tan(pitch − da) / tan(pitch − df) rises with pitch: bisect it to va / vf
  let lo = df;
  let hi = da;
  for (let k = 0; k < 60; k++) {
    const p = (lo + hi) / 2;
    if (Math.tan(p - da) / Math.tan(p - df) < va / vf) lo = p;
    else hi = p;
  }
  const pitch = (lo + hi) / 2;
  const tanV = Math.tan(pitch - da) / va;
  return {
    pose: {
      height,
      back,
      lookAhead: height / Math.tan(pitch) - back,
      lookHeight: 0,
    },
    fov: (2 * Math.atan(tanV) * 180) / Math.PI,
  };
}

/**
 * The camera for a screen of this aspect: aimed per `aimCamera`, at least
 * `minHeight` up, and raised (steeper) until both track edges, plus `margin`,
 * are in view at the army.
 */
export function fitCameraTo(
  aspect: number,
  back: number,
  minHeight: number,
  aim: CameraAim,
  margin: number,
): CameraFit {
  const fits = (fit: CameraFit): boolean =>
    screenAt(fit, aspect, (TRACK_W / 2) * margin, 0, 0).x <= 1;
  const low = aimCamera(minHeight, back, aim);
  if (fits(low)) return low;
  let lo = minHeight;
  let hi = minHeight * 8;
  for (let k = 0; k < 40; k++) {
    const h = (lo + hi) / 2;
    if (fits(aimCamera(h, back, aim))) hi = h;
    else lo = h;
  }
  return aimCamera(hi, back, aim);
}
