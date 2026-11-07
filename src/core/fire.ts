import type { Span } from "./crowd";
import { applyCorrect, applyWrong } from "./scoring";
import type { Hazard, Track } from "./track";
import {
  BASE_REWARD,
  BLOCK_HP_K,
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

/** Hit points per hazard: BLOCK_HP_K × expected army after the questions before it. Saws get 0 (unshootable). */
export function blockHp(track: Track, expected: readonly number[]): number[] {
  return track.hazards.map((h) => {
    if (h.kind !== "block") return 0;
    const q = track.questions.filter((p) => p < h.pos).length;
    return BLOCK_HP_K * (expected[Math.min(q, expected.length - 1)] ?? 0);
  });
}

/**
 * Index of the nearest shootable hazard at or after `from`, ahead of `dist`
 * within FIRE_RANGE, whose span overlaps the crowd's. Null if none.
 */
export function pickTarget(
  hazards: readonly Hazard[],
  from: number,
  dist: number,
  crowd: Span,
  shootable: (i: number) => boolean,
): number | null {
  for (let i = from; i < hazards.length; i++) {
    const h = hazards[i] as Hazard;
    if (h.pos - dist > FIRE_RANGE) return null;
    if (h.pos < dist || h.kind !== "block" || !shootable(i)) continue;
    if (Math.min(crowd.right, h.right) - Math.max(crowd.left, h.left) > 0)
      return i;
  }
  return null;
}
