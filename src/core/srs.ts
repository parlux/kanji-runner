import type { ReaskLink } from "./reask";
import { REASK_MAX_BOX } from "./tuning";
import type { GateRow, GateType, ItemProgress, Progress } from "./types";

export const MAX_BOX = 5;
/** A kanji's reading gate unlocks once its meaning box reaches this. */
export const READING_UNLOCK_BOX = 3;

export const itemKey = (char: string, type: GateType): string =>
  `${char}:${type}`;

export function defaultProgress(): Progress {
  return {
    version: 1,
    unlockedLevel: 0,
    items: {},
    stats: { runs: 0, wins: 0, losses: 0 },
  };
}

/** Selection weight: 2^(5 − box), so box 0 is 32× box 5. */
export const weight = (box: number): number => 2 ** (MAX_BOX - box);

/** Leitner update: correct → box + 1 (max 5), wrong → box 0. */
export function review(
  item: ItemProgress | undefined,
  correct: boolean,
  now: number,
): ItemProgress {
  const prev = item ?? { box: 0, seen: 0, correct: 0, wrong: 0, lastSeen: 0 };
  return {
    box: correct ? Math.min(MAX_BOX, prev.box + 1) : 0,
    seen: prev.seen + 1,
    correct: prev.correct + (correct ? 1 : 0),
    wrong: prev.wrong + (correct ? 0 : 1),
    lastSeen: now,
  };
}

/** What a run with re-asks tells `recordRun`. */
export type ReaskRecord = {
  /** Re-ask rows and the row each one re-asks. */
  links: readonly ReaskLink[];
  /** Each row's box at the start of the run (seeded when it had no record). */
  startBoxes: readonly number[];
};

/** `item` with a new box and the counters of `answers` added. */
function withAnswers(
  item: ItemProgress | undefined,
  box: number,
  answers: readonly boolean[],
  now: number,
): ItemProgress {
  const prev = item ?? { box: 0, seen: 0, correct: 0, wrong: 0, lastSeen: 0 };
  const right = answers.filter(Boolean).length;
  return {
    box,
    seen: prev.seen + answers.length,
    correct: prev.correct + right,
    wrong: prev.wrong + answers.length - right,
    lastSeen: now,
  };
}

/**
 * Progress after a run. Without `reask`, each answered row updates its item in
 * order (a row asked twice updates twice); unanswered rows (the army died
 * first) don't. Only answers count, never clipping or hazards.
 *
 * With `reask`, a linked pair whose two rows were both answered updates its
 * item once from the pair (right+right: start box + 1; anything else: 0), and
 * the counters count both answers. Every other answered row (including an
 * unlinked same-key repeat, each answer in turn) follows the "no re-ask" rule:
 * wrong gives 0; right on a weak start box (<= REASK_MAX_BOX) leaves the box
 * as is; right on a stronger one adds 1.
 */
export function recordRun(
  progress: Progress,
  rows: readonly GateRow[],
  results: readonly boolean[],
  won: boolean,
  now: number,
  reask?: ReaskRecord,
): Progress {
  const items = { ...progress.items };
  const keyAt = (i: number): string | undefined => {
    const row = rows[i];
    return row ? itemKey(row.prompt, row.type) : undefined;
  };
  results.forEach((correct, i) => {
    const key = keyAt(i);
    if (key === undefined) return;
    if (!reask) {
      items[key] = review(items[key], correct, now);
      return;
    }
    const start = reask.startBoxes[i] ?? 0;
    const link = reask.links.find((l) => l.row === i);
    const first = link?.of;
    if (link && first !== undefined && first < results.length) {
      // The re-ask closes the pair; the first ask's row was skipped below.
      const both = (results[first] as boolean) && correct;
      const base = reask.startBoxes[first] ?? start;
      items[key] = withAnswers(
        items[key],
        both ? Math.min(MAX_BOX, base + 1) : 0,
        [results[first] as boolean, correct],
        now,
      );
      return;
    }
    if (reask.links.some((l) => l.of === i && l.row < results.length)) {
      return; // updated together with its re-ask
    }
    const cur = items[key]?.box ?? start;
    const box = !correct
      ? 0
      : start <= REASK_MAX_BOX
        ? cur
        : Math.min(MAX_BOX, cur + 1);
    items[key] = withAnswers(items[key], box, [correct], now);
  });
  const { runs, wins, losses } = progress.stats;
  return {
    ...progress,
    items,
    stats: {
      runs: runs + 1,
      wins: wins + (won ? 1 : 0),
      losses: losses + (won ? 0 : 1),
    },
  };
}
