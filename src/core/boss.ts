import { createRng } from "./rng";
import {
  applyCorrect,
  applyCorrectCharge,
  applyWrong,
  applyWrongCharge,
} from "./scoring";
import {
  BASE_REWARD,
  BOSS_K,
  BOSS_PASS_ACCURACY,
  BOSS_PASSES,
  CLASH_SECONDS,
  EXPECTED_SURVIVAL,
  STARTING_ARMY,
} from "./tuning";
import type { GateRow } from "./types";

/** Keeps the boss's passes off the run-building random stream. */
const BOSS_SALT = 0x9e3779b9;

/**
 * Final army of one scoring-only pass (no clipping, hazards or crates):
 * `wrong(q)` says whether question q is missed. Questions in `charges` score
 * as squad charges. Stops at 0, like a dead run.
 */
export function scorePass(
  rows: readonly GateRow[],
  charges: readonly number[],
  wrong: (q: number) => boolean,
): number {
  let army = STARTING_ARMY;
  let streak = 0;
  for (let q = 0; q < rows.length && army > 0; q++) {
    const row = rows[q] as GateRow;
    const charge = charges.includes(q);
    const base = BASE_REWARD[row.type];
    const r = wrong(q)
      ? (charge ? applyWrongCharge : applyWrong)(army)
      : (charge ? applyCorrectCharge : applyCorrect)(army, streak, base);
    army = r.army;
    streak = r.streak;
  }
  return army;
}

/**
 * Expected army at the boss: the median final army of BOSS_PASSES seeded
 * passes at BOSS_PASS_ACCURACY over the run's actual questions (squad shapes
 * included), × EXPECTED_SURVIVAL for clipping losses. Same seed and rows,
 * same value.
 */
export function expectedBossArmy(
  rows: readonly GateRow[],
  charges: readonly number[],
  seed: number,
): number {
  const rng = createRng((seed ^ BOSS_SALT) >>> 0);
  const finals = Array.from({ length: BOSS_PASSES }, () =>
    scorePass(rows, charges, () => rng() >= BOSS_PASS_ACCURACY),
  ).sort((a, b) => a - b);
  const mid = finals.length >> 1;
  const median =
    finals.length % 2
      ? (finals[mid] as number)
      : ((finals[mid - 1] as number) + (finals[mid] as number)) / 2;
  return median * EXPECTED_SURVIVAL;
}

/** Boss size = round(BOSS_K × expected army), at least 1. */
export function bossSize(
  rows: readonly GateRow[],
  charges: readonly number[],
  seed: number,
): number {
  return Math.max(
    1,
    Math.round(BOSS_K * expectedBossArmy(rows, charges, seed)),
  );
}

/** A tie is a loss: the army must outnumber the boss. */
export const bossWon = (army: number, boss: number): boolean => army > boss;

export type Clash = { army: number; boss: number; done: boolean };

/**
 * Both sides `t` seconds into the clash. Each tick takes one unit from each
 * side; ticks come fast enough that the smaller side is gone after
 * CLASH_SECONDS, so a huge clash doesn't drag on. A tie leaves both at 0.
 */
export function clashAt(army: number, boss: number, t: number): Clash {
  const total = Math.min(army, boss);
  const lost =
    t >= CLASH_SECONDS
      ? total
      : Math.min(total, Math.floor((total * Math.max(0, t)) / CLASH_SECONDS));
  return { army: army - lost, boss: boss - lost, done: lost >= total };
}
