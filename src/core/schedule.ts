/**
 * The scheduler (SPEC-scheduler §1–2): items come back when they are due by
 * real time since their last answer, by box. Pure: `now` comes from the
 * caller, randomness from the seeded `rng`.
 */
import { GAP_BY_BOX } from "./tuning";

const gap = (box: number): number =>
  GAP_BY_BOX[Math.max(0, Math.min(box, GAP_BY_BOX.length - 1))] ?? 0;

/** When an item at `box`, last answered at `lastSeen`, is due (epoch ms). */
export const dueAt = (box: number, lastSeen: number): number =>
  lastSeen + gap(box);

/** How long past due the item is at `now` (ms); ≥ 0 when due, negative before. */
export const overdueBy = (box: number, lastSeen: number, now: number): number =>
  now - dueAt(box, lastSeen);

/**
 * How near due a not-yet-due item is: elapsed time over its box's gap (1 =
 * due). Boxes with no gap are always due: Infinity.
 */
export function nearness(box: number, lastSeen: number, now: number): number {
  const g = gap(box);
  return g === 0 ? Infinity : (now - lastSeen) / g;
}
