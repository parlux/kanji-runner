import { kanaRow, meaningRow, readingRow, shownReading } from "./distractors";
import { createRng, randInt, shuffle, type Rng } from "./rng";
import { itemKey, READING_UNLOCK_BOX, weight } from "./srs";
import {
  MAX_NEW_PER_RUN,
  ROWS_PER_RUN,
  TWO_OPTION_ROWS,
  WARM_UPS,
} from "./tuning";
import type { GateRow, KanaItem, KanjiItem, Progress } from "./types";

const optionCount = (i: number): number => (i < TWO_OPTION_ROWS ? 2 : 3);

/** Level 0 is hiragana, level 1 katakana. */
export const kanaLevel = (k: KanaItem): number =>
  k.script === "hiragana" ? 0 : 1;

/** One askable item: a kana, or a kanji as a meaning or a reading gate. */
export type Entry =
  | { key: string; type: "kana"; item: KanaItem }
  | { key: string; type: "meaning" | "reading"; item: KanjiItem };

/**
 * Every unlocked item, in progression order: kana, then kanji by level. A
 * kanji's reading follows its meaning, once the meaning box is ≥ 3.
 */
export function unlockedPool(
  progress: Progress,
  kana: readonly KanaItem[],
  kanji: readonly KanjiItem[],
): Entry[] {
  const level = progress.unlockedLevel;
  const out: Entry[] = [];
  for (const k of kana)
    if (kanaLevel(k) <= level)
      out.push({ key: itemKey(k.char, "kana"), type: "kana", item: k });
  for (const k of kanji) {
    if (k.level > level) continue;
    const key = itemKey(k.char, "meaning");
    out.push({ key, type: "meaning", item: k });
    if ((progress.items[key]?.box ?? 0) >= READING_UNLOCK_BOX)
      out.push({ key: itemKey(k.char, "reading"), type: "reading", item: k });
  }
  return out;
}

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
 * The run's 14 prompts. Warm-ups first: the highest-box known items (ties at
 * random). Then up to 4 new items in progression order, shuffled in among
 * known items drawn by weight 2^(5 − box), no repeats. Only while the pool is
 * too small to fill a run (early on) does a further weighted pass repeat items.
 */
export function selectEntries(
  rng: Rng,
  pool: readonly Entry[],
  progress: Progress,
): Entry[] {
  const record = (e: Entry) => progress.items[e.key];
  const box = (e: Entry): number => record(e)?.box ?? 0;
  const weightOf = (e: Entry): number => weight(box(e));
  const known = pool.filter((e) => record(e));
  const fresh = pool.filter((e) => !record(e)).slice(0, MAX_NEW_PER_RUN);
  // stable sort after a shuffle: highest box first, ties in random order
  const warm = shuffle(rng, known)
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
 * A run built from the seed and SRS state: same seed and progress, same run.
 * Distractors draw on unlocked items plus the next level. A reading gate
 * shows the kanji's main readings in turn, by how often it has been asked.
 */
export function buildRun(
  seed: number,
  progress: Progress,
  kana: readonly KanaItem[],
  kanji: readonly KanjiItem[],
): GateRow[] {
  const rng = createRng(seed);
  const pool = unlockedPool(progress, kana, kanji);
  const next = progress.unlockedLevel + 1;
  const kanaPool = kana.filter((k) => kanaLevel(k) <= next);
  const kanjiPool = kanji.filter((k) => k.level <= next);
  const asked = new Map<string, number>();
  return selectEntries(rng, pool, progress).map((e, i) => {
    const count = optionCount(i);
    if (e.type === "kana") return kanaRow(rng, e.item, kanaPool, count);
    if (e.type === "meaning") return meaningRow(rng, e.item, kanjiPool, count);
    const turn = (progress.items[e.key]?.seen ?? 0) + (asked.get(e.key) ?? 0);
    asked.set(e.key, (asked.get(e.key) ?? 0) + 1);
    return readingRow(
      rng,
      e.item,
      kanjiPool,
      count,
      shownReading(e.item, turn),
    );
  });
}

/** Uniform kana-only run. Replaced by SRS-weighted selection in Task 7. */
export function buildKanaRun(
  seed: number,
  pool: readonly KanaItem[],
): GateRow[] {
  const rng = createRng(seed);
  return Array.from({ length: ROWS_PER_RUN }, (_, i) => {
    const item = pool[randInt(rng, pool.length)] as KanaItem;
    return kanaRow(rng, item, pool, optionCount(i));
  });
}

/**
 * Uniform kanji run with levels 2..`level` unlocked: each question asks a
 * random unlocked kanji (no repeats while there are enough), as a meaning or
 * a reading gate at random. Distractors also draw on the next level. The
 * reading shown rotates with the seed. A dev stand-in until Task 7's SRS.
 */
export function buildKanjiRun(
  seed: number,
  kanji: readonly KanjiItem[],
  level: number,
): GateRow[] {
  const rng = createRng(seed);
  const unlocked = kanji.filter((k) => k.level <= level);
  const pool = kanji.filter((k) => k.level <= level + 1);
  const picks = shuffle(rng, unlocked);
  return Array.from({ length: ROWS_PER_RUN }, (_, i) => {
    const item = picks[i % picks.length] as KanjiItem;
    const count = optionCount(i);
    return rng() < 0.5
      ? meaningRow(rng, item, pool, count)
      : readingRow(rng, item, pool, count, shownReading(item, seed));
  });
}
