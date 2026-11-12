import { bossSize, bossWon, clashAt } from "../../core/boss";
import { crowdWidth } from "../../core/crowd";
import {
  hazardPos,
  plannedRows,
  speedMul,
  isShattered,
  packSpan,
  packSurvivors,
  type ChargeView,
  type RunState,
  type SquadView,
} from "../../core/sim";
import { hazardSpan, type Saw, type Track } from "../../core/track";
import {
  BASE_SPEED,
  CLASH_APPROACH_SECONDS,
  CLASH_HOLD_SECONDS,
  CLASH_SECONDS,
  SAW_W,
  VIEW_DISTANCE,
} from "../../core/tuning";
import type { GateRow } from "../../core/types";

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
/**
 * The shape horizon (track distance ahead of the army): solid objects are
 * drawn up to here, faint in the haze, and so is their text.
 * Must stay below the closest a re-ask can replace a row (tested).
 */
export const SHAPE_DISTANCE = 2 * VIEW_DISTANCE;
/** The distance haze colour (the fog's), as 0xrrggbb. */
export const HAZE_COLOUR = 0xd4eeff;
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

/** Open-road spread: the drawn crowd is SPREAD_K × √army of the track wide, up to SPREAD_MAX_W (look only). */
export const SPREAD_K = 0.05;
export const SPREAD_MAX_W = 0.55;
/**
 * The crowd pulls in to its true width over this much track before anything
 * that can clip it, and spreads out again over SPREAD_OUT_DIST once its rear
 * is past (both counted from where the crowd's front, or rear, meets it).
 */
export const SQUEEZE_DIST = 0.8;
export const SPREAD_OUT_DIST = 0.4;

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
        : isShattered(run, i) || (h.kind === "pack" && !packSurvivors(run, i))
          ? null
          : h.kind === "pack"
            ? packSpan(run, i)
            : { left: h.left, right: h.right };
    if (span && span.right > left && span.left < right) near(hazardPos(run, i));
  });
  return { ahead, behind };
}

/** Most the spread share may change per second: out towards open road, and in towards a squeeze. */
export const SHARE_OUT_RATE = 2.5;
export const SHARE_IN_RATE = 8;

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
 * Linear haze range (view depths): none up to VIEW_DISTANCE ahead, then
 * thickening steadily until it is total at SHAPE_DISTANCE for anything up to
 * FOG_TOP_H tall, so a shape crossing the shape horizon is already gone.
 */
export function fogRange(pose: CameraPose): { near: number; far: number } {
  const z = worldZ(SHAPE_DISTANCE, 0);
  return {
    near: viewDepth(pose, 0, worldZ(VIEW_DISTANCE, 0)),
    far: Math.min(viewDepth(pose, 0, z), viewDepth(pose, FOG_TOP_H, z)),
  };
}

/** How much haze (0 none .. 1 total) linear fog `range` puts at view depth `depth`. */
export function hazeAt(
  range: { near: number; far: number },
  depth: number,
): number {
  const t = (depth - range.near) / (range.far - range.near);
  return Math.min(1, Math.max(0, t));
}

/** Haze (0 none .. 1 total) at a track point `dist` ahead of the army (as in `Projector`), `height` up. */
export type Haze = (dist: number, height: number) => number;

/** The haze at track points for a camera `pose` with the army at `runDist`: what the fog gives the scene. */
export function hazeFor(pose: CameraPose, runDist: number): Haze {
  const range = fogRange(pose);
  return (dist, height) =>
    hazeAt(range, viewDepth(pose, height, worldZ(dist, runDist)));
}

/** A posed camera and its vertical field of view (degrees). */
export type CameraFit = { pose: CameraPose; fov: number };

/** Where the camera is asked to put things, as shares of the screen height from the top. */
export type CameraAim = {
  /** The army (track centre at the army). */
  armyY: number;
  /** The far line: track centre at SHAPE_DISTANCE ahead, where the haze is total. */
  farY: number;
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
 * army that put the army at `aim.armyY` and the far line at `aim.farY`.
 */
export function aimCamera(
  height: number,
  back: number,
  aim: CameraAim,
): CameraFit {
  const va = 1 - 2 * aim.armyY;
  const vf = 1 - 2 * aim.farY;
  // depression angles of the army and of the far line
  const da = Math.atan2(height, back);
  const df = Math.atan2(height, back - worldZ(SHAPE_DISTANCE, 0));
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
 * The camera for a screen of this aspect: `height` up and `back` behind the
 * army, aimed per `aimCamera`. When both track edges (plus `margin`, up to a
 * wall's top) don't fit at the army, it moves farther back along the same
 * slope, with a narrower field of view, rather than going steeper.
 */
export function fitCameraTo(
  aspect: number,
  back: number,
  height: number,
  aim: CameraAim,
  margin: number,
): CameraFit {
  const edge = (TRACK_W / 2) * margin;
  const fits = (fit: CameraFit): boolean =>
    screenAt(fit, aspect, edge, 0, 0).x <= 1 &&
    screenAt(fit, aspect, edge, WALL_H, 0).x <= 1;
  const near = aimCamera(height, back, aim);
  if (fits(near)) return near;
  let lo = 1;
  let hi = 16;
  for (let k = 0; k < 40; k++) {
    const s = (lo + hi) / 2;
    if (fits(aimCamera(height * s, back * s, aim))) hi = s;
    else lo = s;
  }
  return aimCamera(height * hi, back * hi, aim);
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

/** A crate's height and depth (world units); its near face stands at its distance. */
export const CRATE_H = 1.5;
export const CRATE_D = 1.2;
/** Crate and pack burst length (track distance); recruits and their "+N" last CRATE_POPUP_DIST. */
export const SHATTER_DIST = 0.6;
export const CRATE_POPUP_DIST = 0.8;
/** Most recruits drawn running in from a shattered crate. */
export const MAX_RECRUITS = 12;
/** Pieces in a burst. */
export const BURST_PIECES = 14;

/** A track span (x left..right) as a centre and width in world units. */
export function spanWorld(
  left: number,
  right: number,
): { x: number; w: number } {
  return { x: worldX((left + right) / 2), w: (right - left) * TRACK_W };
}

/** A saw's disc centre and radius now, and its rail's centre and length, in world X. */
export function sawPlace(
  h: Saw,
  dist: number,
): { x: number; r: number; railX: number; railW: number } {
  const span = hazardSpan(h, dist);
  return {
    x: worldX((span.left + span.right) / 2),
    r: (SAW_W * TRACK_W) / 2,
    railX: worldX(h.mid),
    railW: (2 * h.amp + SAW_W) * TRACK_W,
  };
}

/**
 * Piece k of a burst `t` (0..1) of the way through, as an offset from the
 * burst's centre (world units) and a size: flung outwards over `spread`,
 * rising then falling, shrinking away.
 */
export function burstPiece(
  k: number,
  t: number,
  spread: number,
): { x: number; y: number; z: number; size: number } {
  const a = k * 2.39996;
  const r = (spread + 2.5 * t) * (0.4 + (0.6 * ((k * 7) % 5)) / 4);
  const up = 1.6 + 0.3 * (k % 3);
  return {
    x: r * Math.cos(a) * t,
    y: up * t - 2.6 * t * t,
    z: r * Math.sin(a) * t,
    size: 0.22 * (1 - t) + 0.05,
  };
}

/** How far (0..1) recruit k of n has run from a shattered crate into the crowd, `t` through its pop-up: staggered. */
export const recruitProgress = (k: number, n: number, t: number): number =>
  Math.min(1, Math.max(0, (t * 1.6 - k / (n * 2)) / 0.8));

/**
 * Scale (0..1) of figure k in a pack with `left` enemies' worth of hit points
 * left: whole figures stand, the last one shrinks as it takes damage, the
 * rest are gone.
 */
export function packFigureScale(k: number, left: number): number {
  if (k + 1 <= left) return 1;
  if (k >= left) return 0;
  return 0.4 + 0.6 * (left - k);
}

/**
 * The giant boss: one enemy figure this many times a soldier's size (fixed,
 * whatever its HP), standing on the track's centre past the last question.
 */
export const BOSS_SCALE = 5.5;
/** The boss's height (world units): the top of its head. */
export const BOSS_TOP = FIGURE_TOP * BOSS_SCALE;
/** Track distance from the army's firing stop to the boss. */
export const BOSS_RANGE = 1.1;
/** Haze reaches the boss's top this far beyond SHAPE_DISTANCE (it is taller than FOG_TOP_H): it is drawn from here in. */
export const BOSS_SHOWN = SHAPE_DISTANCE + 1;

/** Where the army stops to fire and where the boss stands (track distances). */
export type BossPlace = { stop: number; boss: number };

/**
 * The firing stop is past the last question by the distance the army covers
 * in CLASH_APPROACH_SECONDS at the run's final speed (`pace` is the speed
 * preset); the boss stands BOSS_RANGE beyond it.
 */
export function bossPlace(track: Track, pace = 1): BossPlace {
  const last = track.questions.at(-1) ?? 0;
  const speed = BASE_SPEED * pace * speedMul(last, track);
  const stop = last + speed * CLASH_APPROACH_SECONDS;
  return { stop, boss: stop + BOSS_RANGE };
}

/**
 * Where the army is drawn `t` seconds into the boss scene: running on at the
 * final speed from where the run ended (`runDist`), until the firing stop.
 */
export function bossArmyDist(
  runDist: number,
  track: Track,
  pace: number,
  t: number,
): number {
  const { stop } = bossPlace(track, pace);
  const last = track.questions.at(-1) ?? 0;
  const speed = BASE_SPEED * pace * speedMul(last, track);
  return Math.min(Math.max(runDist, stop), runDist + speed * Math.max(0, t));
}

/** How the fight ends in 3D: Victory topples the boss, Defeated stomps it forward, a Tie leaves it standing. */
export type BossEnding = "topple" | "stomp" | "stand";

/** What is shown `t` seconds into the boss scene. */
export type BossFight = {
  /** Soldiers and boss HP left, per `clashAt`. */
  army: number;
  hp: number;
  /** Both sides are shooting. */
  firing: boolean;
  /** Set once the clash is over, with how far (0..1) into CLASH_HOLD_SECONDS. */
  ending: { kind: BossEnding; u: number } | null;
};

/**
 * The gunfight `t` seconds into the boss scene, for an army of `army`
 * against a boss of `hp`: nobody fires during the approach, then each
 * soldier lost takes 1 HP per `clashAt`; the ending plays over the hold.
 */
export function bossFightAt(army: number, hp: number, t: number): BossFight {
  const c = clashAt(army, hp, t - CLASH_APPROACH_SECONDS);
  const kind: BossEnding = bossWon(army, hp)
    ? "topple"
    : army === hp
      ? "stand"
      : "stomp";
  const after = t - CLASH_APPROACH_SECONDS - CLASH_SECONDS;
  return {
    army: c.army,
    hp: c.boss,
    firing: t >= CLASH_APPROACH_SECONDS && !c.done,
    ending: c.done
      ? { kind, u: Math.min(1, Math.max(0, after / CLASH_HOLD_SECONDS)) }
      : null,
  };
}

let hpMemo: { rows: readonly GateRow[]; seed: number; hp: number } | null =
  null;

/** The boss's HP for this run: its size, as the boss scene will have it (computed once per run). */
export function bossHp(run: RunState, seed: number): number {
  const rows = plannedRows(run);
  if (hpMemo?.rows !== rows || hpMemo.seed !== seed)
    hpMemo = { rows, seed, hp: bossSize(rows, run.track.charges, seed) };
  return hpMemo.hp;
}

/** What the overlay needs of the boss: its head top (track distance, height), HP, and where the army is drawn. */
export type BossView = {
  dist: number;
  height: number;
  hp: number;
  size: number;
  /** The army's drawn track distance (it runs on past the run's end to the firing stop). */
  armyDist: number;
  /** Opacity of its HP (fades as it topples). */
  alpha: number;
};
