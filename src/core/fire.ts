import type { Span } from "./crowd";
import {
  applyCorrect,
  applyCorrectCharge,
  applyWrong,
  applyWrongCharge,
} from "./scoring";
import type { Track } from "./track";
import {
  BASE_REWARD,
  BLOCK_HP_K,
  ENEMY_HP,
  ENEMY_K,
  ENEMY_MIN,
  HORDE_DEFAULTS,
  FIRE_PER_SOLDIER,
  FIRE_RANGE,
  STARTING_ARMY,
  type HordeTuning,
} from "./tuning";
import type { GateRow } from "./types";

/** Damage per second an army deals. */
export function firepower(army: number): number {
  return FIRE_PER_SOLDIER * army;
}

/**
 * Army after each question in a deterministic 80%-accuracy pass (every 5th
 * answer wrong, no clipping), scoring the questions in `charges` as squad
 * charges. Index q is the army after q answers; [0] is the start.
 */
export function expectedArmy(
  rows: readonly GateRow[],
  charges: readonly number[] = [],
): number[] {
  const out = [STARTING_ARMY];
  let army = STARTING_ARMY;
  let streak = 0;
  rows.forEach((row, i) => {
    const charge = charges.includes(i);
    const wrong = (i + 1) % 5 === 0;
    const base = BASE_REWARD[row.type];
    const r = charge
      ? wrong
        ? applyWrongCharge(army)
        : applyCorrectCharge(army, streak, base)
      : wrong
        ? applyWrong(army)
        : applyCorrect(army, streak, base);
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
 * Head count of a pack met when the expected army is `expected`: a horde of
 * weak enemies, clamp(round(hordeK × expected), ENEMY_MIN, packMax).
 */
export function packCount(
  expected: number,
  horde: HordeTuning = HORDE_DEFAULTS,
): number {
  return Math.min(
    horde.packMax,
    Math.max(ENEMY_MIN, Math.round(horde.hordeK * expected)),
  );
}

/** The expected army when hazard h is met: after the questions before it. */
function expectedAt(
  track: Track,
  expected: readonly number[],
  pos: number,
): number {
  const q = track.questions.filter((p) => p < pos).length;
  return expected[Math.min(q, expected.length - 1)] ?? 0;
}

/**
 * Hit points per hazard, from the expected army after the questions before it:
 * blocks BLOCK_HP_K × that, packs ENEMY_HP per enemy. Saws get 0 (unshootable).
 */
export function hazardHp(track: Track, expected: readonly number[]): number[] {
  return track.hazards.map((h) => {
    if (h.kind === "saw") return 0;
    const e = expectedAt(track, expected, h.pos);
    return h.kind === "block" ? BLOCK_HP_K * e : ENEMY_HP * packStrength(e);
  });
}

/** Enemies per hazard at the start: packCount for packs, 0 for blocks and saws. */
export function hazardHeads(
  track: Track,
  expected: readonly number[],
  horde: HordeTuning = HORDE_DEFAULTS,
): number[] {
  return track.hazards.map((h) =>
    h.kind === "pack"
      ? packCount(expectedAt(track, expected, h.pos), horde)
      : 0,
  );
}

/** Where a shootable threat is now: its track position and its span across the track. */
export type Threat = { pos: number; span: Span };

/**
 * Index of the nearest threat at or after `from`, ahead of `dist` within
 * FIRE_RANGE and short of `limit` (the next question), whose span overlaps
 * the crowd's. Null entries can't be shot.
 */
export function pickTarget(
  threats: readonly (Threat | null)[],
  from: number,
  dist: number,
  crowd: Span,
  limit = Infinity,
): number | null {
  let best: number | null = null;
  let bestPos = Infinity;
  for (let i = from; i < threats.length; i++) {
    const t = threats[i];
    if (
      !t ||
      t.pos < dist ||
      t.pos - dist > FIRE_RANGE ||
      t.pos >= limit ||
      t.pos >= bestPos
    )
      continue;
    const { left, right } = t.span;
    if (Math.min(crowd.right, right) - Math.max(crowd.left, left) > 0) {
      best = i;
      bestPos = t.pos;
    }
  }
  return best;
}
