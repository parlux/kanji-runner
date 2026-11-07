import type { ItemProgress, Progress } from "./types";

/**
 * Later `lastSeen` wins. On a tie the records are combined field-wise by max,
 * which keeps the merge commutative, idempotent and associative: the result is
 * always the field-wise max of every record sharing the latest `lastSeen`.
 */
function mergeItem(a: ItemProgress, b: ItemProgress): ItemProgress {
  if (a.lastSeen !== b.lastSeen) return a.lastSeen > b.lastSeen ? a : b;
  return {
    box: Math.max(a.box, b.box),
    seen: Math.max(a.seen, b.seen),
    correct: Math.max(a.correct, b.correct),
    wrong: Math.max(a.wrong, b.wrong),
    lastSeen: a.lastSeen,
  };
}

/**
 * Merge local and remote progress. Pure; returns a new object.
 * Items: union of keys, per-key `mergeItem`. `unlockedLevel` and each stats
 * counter take the max. `version` is fixed at 1 (the only version).
 */
export function mergeProgress(a: Progress, b: Progress): Progress {
  const items: Record<string, ItemProgress> = {};
  for (const key of new Set([
    ...Object.keys(a.items),
    ...Object.keys(b.items),
  ])) {
    const x = a.items[key];
    const y = b.items[key];
    const only = x ?? y;
    if (x && y) items[key] = mergeItem(x, y);
    else if (only) items[key] = { ...only };
  }
  return {
    version: 1,
    unlockedLevel: Math.max(a.unlockedLevel, b.unlockedLevel),
    items,
    stats: {
      runs: Math.max(a.stats.runs, b.stats.runs),
      wins: Math.max(a.stats.wins, b.stats.wins),
      losses: Math.max(a.stats.losses, b.stats.losses),
    },
  };
}
