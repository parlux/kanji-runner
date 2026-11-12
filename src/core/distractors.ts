import confusables from "../data/confusables.json";
import { randInt, shuffle, type Rng } from "./rng";
import type { GateRow, KanaItem, KanjiItem, WordItem } from "./types";

/** A possible wrong answer. `key` dedupes options; lower `rank` is more confusable. */
type Candidate = { label: string; key: string; rank: number };

const KANA_GROUPS = confusables.kana;
/** How many Jōyō kanji contain each shared component (fewer is more telling). */
const COMPONENT_SIZE = new Map(
  Object.entries(confusables.components as Record<string, string[]>).map(
    ([c, chars]) => [c, chars.length],
  ),
);

/**
 * `n` distinct distractors, most confusable first: lower ranks are used up
 * before higher ones, and within a rank the order is random. So a confusable
 * always beats a random item.
 */
function pick(rng: Rng, candidates: readonly Candidate[], n: number): string[] {
  const buckets = new Map<number, Candidate[]>();
  for (const c of candidates) {
    const b = buckets.get(c.rank);
    if (b) b.push(c);
    else buckets.set(c.rank, [c]);
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const rank of [...buckets.keys()].sort((a, b) => a - b)) {
    const b = buckets.get(rank) as Candidate[];
    // partial Fisher–Yates: draw at random until enough are found
    for (let i = 0; i < b.length && out.length < n; i++) {
      const j = i + randInt(rng, b.length - i);
      [b[i], b[j]] = [b[j] as Candidate, b[i] as Candidate];
      const c = b[i] as Candidate;
      if (seen.has(c.key)) continue;
      seen.add(c.key);
      out.push(c.label);
    }
  }
  return out;
}

function row(
  rng: Rng,
  type: GateRow["type"],
  prompt: string,
  answer: string,
  distractors: string[],
): GateRow {
  const options = shuffle(rng, [answer, ...distractors]);
  return {
    type,
    prompt,
    options,
    answerIndex: options.indexOf(answer),
    answer,
  };
}

/** Kana → romaji. Look-alike kana (シ/ツ) come first. */
export function kanaRow(
  rng: Rng,
  item: KanaItem,
  pool: readonly KanaItem[],
  count: number,
): GateRow {
  const alike = new Set(
    KANA_GROUPS.filter((g) => g.includes(item.char)).flat(),
  );
  const candidates = pool
    .filter((k) => k.romaji !== item.romaji)
    .map((k) => ({
      label: k.romaji,
      key: k.romaji,
      rank: alike.has(k.char) ? 0 : 1,
    }));
  return row(
    rng,
    "kana",
    item.char,
    item.romaji,
    pick(rng, candidates, count - 1),
  );
}

/** What distractor picking needs from a kanji, worked out once per item. */
type Facts = {
  glosses: Set<string>;
  primaryKey: string;
  /** Main readings as gate labels, with their bracket-free keys. */
  readings: { label: string; key: string }[];
};
const factsCache = new WeakMap<KanjiItem, Facts>();
function facts(k: KanjiItem): Facts {
  let f = factsCache.get(k);
  if (!f) {
    f = {
      glosses: new Set(k.glosses.map(normGloss)),
      primaryKey: normGloss(k.glosses[0] as string),
      readings: mainReadings(k).map((r) => {
        const label = showReading(r);
        return { label, key: plainReading(label) };
      }),
    };
    factsCache.set(k, f);
  }
  return f;
}

function sharesAny(a: Set<string>, b: Set<string>): boolean {
  for (const x of a) if (b.has(x)) return true;
  return false;
}

/** Size of the rarest component two kanji share, or Infinity when they share none. */
function componentRank(a: KanjiItem, b: KanjiItem): number {
  let best = Infinity;
  for (const c of a.components)
    if (b.components.includes(c))
      best = Math.min(best, COMPONENT_SIZE.get(c) ?? Infinity);
  return best;
}

/** A gloss compared loosely: lowercase, no brackets, single spaces. */
export function normGloss(g: string): string {
  return g
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Rank of a distractor kanji: `similar` first, then by shared component. */
const SIMILAR_RANK = -1;
const confusableRank = (
  item: KanjiItem,
  k: KanjiItem,
  similar: readonly string[],
): number => (similar.includes(k.char) ? SIMILAR_RANK : componentRank(item, k));

/**
 * Kanji → primary gloss. Never a kanji sharing any gloss with the prompt.
 * `similar` kanji (WaniKani mode) come first, then shared components.
 */
export function meaningRow(
  rng: Rng,
  item: KanjiItem,
  pool: readonly KanjiItem[],
  count: number,
  similar: readonly string[] = [],
): GateRow {
  const own = facts(item).glosses;
  const candidates: Candidate[] = [];
  for (const k of pool) {
    if (k.char === item.char || sharesAny(facts(k).glosses, own)) continue;
    candidates.push({
      label: k.glosses[0] as string,
      key: facts(k).primaryKey,
      rank: confusableRank(item, k, similar),
    });
  }
  return row(
    rng,
    "meaning",
    item.char,
    item.glosses[0] as string,
    pick(rng, candidates, count - 1),
  );
}

/**
 * Word → first gloss. Distractors are first glosses of other words in `pool`,
 * never one sharing any gloss with the prompt; if fewer than needed, `rest`
 * (the whole list) pads, after the pool's own.
 */
export function wordRow(
  rng: Rng,
  item: WordItem,
  pool: readonly WordItem[],
  rest: readonly WordItem[],
  count: number,
): GateRow {
  const own = new Set(item.glosses.map(normGloss));
  const candidates: Candidate[] = [];
  const add = (list: readonly WordItem[], rank: number): void => {
    for (const w of list) {
      if (w.word === item.word || w.glosses.some((g) => own.has(normGloss(g))))
        continue;
      candidates.push({
        label: w.glosses[0] as string,
        key: normGloss(w.glosses[0] as string),
        rank,
      });
    }
  };
  add(pool, 0);
  add(rest, 1);
  return row(
    rng,
    "word",
    item.word,
    item.glosses[0] as string,
    pick(rng, candidates, count - 1),
  );
}

/** A reading as shown on a gate: kun'yomi okurigana in brackets, あ(げる). */
export type Reading = { base: string; okurigana: string };

export const showReading = (r: Reading): string =>
  r.okurigana ? `${r.base}(${r.okurigana})` : r.base;

/** The reading a label stands for, without brackets: あ(げる) → あげる. */
export const plainReading = (label: string): string =>
  label.replace(/[()]/g, "");

/** The kanji's main readings: first on'yomi, then first kun'yomi. */
export function mainReadings(k: KanjiItem): Reading[] {
  const out: Reading[] = [];
  if (k.on) out.push({ base: k.on, okurigana: "" });
  if (k.kun) out.push(k.kun);
  return out;
}

/** The main reading shown for this kanji in run `turn` (e.g. the run's seed): rotates. */
export function shownReading(k: KanjiItem, turn: number): Reading {
  const rs = mainReadings(k);
  return rs[Math.abs(turn) % rs.length] as Reading;
}

/**
 * Kanji → kana reading. Distractors are other kanji's main readings, never
 * any reading of the prompt, within ±1 kana of the shown reading's length
 * (wider only if the pool runs short). `similar` kanji (WaniKani mode) come
 * first, then kanji sharing a component.
 */
export function readingRow(
  rng: Rng,
  item: KanjiItem,
  pool: readonly KanjiItem[],
  count: number,
  shown: Reading,
  similar: readonly string[] = [],
): GateRow {
  const answer = showReading(shown);
  const len = plainReading(answer).length;
  const own = new Set([...item.readings, plainReading(answer)]);
  const all: Candidate[] = [];
  for (const k of pool) {
    if (k.char === item.char) continue;
    const rank = confusableRank(item, k, similar);
    for (const r of facts(k).readings)
      if (!own.has(r.key)) all.push({ ...r, rank });
  }
  let picked: string[] = [];
  for (let tol = 1; picked.length < count - 1 && tol <= 10; tol++) {
    const near = all.filter((c) => Math.abs(c.key.length - len) <= tol);
    picked = pick(rng, near, count - 1);
  }
  return row(rng, "reading", item.char, answer, picked);
}
