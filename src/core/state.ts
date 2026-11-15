import type { FireShare } from "./fire";
import type { Opening } from "./gates";
import type { ReaskConfig } from "./reask";
import type { Track } from "./track";
import type { HordeTuning } from "./tuning";
import type { GateRow, ReaskLink } from "./types";

/**
 * A moving enemy pack: its stream's head (track position) and its crowd's
 * centre; once awake, its stream across the track (see TRACK_SPEED):
 * `streamX` its centre, `aimX` where it is heading (the army's x, lagged by
 * TRACK_DELAY), `streamW` its width where it meets the army's line. A pack
 * without them (tests) is a stream as wide as the army at its mouth's centre.
 */
type PackState = {
  pos: number;
  x: number;
  streamX?: number;
  aimX?: number;
  streamW?: number;
};

/**
 * Re-asks in this run (WaniKani mode): the config it was built with, the
 * entry each row asks now, and the links placed so far. Fits `ReaskRecord`.
 */
type ReaskState = ReaskConfig & {
  links: readonly ReaskLink[];
  /** The rows as built at the start, before any re-ask. */
  planned: readonly GateRow[];
};

type RunStatus = "running" | "finished" | "dead";

export type RunState = {
  rows: GateRow[];
  /** Where the questions and hazards are. */
  track: Track;
  /** Distance the army has travelled. */
  dist: number;
  /** Index of the next unresolved row. */
  next: number;
  /** Index of the next hazard not yet passed. */
  nextHazard: number;
  /** Crowd centre, 0 (left edge) to 1 (right edge). */
  x: number;
  /** Where steering input wants the crowd to be. */
  targetX: number;
  army: number;
  streak: number;
  /** The run's longest streak of correct answers (re-asks count like any gate). */
  bestStreak: number;
  /** Per resolved row: was it answered correctly. */
  results: boolean[];
  /** Hit points per hazard (0 = can't be shot). */
  hp: number[];
  /** Enemies per hazard at the start (packCount for packs, 0 otherwise); each has hp / heads. */
  heads: number[];
  /** Damage dealt so far per hazard (fire and melee); a block is shattered once this reaches its hp. */
  damage: number[];
  /** Per hazard: a pack's enemies that have reached the army's front so far (fractional, a running total). */
  arrived: number[];
  /**
   * Per hazard: how far into a pack's column, counted from its front (the
   * dead too), its enemies have reached the army's front (fractional). It
   * dies from the front, so those still alive up to here fight there now
   * (packMelee; see MELEE_RATE).
   */
  front: number[];
  /** Per hazard: a pack's enemies that reached the army's line beside it and ran past (fractional; gone, no contact). */
  missed: number[];
  /** Per hazard: soldiers its melee has cost so far (fractional; whole soldiers are lost as it rises). */
  meleeLoss: number[];
  /** Per hazard: whether its numbers are settled (a pack is sized for the army when it wakes: see wakePacks). */
  woke: boolean[];
  /** Per hazard: where its enemy pack is now (null for blocks and saws). */
  packs: (PackState | null)[];
  /** Hazards fired at this step, by index, each with its share of the army's fire (fire by lane: see splitFire). */
  targets: FireShare[];
  /** The one of `targets` taking the most fire (the nearest on a tie), if any. */
  target: number | null;
  /** Per row: its wall's openings as they are now (shooting one grows it). */
  gates: Opening[][];
  /** Opening of the next row's wall being shot (grown) this step, if any. */
  gateTarget: number | null;
  /** Share of the army's fire with no threat ahead this step (it goes to the next wall when in range). */
  gateShare: number;
  /** Most recent shattered block and the distance it happened at, for feedback. */
  lastShatter: { index: number; dist: number } | null;
  /** Most recent crate payout (recruits from a shattered block) and the distance it happened at, for feedback. */
  lastCrate: { gain: number; dist: number } | null;
  /** Most recent clipping loss and the distance it happened at, for feedback. */
  lastClip: { loss: number; dist: number } | null;
  /** Most recent answer, for feedback: the opening chosen and the army change it caused (after clipping). */
  lastAnswer: {
    correct: boolean;
    choice: number;
    change: number;
    dist: number;
  } | null;
  status: RunStatus;
  /** Re-asks, when the run has them on; else null. */
  reask: ReaskState | null;
  /** The horde tuning this run was built with (the view reads its figure size). */
  horde: HordeTuning;
};

/**
 * Fire never reaches past the next unresolved question's wall (a charge's
 * too), so nothing beyond it can be hit (or revealed).
 */
export function fireLimit(s: RunState): number {
  return s.track.questions[s.next] ?? Infinity;
}

/** Keeps a crowd of width w fully on the track. */
export const clampOnTrack = (v: number, w: number): number =>
  Math.min(1 - w / 2, Math.max(w / 2, v));
