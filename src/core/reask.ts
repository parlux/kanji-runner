import { showReading, mainReadings } from "./distractors";
import type { Entry, Pool } from "./pool";
import { createRng, randInt, type Rng } from "./rng";
import { entryRow } from "./run";
import { REASK_GAP_MAX, REASK_GAP_MIN, REASK_MAX_BOX } from "./tuning";
import type { GateRow } from "./types";

/** Row `row` is a re-ask of row `of` (both 0-based row indexes). */
export type ReaskLink = { row: number; of: number };

/** Re-asks always have this many options, wherever they land. */
export const REASK_OPTIONS = 3;

/** Decorrelates the target pick from the run's own rng and the track layout. */
const REASK_SALT = 0x85ebca6b;

/**
 * Whether an answered row asks for a re-ask: a wrong answer, or a right one
 * on an item whose box at the start of the run was at most `REASK_MAX_BOX`.
 * A re-ask row never triggers another.
 */
export function isTrigger(
  correct: boolean,
  startBox: number,
  isReask: boolean,
): boolean {
  if (isReask) return false;
  return !correct || startBox <= REASK_MAX_BOX;
}

/** What `pickTarget` needs to know about the run's rows, indexed by row. */
export type TargetRows = {
  /** Item key of each row's current content. */
  keys: readonly string[];
  /** Which rows are already re-asks. */
  reasks: readonly boolean[];
  /** Row indexes that are squad charges. */
  charges: readonly number[];
};

/**
 * The row a trigger at `trigger` replaces, or `null` when none is eligible.
 * Candidates are `REASK_GAP_MIN`–`REASK_GAP_MAX` rows ahead. Rows resolve in
 * order, so every row ahead of the trigger is unresolved. Excluded: squad
 * charges, re-asks, and rows asking the trigger's own item. Seeded from
 * (run seed, trigger row) alone, so it never touches the run's rng.
 */
export function pickTarget(
  seed: number,
  trigger: number,
  rows: TargetRows,
): number | null {
  const eligible: number[] = [];
  for (let i = trigger + REASK_GAP_MIN; i <= trigger + REASK_GAP_MAX; i++) {
    if (i >= rows.keys.length) break;
    if (rows.charges.includes(i) || rows.reasks[i]) continue;
    if (rows.keys[i] === rows.keys[trigger]) continue;
    eligible.push(i);
  }
  if (eligible.length === 0) return null;
  const rng = createRng(
    (seed ^ REASK_SALT ^ Math.imul(trigger + 1, 0x9e3779b1)) >>> 0,
  );
  return eligible[randInt(rng, eligible.length)] as number;
}

/**
 * The re-ask of `first` (the row the entry was asked in): same item, gate type
 * and shown reading, `REASK_OPTIONS` options, fresh distractors by the pool's
 * rules, the answer in a uniformly random opening.
 */
export function reaskRow(
  rng: Rng,
  entry: Entry,
  first: GateRow,
  pool: Pool,
): GateRow {
  const shown =
    entry.type === "reading"
      ? mainReadings(entry.item).find((r) => showReading(r) === first.answer)
      : undefined;
  return entryRow(rng, entry, pool, REASK_OPTIONS, shown);
}
