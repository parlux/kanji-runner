import type { Span } from "./crowd";
import { applyCorrect, applyWrong } from "./scoring";
import type { Track } from "./track";
import {
  BASE_REWARD,
  BLOCK_HP_K,
  ENEMY_HP,
  ENEMY_K,
  ENEMY_MIN,
  FIRE_PER_SOLDIER,
  FIRE_RANGE,
  STARTING_ARMY,
} from "./tuning";
import type { GateRow } from "./types";

/** Damage per second an army deals. */
export function firepower(army: number): number {
  return FIRE_PER_SOLDIER * army;
}

/**
 * Army after each question in a deterministic 80%-accuracy pass (every 5th
 * answer wrong, no clipping). Index q is the army after q answers; [0] is the start.
 */
export function expectedArmy(rows: readonly GateRow[]): number[] {
  const out = [STARTING_ARMY];
  let army = STARTING_ARMY;
  let streak = 0;
  rows.forEach((row, i) => {
    const r =
      (i + 1) % 5 === 0
        ? applyWrong(army)
        : applyCorrect(army, streak, BASE_REWARD[row.type]);
    army = r.army;
    streak = r.streak;
    out.push(army);
  });
  return out;
}

/** Enemies in a pack met when the expected army is `expected`. */
export function packStrength(expected: number): number {
  return Math.max(ENEMY_MIN, Math.round(ENEMY_K * expected));
}

/**
 * Hit points per hazard, from the expected army after the questions before it:
 * blocks BLOCK_HP_K × that, packs ENEMY_HP per enemy. Saws get 0 (unshootable).
 */
export function hazardHp(track: Track, expected: readonly number[]): number[] {
  return track.hazards.map((h) => {
    if (h.kind === "saw") return 0;
    const q = track.questions.filter((p) => p < h.pos).length;
    const e = expected[Math.min(q, expected.length - 1)] ?? 0;
    return h.kind === "block" ? BLOCK_HP_K * e : ENEMY_HP * packStrength(e);
  });
}

/** Where a shootable threat is now: its track position and its span across the track. */
export type Threat = { pos: number; span: Span };

/**
 * Index of the nearest threat at or after `from`, ahead of `dist` within
 * FIRE_RANGE, whose span overlaps the crowd's. Null entries can't be shot.
 */
export function pickTarget(
  threats: readonly (Threat | null)[],
  from: number,
  dist: number,
  crowd: Span,
): number | null {
  let best: number | null = null;
  let bestPos = Infinity;
  for (let i = from; i < threats.length; i++) {
    const t = threats[i];
    if (!t || t.pos < dist || t.pos - dist > FIRE_RANGE || t.pos >= bestPos)
      continue;
    const { left, right } = t.span;
    if (Math.min(crowd.right, right) - Math.max(crowd.left, left) > 0) {
      best = i;
      bestPos = t.pos;
    }
  }
  return best;
}
