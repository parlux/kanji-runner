import { type ChargeView, type SquadView } from "../../core/sim";
import { type Projector, worldX, worldZ } from "./world";
import { viewDepth, type CameraFit, screenAt } from "./camera";

/** A wall's height and thickness (world units); its near face stands at the row's distance. */
export const WALL_H = 2;
export const WALL_T = 0.4;
/** Rows stay drawn until this far (track distance) behind the army: past the camera. */
export const WALL_BEHIND = 2;
/** How far (track distance) beyond its wall a charge's squads stand. */
export const SQUAD_BEYOND = 0.45;
/** How far (track distance) the squad run into steps back as the firefight starts. */
const SQUAD_STEP_BACK = 0.25;
/** Answer labels and prompts are this many times the projected wall height. */
export const LABEL_K = 0.55;
export const PROMPT_K = 0.8;

/** How long (in track distance) a charge's firefight plays after contact. */
export const FIREFIGHT_DIST = 1.2;
/** Fraction of the firefight both sides fire before the chosen squad's outcome shows. */
const FIREFIGHT_REVEAL = 0.2;
/** How long (in track distance) the squads not run into take to fall back after contact. */
const SQUAD_FADE_DIST = 0.3;
/** How far (in track distance) past a wall its answer labels take to fade out. */
export const PASSED_LABEL_FADE_DIST = 0.15;

/** How far through its firefight a charge is: 0 at contact, 1 when it ends. */
function firefightProgress(runDist: number, contactDist: number): number {
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
