import { ENEMY_SPEED, TRACK_SPEED } from "../../core/tuning";
import { TRACK_W, DIST_SCALE, FIGURE_RADIUS } from "./world";

/** Most figures drawn per pack (the count slider's top): the horde mesh is sized for this once. */
export const HORDE_CAP = 20_000;
/** How far each crowd figure stands off its lattice place, in crowd gaps (each way). */
export const HORDE_JITTER = 0.15;
/**
 * Each column of a waiting crowd stands back 0 to this many whole rows
 * (its own random pick, keeping the staggered lattice, so no two figures
 * come closer), so neither its front nor its back is a straight line
 * (owner at M2: "a loose crowd, not a block").
 */
export const HORDE_RAG = 2;
/**
 * How far a waiting figure wanders from its place, in crowd gaps (each way,
 * at most twice this): 0.12, from 0.2 before the owner's "a bit manic"
 * (horde round 1).
 */
export const HORDE_WANDER = 0.12;
/** Its wander's pace, a share of the H5b pace (calmer: half as fast). */
export const HORDE_WANDER_RATE = 0.5;
/** A waiting figure turns about now and then, this far each way (radians; 1.4 before)... */
export const HORDE_TURN = 0.8;
/** ...this slowly (radians per second, times 0.5 to 1.5; 0.3 before). */
export const HORDE_TURN_RATE = 0.15;
/**
 * Every figure strides this many times a second, waiting or running (a
 * small shuffle while it waits); before, the rate changed as it set off,
 * which sped its legs up wildly for a moment.
 */
export const HORDE_STRIDE_HZ = 2.2;
/** A figure that leaves the crowd breaks into a run over this much running (world units)... */
export const STREAM_TURN = 6;
/** ...and, within this far of the army (world units), runs on into its front rows (the core meets it at its centre). */
export const STREAM_CRASH = 25;
/**
 * Within this far (world units) of the melee's back (the army's front rows
 * when there is none), the share of the stream that meets the army comes
 * onto its lane (the melee's, on the army); the stream runs in its own lane
 * (the core's, tracking the army late) until then.
 */
export const STREAM_MEET = 3;
/**
 * A figure leaving the crowd comes across into its lane no faster than the
 * core's stream (TRACK_SPEED): at most this far sideways per world unit it
 * has run over the ground (TRACK_SPEED × TRACK_W / (ENEMY_SPEED × DIST_SCALE)),
 * so a pack woken close never snaps into line (owner, round 2, wave 6).
 */
export const STREAM_ACROSS =
  (TRACK_SPEED * TRACK_W) / (ENEMY_SPEED * DIST_SCALE);
/** Enemies that won jump this many times a second (times 0.85 to 1.15, each its own)... */
export const CHEER_HOPS = 2.2;
/** ...this high (world units, times their size). */
export const CHEER_JUMP = 0.6;
/**
 * ...and spread out across the track, this wide (world units, about half the
 * track) over their first CHEER_SPREAD_SECONDS: each moves out from its lane's
 * centre (never in, and never past CHEER_WIDTH / 2 unless it already stood
 * further out), as far as it had come into its lane: the melee and the
 * stream spread, the crowd still waiting stands where it is. The cheer
 * starts from where every figure stands.
 */
export const CHEER_WIDTH = 5;
export const CHEER_SPREAD_SECONDS = 0.8;

/**
 * Where a cheering figure stands across the track: `x` as it stood, `laneC`
 * and `laneW` its lane's centre and width, `t` how far (0..1) it had come
 * across into it, `cheer` seconds since the enemies won (−1 before: x as it
 * is). The horde shader does the same.
 */
export function cheerX(
  x: number,
  laneC: number,
  laneW: number,
  t: number,
  cheer: number,
): number {
  if (cheer < 0) return x;
  const wide = Math.max(1, CHEER_WIDTH / Math.max(laneW, 0.1));
  const u = Math.min(1, cheer / CHEER_SPREAD_SECONDS);
  const d = Math.abs(x - laneC);
  const out = Math.min(d * wide, Math.max(d, CHEER_WIDTH / 2));
  return (
    laneC + Math.sign(x - laneC) * (d + (out - d) * t * u * u * (3 - 2 * u))
  );
}
/** An enemy that ran past the army runs on this far (run distance, track units) before it is gone off the screen behind. */
export const RUN_PAST_DIST = 2;
/** Enemies in a melee stand this many figure radii apart, packed against the army's front across its width. */
const MELEE_GAP = 2.3;
/** A fighting figure lunges at the army and back this far (world units, times its size)... */
export const MELEE_LUNGE = 0.07;
/** ...this many times a second. */
export const MELEE_HZ = 1.6;

/**
 * The melee's step (world units per figure): figures MELEE_GAP radii
 * apart, as many to a row as fit across the lane (`laneW` wide), so the
 * melee is a press of rows against the army's front that grows as the
 * stream feeds it and shrinks as it dies.
 */
export function meleeStep(laneW: number, size: number): number {
  const g = MELEE_GAP * FIGURE_RADIUS * size;
  return (g * g) / Math.max(g, laneW - 2 * FIGURE_RADIUS * size);
}

/**
 * One pack's drawing state (world units, the army at Z = 0; the uniforms the
 * horde shader gets): the stream's lane (`laneX`, `laneW`: the army's width,
 * on the army), the core's stream head at `headZ`; the crowd, its mouth's
 * left edge at `left`, `cols` across `gx` apart and rows `gz` apart from its
 * front, `run` back of the head (how far the head has run from it);
 * figures `size`, `n` alive of `n0`, the column's `step` per figure, `off`
 * the army's half depth, `clock` for the wander. `stride` walks a row's
 * columns in a scattered order. `melee` of the front figures fight at the
 * army's front, `band` apart (meleeStep), the stream behind them.
 * `closing`: how much faster the stream closes on the army than it runs
 * over the ground (the scroll on top of its own speed). The melee stands on
 * the army: `armyX`, `armyW`; `contact` (0..1) is the share of the stream
 * that meets it (the core's packContact), which comes onto the army's lane
 * within STREAM_MEET of its front.
 */
export type HordeLayout = {
  laneX: number;
  laneW: number;
  headZ: number;
  left: number;
  gx: number;
  gz: number;
  run: number;
  size: number;
  n: number;
  n0: number;
  cols: number;
  stride: number;
  step: number;
  off: number;
  clock: number;
  melee: number;
  band: number;
  closing: number;
  armyX: number;
  armyW: number;
  contact: number;
  /** Seconds since the enemies won (they cheer: cheerX), −1 before. */
  cheer: number;
};

/**
 * A figure's progress (0..1) along its run from the crowd to the army: `e`
 * world units run over the ground since it left, `rem` still to close
 * (army frame), `closing` the ratio of the two speeds. Linear in time.
 */
const streamProgress = (e: number, rem: number, closing: number): number =>
  e <= 0 ? 0 : (closing * e) / (Math.max(0, rem) + closing * e);

/** A stride through `cols` columns that visits each once: about 0.62 of them, coprime with `cols`. */
export function hordeStride(cols: number): number {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  let st = Math.max(1, Math.round(cols * 0.618));
  while (cols > 1 && gcd(st, cols) !== 1) st++;
  return st;
}

/** Offsets a column's hash (its ragged stand-back) from the figures'. */
export const COL_SALT = 0x9e37;

/** An integer hash (PCG) to 0..1; the horde shader has the same. */
function hordeHash(v: number): number {
  const s = (Math.imul(v >>> 0, 747796405) + 2891336453) >>> 0;
  const w = Math.imul((s >>> ((s >>> 28) + 4)) ^ s, 277803737) >>> 0;
  return (((w >>> 22) ^ w) >>> 0) / 4294967296;
}

/** Where figure k is: world X and Z (the army at 0), and `t`, how far (0..1) it has come across into its lane. */
export type HordeSpot = { x: number; z: number; t: number };

/**
 * Figure k's place (the horde shader does the same from its index). Its
 * crowd spot: row ⌊R / cols⌋ back from the crowd's front, R = n0 − 1 − k
 * (the highest index stands at the front), a scattered column in the row,
 * jittered and, while it waits, wandering. Its stream slot: its place
 * from the front j = n − 1 − k; the first `melee` stand pressed against the
 * army's front, `band` apart, lunging at it; the rest are the stream, `step`
 * apart behind them (the core's column, so the rest step up as the front
 * dies). It stands in the crowd while its slot is further back
 * than its spot; once the head has run far enough, it leaves the crowd and
 * runs in its slot, breaking into a run over STREAM_TURN and curving across
 * into its lane of the army-wide stream gradually over its whole run
 * (smoothstep of streamProgress: owner, "they line up in the lane super
 * fast"), on into the melee's back or the army's front rows.
 */
export function hordePlace(
  k: number,
  L: HordeLayout,
  out: HordeSpot = { x: 0, z: 0, t: 0 },
): HordeSpot {
  const R = L.n0 - 1 - k;
  const row = Math.floor(R / L.cols);
  const col = ((R % L.cols) * L.stride) % L.cols;
  const g = Math.min(L.gx, L.gz);
  const r1 = hordeHash(2 * k);
  const r2 = hordeHash(2 * k + 1);
  const ph1 = 6.2831853 * r2;
  const ph2 = 6.2831853 * r1;
  const wander = HORDE_WANDER * g;
  const wc = L.clock * HORDE_WANDER_RATE;
  const wx = wander * (Math.sin(wc * (0.5 + 0.6 * r1) + ph1) - Math.sin(ph1));
  const wz = wander * (Math.cos(wc * (0.4 + 0.5 * r2) + ph2) - Math.cos(ph2));
  // the column stands back whole rows, on the same staggered lattice
  const rag = Math.floor(hordeHash(col + COL_SALT) * (HORDE_RAG + 1));
  const rad = FIGURE_RADIUS * L.size;
  const right = L.left + L.cols * L.gx;
  const cx = Math.min(
    right - rad,
    Math.max(
      L.left + rad,
      L.left +
        (col + 0.5 + ((row + rag) % 2 === 1 ? 0.25 : -0.25)) * L.gx +
        HORDE_JITTER * g * (2 * r1 - 1) +
        wx,
    ),
  );
  const cz = HORDE_JITTER * g * (2 * r2 - 1) + wz + rag * L.gz;
  const spot = L.run + row * L.gz;
  const j = L.n - 1 - k;
  const pressed = Math.min(j, L.melee) * L.band;
  const slot = pressed + Math.max(0, j - L.melee) * L.step;
  const ahead = -L.headZ;
  const e = spot - slot;
  // it breaks into a run at once, and comes across into its lane gradually
  const form = e <= 0 ? 0 : Math.min(1, e / STREAM_TURN);
  const rem = ahead + slot - L.melee * L.band;
  const u = j < L.melee ? 1 : streamProgress(e, rem, L.closing);
  // its lane keeps its place across the crowd (a funnel: no crossing over)
  const across = Math.min(
    1,
    Math.max(
      0,
      (col + 0.5 + ((row + rag) % 2 === 1 ? 0.25 : -0.25) + 0.3 * (r1 - 0.5)) /
        L.cols,
    ),
  );
  // the melee stands on the army; the stream runs in its own lane, the share
  // that meets the army coming onto the army's lane just before its front
  const fighting = j < L.melee;
  const meet = fighting
    ? 1
    : L.contact * Math.min(1, Math.max(0, 1 - rem / STREAM_MEET));
  const laneC = L.laneX + (L.armyX - L.laneX) * meet;
  const laneW = L.laneW + (L.armyW - L.laneW) * meet;
  const lane = laneC + (across - 0.5) * Math.max(0, laneW - 2 * rad);
  // coming across no faster than the core's stream: its curve (a smoothstep,
  // steepest at 1.5 × the way across per unit of progress) stretched, when
  // it is short of time, so that it never comes across faster than
  // TRACK_SPEED; then it doesn't reach its lane in time (it runs past). A
  // fighting figure too: the core can count it in the melee while it still
  // stands in the crowd (the drawn melee reaches back past it); it stays
  // where it stands and doesn't snap into the melee's line (Task H5f)
  const reach = Math.abs(lane - cx);
  const v =
    reach < 1e-9
      ? u
      : Math.min(u, (STREAM_ACROSS * Math.max(0, e)) / (1.5 * reach));
  const t = v * v * (3 - 2 * v);
  // the stream runs on into the melee's back (the army's front rows when there is none)
  const crash = Math.min(
    1,
    Math.max(0, 1 - (ahead + slot - L.melee * L.band) / STREAM_CRASH),
  );
  // fighting: lunging at the army and back
  const lunge =
    j < L.melee
      ? MELEE_LUNGE *
        L.size *
        (1 - Math.cos(6.2831853 * (L.clock * MELEE_HZ * (0.8 + 0.4 * r1) + r2)))
      : 0;
  const back =
    e <= 0 ? spot + cz : slot + (1 - form) * cz + L.off * crash * form - lunge;
  out.x = cheerX(cx + (lane - cx) * t, laneC, laneW, t, L.cheer);
  out.z = L.headZ - back;
  out.t = t;
  return out;
}

/**
 * The giant boss: one enemy figure this many times a soldier's size (fixed,
 * whatever its HP), standing on the track's centre past the last question.
 */
