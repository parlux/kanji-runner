/**
 * The scheduler (SPEC-scheduler §1–2): items come back when they are due by
 * real time since their last answer, by box. Pure: `now` comes from the
 * caller, randomness from the seeded `rng`.
 */
import type { Entry, Selection } from "./pool";
import { shuffle, weightedDraw, type Rng } from "./rng";
import { LEARNED_BOX, weight } from "./srs";
import {
  DUE_MIN_SLOTS,
  GAP_BY_BOX,
  LEARNING_SLOTS,
  MAX_NEW_PER_RUN,
  MAX_NEW_WORDS_PER_RUN,
  NEW_WHEN_LEARNING_UNDER,
  ROWS_PER_RUN,
  WARM_UPS,
  WARM_UP_MIN_BOX,
} from "./tuning";

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

/** What the scheduler reads per item: a Built-in or Meaning mode `Selection`. */
export type ScheduleInput = Selection;

const isWord = (e: Entry) => e.type === "word" || e.type === "wordreading";

/** Shuffle, then stable sort: ties come out in seeded random order. */
const sorted = (
  rng: Rng,
  items: readonly Entry[],
  cmp: (a: Entry, b: Entry) => number,
): Entry[] => shuffle(rng, items).sort(cmp);

/**
 * The run's `ROWS_PER_RUN` entries in row order (SPEC-scheduler §2): warm-ups,
 * then a shuffled block of in-progress, due older, new and the rest. Same rng
 * seed, `now` and input → same run.
 */
export function schedule(rng: Rng, sel: ScheduleInput, now: number): Entry[] {
  const { box, current, lastSeen, seen } = sel;
  const over = (e: Entry) => overdueBy(box(e), lastSeen(e), now);
  const due = (e: Entry) => over(e) >= 0;
  const answered = (e: Entry) => seen(e) > 0;
  const inProgress = (e: Entry) =>
    current(e) && answered(e) && box(e) < LEARNED_BOX;
  /**
   * Most urgent first: due before not due; among due, answered before
   * placement records (seen 0), slips (answered, box 0) first, then most
   * overdue; among not due, nearest.
   */
  const urgency = (a: Entry, b: Entry): number => {
    const da = due(a);
    const db = due(b);
    if (da !== db) return da ? -1 : 1;
    if (!da)
      return (
        nearness(box(b), lastSeen(b), now) - nearness(box(a), lastSeen(a), now)
      );
    const aa = answered(a);
    if (aa !== answered(b)) return aa ? -1 : 1;
    const sa = box(a) === 0;
    if (sa !== (box(b) === 0)) return sa ? -1 : 1;
    return over(b) - over(a);
  };

  const known = sel.entries.filter(sel.known);
  // new items in progression order; at most MAX_NEW_WORDS_PER_RUN of them words
  const fresh: Entry[] = [];
  let newWords = 0;
  for (const e of sel.entries) {
    if (fresh.length >= MAX_NEW_PER_RUN) break;
    if (sel.known(e)) continue;
    if (isWord(e) && newWords++ >= MAX_NEW_WORDS_PER_RUN) continue;
    fresh.push(e);
  }

  // 1. Warm-ups: box >= WARM_UP_MIN_BOX, due first, current level first
  // among due and among not due, then most urgent (strong current items are
  // not re-asked before their gap). With fewer strong items, the highest
  // boxes fill in.
  const strong = sorted(
    rng,
    known.filter((e) => box(e) >= WARM_UP_MIN_BOX),
    (a, b) =>
      Number(due(b)) - Number(due(a)) ||
      Number(current(b)) - Number(current(a)) ||
      urgency(a, b),
  );
  const weak = sorted(
    rng,
    known.filter((e) => box(e) < WARM_UP_MIN_BOX),
    (a, b) => box(b) - box(a),
  );
  const warm = [...strong, ...weak].slice(0, WARM_UPS);

  // 2. The block, filled in priority order up to the run's size.
  const block: Entry[] = [];
  const picked = new Set<Entry>(warm);
  const room = () => ROWS_PER_RUN - warm.length - block.length;
  const take = (items: readonly Entry[], n = Infinity) => {
    for (const e of items) {
      if (n <= 0 || room() <= 0) return;
      if (picked.has(e)) continue;
      picked.add(e);
      block.push(e);
      n--;
    }
  };
  const left = () => known.filter((e) => !picked.has(e));
  // in progress: least recently seen first
  take(
    sorted(rng, left().filter(inProgress), (a, b) => lastSeen(a) - lastSeen(b)),
    LEARNING_SLOTS,
  );
  // due older: most overdue first, placement after answered
  take(
    sorted(
      rng,
      left().filter((e) => !current(e) && due(e)),
      urgency,
    ),
    DUE_MIN_SLOTS,
  );
  // new: only while the current level has few gates in progress (all of them
  // in the pool, picked or not, so a long learning queue holds new items back)
  if (known.filter(inProgress).length < NEW_WHEN_LEARNING_UNDER) take(fresh);
  // the rest: most overdue, then nearest to due, then lowest box
  take(sorted(rng, left(), (a, b) => urgency(a, b) || box(a) - box(b)));
  // a pool too small for a run without new items takes them before repeats
  take(fresh);

  const out = [...warm, ...shuffle(rng, block)];
  const eligible = [...known, ...fresh];
  if (eligible.length === 0) throw new Error("No unlocked items");
  // early game: the pool is smaller than a run, so weighted repeats fill it
  const w = (e: Entry) => weight(box(e));
  while (out.length < ROWS_PER_RUN)
    out.push(...weightedDraw(rng, eligible, ROWS_PER_RUN - out.length, w));
  return out;
}
