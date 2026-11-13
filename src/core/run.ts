import {
  kanaRow,
  mainReadings,
  meaningRow,
  readingRow,
  shownReading,
  wordRow,
  type Reading,
  showReading,
} from "./distractors";
import { createRng, shuffle, type Rng } from "./rng";
import {
  builtInPool,
  builtInSelection,
  type Entry,
  type Pool,
  type Selection,
} from "./pool";
import {
  MAX_NEW_PER_RUN,
  MAX_NEW_WORDS_PER_RUN,
  ROWS_PER_RUN,
  TWO_OPTION_ROWS,
  WARM_UPS,
} from "./tuning";
import type { GateRow, KanaItem, KanjiItem, Progress, WordItem } from "./types";

const optionCount = (i: number): number => (i < TWO_OPTION_ROWS ? 2 : 3);

export { kanaLevel, unlockedPool, type Entry } from "./pool";

/** Up to `n` entries by weighted random choice, without repeats. */
function weightedDraw(
  rng: Rng,
  entries: readonly Entry[],
  n: number,
  weightOf: (e: Entry) => number,
): Entry[] {
  const left = [...entries];
  const out: Entry[] = [];
  while (out.length < n && left.length > 0) {
    let total = 0;
    for (const e of left) total += weightOf(e);
    let r = rng() * total;
    let i = 0;
    while (i < left.length - 1 && (r -= weightOf(left[i] as Entry)) >= 0) i++;
    out.push(...left.splice(i, 1));
  }
  return out;
}

/**
 * The run's 14 prompts. Warm-ups first: the highest-box known items of the current level
 * (all known items while it has fewer than 3; ties at random). Then up to 4 new items in progression order, shuffled in among
 * known items drawn by weight 2^(5 − box), no repeats. Only while the pool is
 * too small to fill a run (early on) does a further weighted pass repeat items.
 */
export function selectEntries(
  rng: Rng,
  pool: readonly Entry[],
  progress: Progress,
): Entry[] {
  return select(rng, builtInSelection(progress, pool));
}

/** `selectEntries` for any mode's selection rules. */
export function select(rng: Rng, sel: Selection): Entry[] {
  const { box, weight: weightOf } = sel;
  const known = sel.entries.filter(sel.known);
  // new items in progression order; at most MAX_NEW_WORDS_PER_RUN of them words
  const fresh: Entry[] = [];
  let newWords = 0;
  for (const e of sel.entries) {
    if (fresh.length >= MAX_NEW_PER_RUN) break;
    if (sel.known(e)) continue;
    if (e.type === "word" && newWords++ >= MAX_NEW_WORDS_PER_RUN) continue;
    fresh.push(e);
  }
  // Warm-ups come from the current level's known items once it has enough,
  // so placed lower levels don't fill them; else from all known items.
  // Stable sort after a shuffle: highest box first, ties in random order.
  const current = known.filter(sel.current);
  const warm = shuffle(rng, current.length >= WARM_UPS ? current : known)
    .sort((a, b) => box(b) - box(a))
    .slice(0, WARM_UPS);
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
 * A Built-in run from the seed and SRS state: same seed and progress, same run.
 * Distractors draw on unlocked items plus the next level.
 */
export function buildRun(
  seed: number,
  progress: Progress,
  kana: readonly KanaItem[],
  kanji: readonly KanjiItem[],
  words: readonly WordItem[] = [],
): GateRow[] {
  return buildPoolRun(
    seed,
    progress,
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
  const similar = pool.similar(e.item.char);
  if (e.type === "meaning")
    return meaningRow(rng, e.item, pool.kanji, count, similar);
  if (!shown) throw new Error("A reading gate needs the reading to show");
  return readingRow(rng, e.item, pool.kanji, count, shown, similar);
}

/**
 * A run from the seed, SRS state and a mode's pool (`pool.ts`). A reading
 * gate shows the kanji's main readings in turn, by how often it has been asked.
 */
export function buildPoolRun(
  seed: number,
  progress: Progress,
  pool: Pool,
): GateRow[] {
  return poolRun(seed, progress, pool).rows;
}

/** `buildPoolRun` plus the entry each row asks, in row order. */
export function poolRun(
  seed: number,
  progress: Progress,
  pool: Pool,
): { rows: GateRow[]; entries: Entry[] } {
  const rng = createRng(seed);
  const asked = new Map<string, number>();
  const entries = select(rng, pool);
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
): Missed[] {
  const out: Missed[] = [];
  results.forEach((ok, i) => {
    const row = rows[i];
    if (ok || !row) return;
    const k =
      row.type === "reading" ? kanji.find((x) => x.char === row.prompt) : null;
    const all = k ? mainReadings(k).map(showReading) : [];
    out.push({
      q: i + 1,
      type: row.type,
      prompt: row.prompt,
      answers: all.length > 0 ? all : [row.answer],
      charge: charges.includes(i),
    });
  });
  return out;
}

/** The other half of a kanji, shown after a right answer: its main readings (on'yomi, then kun'yomi) or its meaning. */
export type Reveal = {
  char: string;
  readings: { text: string; kind: "on" | "kun" }[];
  meaning: string;
};

/**
 * What to show after a right answer: a meaning gate reveals the main
 * readings, a reading gate the meaning. Nothing for wrong answers, kana and
 * word gates, or a kanji missing from `kanji`.
 */
export function revealFor(
  row: GateRow,
  kanji: readonly KanjiItem[],
  correct: boolean,
): Reveal | null {
  if (!correct || (row.type !== "meaning" && row.type !== "reading"))
    return null;
  const k = kanji.find((x) => x.char === row.prompt);
  if (!k) return null;
  const meaning = k.glosses[0] ?? "";
  if (row.type === "reading")
    return meaning ? { char: k.char, readings: [], meaning } : null;
  const readings = mainReadings(k).map((r) => ({
    text: showReading(r),
    kind: (k.on && r.base === k.on && !r.okurigana ? "on" : "kun") as
      | "on"
      | "kun",
  }));
  return readings.length ? { char: k.char, readings, meaning: "" } : null;
}
