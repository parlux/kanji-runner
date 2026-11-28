import {
  kanaRow,
  mainReadings,
  meaningRow,
  readingRow,
  shownReading,
  wordReadingRow,
  wordRow,
  type Reading,
  showReading,
} from "./distractors";
import { createRng, shuffle, weightedDraw, type Rng } from "./rng";
import {
  builtInPool,
  builtInSelection,
  type Entry,
  type Pool,
  type WeightedSelection,
} from "./pool";
import { schedule } from "./schedule";
import {
  MAX_NEW_PER_RUN,
  MAX_NEW_WORDS_PER_RUN,
  ROWS_PER_RUN,
  TWO_OPTION_ROWS,
  WARM_UPS,
  WARM_UP_MIN_BOX,
} from "./tuning";
import type { GateRow, KanaItem, KanjiItem, Progress, WordItem } from "./types";

const optionCount = (i: number): number => (i < TWO_OPTION_ROWS ? 2 : 3);

export { kanaLevel, unlockedPool, type Entry } from "./pool";

/**
 * The run's 14 prompts for a Built-in pool, by the scheduler (`schedule.ts`):
 * same seed, `now` and progress → same entries.
 */
export function selectEntries(
  rng: Rng,
  pool: readonly Entry[],
  progress: Progress,
  now: number,
): Entry[] {
  return schedule(rng, builtInSelection(progress, pool), now);
}

/**
 * WaniKani mode's selection: warm-ups first (of the current level's known
 * items at box 3 or higher, else all known, the 3 seen longest ago; with fewer
 * strong items, the highest boxes), then up to 4 new items in progression
 * order shuffled in among known items drawn by weight, no repeats. Only while
 * the pool is too small to fill a run does a weighted pass repeat items.
 */
export function select(rng: Rng, sel: WeightedSelection): Entry[] {
  const { box, weight: weightOf } = sel;
  const known = sel.entries.filter(sel.known);
  // new items in progression order; at most MAX_NEW_WORDS_PER_RUN of them words
  const fresh: Entry[] = [];
  let newWords = 0;
  for (const e of sel.entries) {
    if (fresh.length >= MAX_NEW_PER_RUN) break;
    if (sel.known(e)) continue;
    if (
      (e.type === "word" || e.type === "wordreading") &&
      newWords++ >= MAX_NEW_WORDS_PER_RUN
    )
      continue;
    fresh.push(e);
  }
  // Warm-ups come from the current level's known items once it has enough,
  // so placed lower levels don't fill them; else from all known items.
  // Among those at box >= WARM_UP_MIN_BOX, take the longest-unseen WARM_UPS
  // (shuffle then stable sort: ties in random order) so they rotate. With
  // fewer strong items: highest box first, ties in random order.
  const current = known.filter(sel.current);
  const base = current.length >= WARM_UPS ? current : known;
  const strong = base.filter((e) => box(e) >= WARM_UP_MIN_BOX);
  const warm = (
    strong.length >= WARM_UPS
      ? shuffle(rng, strong).sort((a, b) => sel.lastSeen(a) - sel.lastSeen(b))
      : shuffle(rng, base).sort((a, b) => box(b) - box(a))
  ).slice(0, WARM_UPS);
  const rest = known.filter((e) => !warm.includes(e));
  const need = ROWS_PER_RUN - warm.length - fresh.length;
  const out = [
    ...warm,
    ...shuffle(rng, [...fresh, ...weightedDraw(rng, rest, need, weightOf)]),
  ];
  const eligible = [...known, ...fresh];
  if (eligible.length === 0) throw new Error("No unlocked items");
  while (out.length < ROWS_PER_RUN)
    out.push(
      ...weightedDraw(rng, eligible, ROWS_PER_RUN - out.length, weightOf),
    );
  return out;
}

/**
 * A Built-in run from the seed, `now` (epoch ms) and SRS state: same seed, now
 * and progress, same run.
 * Distractors draw on unlocked items plus the next level.
 */
export function buildRun(
  seed: number,
  progress: Progress,
  now: number,
  kana: readonly KanaItem[],
  kanji: readonly KanjiItem[],
  words: readonly WordItem[] = [],
): GateRow[] {
  return buildPoolRun(
    seed,
    progress,
    now,
    builtInPool(progress, kana, kanji, words),
  );
}

/**
 * One gate row for an entry, with `count` options and distractors by the
 * pool's rules (`similar` first). A reading gate needs the reading to show.
 */
export function entryRow(
  rng: Rng,
  e: Entry,
  pool: Pool,
  count: number,
  shown?: Reading,
): GateRow {
  if (e.type === "kana") return kanaRow(rng, e.item, pool.kana, count);
  if (e.type === "word")
    return wordRow(rng, e.item, pool.words, pool.allWords, count);
  if (e.type === "wordreading")
    return wordReadingRow(rng, e.item, pool.words, pool.allWords, count);
  const similar = pool.similar(e.item.char);
  if (e.type === "meaning")
    return meaningRow(rng, e.item, pool.kanji, count, similar);
  if (!shown) throw new Error("A reading gate needs the reading to show");
  return readingRow(rng, e.item, pool.kanji, count, shown, similar);
}

/**
 * A run from the seed, `now` (epoch ms), SRS state and a mode's pool
 * (`pool.ts`): WaniKani pools (with `weight`) by `select`, the others by the
 * scheduler. A reading
 * gate shows the kanji's main readings in turn, by how often it has been asked.
 */
export function buildPoolRun(
  seed: number,
  progress: Progress,
  now: number,
  pool: Pool,
): GateRow[] {
  return poolRun(seed, progress, now, pool).rows;
}

/** `buildPoolRun` plus the entry each row asks, in row order. */
export function poolRun(
  seed: number,
  progress: Progress,
  now: number,
  pool: Pool,
): { rows: GateRow[]; entries: Entry[] } {
  const rng = createRng(seed);
  const asked = new Map<string, number>();
  const { weight } = pool;
  const entries = weight
    ? select(rng, { ...pool, weight })
    : schedule(rng, pool, now);
  const rows = entries.map((e, i) => {
    const shown =
      e.type === "reading"
        ? shownReading(
            e.item,
            (progress.items[e.key]?.seen ?? 0) + (asked.get(e.key) ?? 0),
          )
        : undefined;
    if (e.type === "reading") asked.set(e.key, (asked.get(e.key) ?? 0) + 1);
    return entryRow(rng, e, pool, optionCount(i), shown);
  });
  return { rows, entries };
}

/** A gate the run answered wrongly, for the summary. */
export type Missed = {
  /** Question number, 1-based. */
  q: number;
  type: GateRow["type"];
  prompt: string;
  /** The correct answer; for a reading gate, every main reading (on'yomi, then kun'yomi). */
  answers: string[];
  /** A wrong squad charge rather than a wall gate. */
  charge: boolean;
  /** Kanji words (meaning or reading gate): the word's reading and first gloss, for the summary. */
  word?: { reading: string; meaning: string };
};

/**
 * Every wrongly answered gate, in order, with its correct answer. A reading
 * gate lists both readings. `charges` are the squad-charge row indexes.
 */
export function missedItems(
  rows: readonly GateRow[],
  results: readonly boolean[],
  charges: readonly number[],
  kanji: readonly KanjiItem[],
  words: readonly WordItem[] = [],
): Missed[] {
  const out: Missed[] = [];
  results.forEach((ok, i) => {
    const row = rows[i];
    if (ok || !row) return;
    const k =
      row.type === "reading" ? kanji.find((x) => x.char === row.prompt) : null;
    const all = k ? mainReadings(k).map(showReading) : [];
    const w =
      row.type === "word" || row.type === "wordreading"
        ? words.find((x) => x.word === row.prompt && x.reading)
        : undefined;
    out.push({
      q: i + 1,
      type: row.type,
      prompt: row.prompt,
      answers: all.length > 0 ? all : [row.answer],
      charge: charges.includes(i),
      ...(w?.reading
        ? { word: { reading: w.reading, meaning: w.glosses[0] ?? "" } }
        : {}),
    });
  });
  return out;
}
