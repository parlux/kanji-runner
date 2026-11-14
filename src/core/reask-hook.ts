import { gateOpenings } from "./gates";
import {
  isTrigger,
  pickTarget as pickReaskTarget,
  REASK_OPTIONS,
  reaskRow,
} from "./reask";
import { createRng } from "./rng";
import type { RunState } from "./state";
import { REASK_MAX } from "./tuning";

/** Decorrelates a re-ask row's rng from the run's and the target pick's. */
const REASK_ROW_SALT = 0x27d4eb2f;

/**
 * After row `q` resolves: if it is a trigger and fewer than `REASK_MAX`
 * re-asks are placed, `pickTarget`'s row (if any) becomes a re-ask of `q`,
 * with new openings for `REASK_OPTIONS` answers. Nothing else changes.
 */
export function placeReask(s: RunState, q: number, correct: boolean): RunState {
  const r = s.reask;
  if (!r || r.links.length >= REASK_MAX) return s;
  const reasks = s.rows.map((_, i) => r.links.some((l) => l.row === i));
  if (!isTrigger(correct, r.startBoxes[q] ?? 0, reasks[q] ?? false)) return s;
  const keys = r.entries.map((e) => e.key);
  const target = pickReaskTarget(r.seed, q, {
    keys,
    reasks,
    charges: s.track.charges,
  });
  const entry = r.entries[q];
  const first = s.rows[q];
  if (target === null || !entry || !first) return s;
  const rng = createRng(
    (r.seed ^
      REASK_ROW_SALT ^
      Math.imul(q + 1, 0x9e3779b1) ^
      Math.imul(target + 1, 0x85ebca77)) >>>
      0,
  );
  const rows = [...s.rows];
  rows[target] = reaskRow(rng, entry, first, r.pool);
  const gates = [...s.gates];
  gates[target] = gateOpenings(REASK_OPTIONS);
  const entries = [...r.entries];
  entries[target] = entry;
  const startBoxes = [...r.startBoxes];
  startBoxes[target] = r.startBoxes[q] ?? 0;
  return {
    ...s,
    rows,
    gates,
    reask: {
      ...r,
      entries,
      startBoxes,
      links: [...r.links, { row: target, of: q }],
    },
  };
}
