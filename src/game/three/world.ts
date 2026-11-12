import { crowdWidth } from "../../core/crowd";
import type { ChargeView, SquadView } from "../../core/sim";
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

/** A wall's height and thickness (world units); its near face stands at the row's distance. */
export const WALL_H = 2;
export const WALL_T = 0.4;
/** Rows stay drawn until this far (track distance) behind the army: past the camera. */
export const WALL_BEHIND = 2;
/** How far (track distance) beyond its wall a charge's squads stand. */
export const SQUAD_BEYOND = 0.45;
/** How far (track distance) the squad run into steps back as the firefight starts. */
export const SQUAD_STEP_BACK = 0.25;
/** Answer labels and prompts are this many times the projected wall height. */
export const LABEL_K = 0.55;
export const PROMPT_K = 0.8;

/** How long (in track distance) a charge's firefight plays after contact. */
export const FIREFIGHT_DIST = 1.2;
/** Fraction of the firefight both sides fire before the chosen squad's outcome shows. */
export const FIREFIGHT_REVEAL = 0.2;
/** How long (in track distance) the squads not run into take to fall back after contact. */
export const SQUAD_FADE_DIST = 0.3;
/** How far (in track distance) past a wall its answer labels take to fade out. */
export const PASSED_LABEL_FADE_DIST = 0.15;

/** How far through its firefight a charge is: 0 at contact, 1 when it ends. */
export function firefightProgress(
  runDist: number,
  contactDist: number,
): number {
  const t = (runDist - contactDist) / FIREFIGHT_DIST;
  return Math.min(1, Math.max(0, t));
}

/**
 * Where (track distance) a charge's squads stand: SQUAD_BEYOND past the
 * wall at `wallPos`. With `fight` (its firefight progress) the squad run into
 * keeps ahead of the army, stepping back SQUAD_STEP_BACK as the fight starts.
 */
export function squadDist(
  wallPos: number,
  runDist: number,
  fight: number | null,
): number {
  if (fight === null) return wallPos + SQUAD_BEYOND;
  const back = SQUAD_STEP_BACK * Math.min(1, fight / 0.15);
  return Math.max(wallPos, runDist) + SQUAD_BEYOND + back;
}

/**
 * How much of an object `ahead` track distance in front of the army shows
 * through the fog, for overlay text on it: 1 up to where the fog starts,
 * 0 from VIEW_DISTANCE on.
 */
export function fogAlpha(ahead: number): number {
  const t = (VIEW_DISTANCE - ahead) / ((1 - FOG_START) * VIEW_DISTANCE);
  return Math.min(1, Math.max(0, t));
}

/**
 * A pure projector for a camera fit on a `w` × `h` screen with the army at
 * `runDist`: the same placement the live camera gives (for tests and sizing).
 */
export function projectorFor(
  fit: CameraFit,
  w: number,
  h: number,
  runDist: number,
): Projector {
  return (x, dist, height) => {
    const z = worldZ(dist, runDist);
    if (viewDepth(fit.pose, height, z) <= 0) return null;
    const p = screenAt(fit, w / h, worldX(x), height, z);
    return { x: p.x * w, y: p.y * h };
  };
}

/** Projected height (px) of a wall at track distance `dist`, at track x `x`; 0 when off camera. */
export function wallPx(project: Projector, x: number, dist: number): number {
  const foot = project(x, dist, 0);
  const top = project(x, dist, WALL_H);
  return foot && top ? Math.max(0, foot.y - top.y) : 0;
}

/** Height (world units) of a figure's head top: counts sit above it. */
export const FIGURE_TOP = 0.8;

/** Where and how a charge's squad is drawn this frame. */
export type SquadPlace = {
  x: number;
  dist: number;
  /** Figures still standing (a fighting squad is shot down). */
  standing: number;
  /** Firefight progress after the reveal (0..1), for figures dropping. */
  u: number;
  /** The squad turned friendly and is running into the army. */
  friendly: boolean;
  /** How far it has merged into the army (0..1, friendly only). */
  merge: number;
  /** 1 while it stands; falls to 0 as a squad not run into falls back. */
  shown: number;
  /** The outcome, once revealed, for its tag. */
  tag: "join" | "fight" | null;
  /** Firefight progress (0..1) while the fight plays, else null. */
  fight: number | null;
};

/**
 * A charge's squad this frame, from the view model only: standing beyond its
 * opening; once run into, the firefight (it steps back, both sides fire, then
 * it joins the army or is shot down); the others fall back. Null when gone.
 */
export function squadPlace(
  runDist: number,
  runX: number,
  c: ChargeView,
  q: SquadView,
): SquadPlace | null {
  const still = {
    x: q.x,
    standing: q.count,
    u: 0,
    friendly: false,
    merge: 0,
    tag: null,
    fight: null,
  };
  if (!q.chosen) {
    const shown = c.resolved
      ? 1 - Math.min(1, Math.max(0, (runDist - c.pos) / SQUAD_FADE_DIST))
      : 1;
    if (shown <= 0) return null;
    return { ...still, dist: squadDist(c.pos, runDist, null), shown };
  }
  if (c.contactDist === null || runDist - c.contactDist >= FIREFIGHT_DIST)
    return null;
  const t = firefightProgress(runDist, c.contactDist);
  const revealed = t >= FIREFIGHT_REVEAL;
  const u = revealed ? (t - FIREFIGHT_REVEAL) / (1 - FIREFIGHT_REVEAL) : 0;
  const home = squadDist(c.pos, runDist, t);
  const tag = revealed ? q.outcome : null;
  if (tag === "join") {
    const k = Math.min(1, u * 1.4);
    return {
      ...still,
      x: q.x + (runX - q.x) * k,
      dist: home + (runDist - home) * k,
      u,
      friendly: true,
      merge: k,
      shown: 1,
      tag,
      fight: t,
    };
  }
  const standing = tag === "fight" ? Math.round(q.count * (1 - u)) : q.count;
  return { ...still, dist: home, standing, u, shown: 1, tag, fight: t };
}
