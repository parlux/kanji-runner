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

/**
 * Progress after a run: each answered row updates its item in order (a row
 * asked twice updates twice); unanswered rows (the army died first) don't.
 * Only answers count, never clipping or hazards.
 */
export function recordRun(
  progress: Progress,
  rows: readonly GateRow[],
  results: readonly boolean[],
  finished: boolean,
  now: number,
): Progress {
  const items = { ...progress.items };
  results.forEach((correct, i) => {
    const row = rows[i];
    if (!row) return;
    const key = itemKey(row.prompt, row.type);
    items[key] = review(items[key], correct, now);
  });
  const { runs, wins, losses } = progress.stats;
  return {
    ...progress,
    items,
    stats: {
      runs: runs + 1,
      wins: wins + (finished ? 1 : 0),
      losses: losses + (finished ? 0 : 1),
    },
  };
}
