import {
  mainReadings,
  plainReading,
  showReading,
  shownReading,
} from "./distractors";
import { itemKey } from "./srs";
import type { GateRow, KanaItem, KanjiItem, Progress, WordItem } from "./types";

/**
 * What a gate says: `reading` is the kana to say, `text` the written form
 * that helps a voice get pitch accent right (the word for words, the reading
 * itself otherwise).
 */
export type Spoken = { text: string; reading: string };

/** What `spoken` looks items up in: the run's kanji and words, and the progress the run was built from. */
export type SpeechContext = {
  kanji: readonly KanjiItem[];
  words: readonly WordItem[];
  progress: Progress;
};

/** Katakana (ァ–ヶ) → hiragana; everything else unchanged. */
const toHiragana = (s: string): string =>
  s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

const isKatakana = (s: string): boolean => /^[゠-ヿ]+$/.test(s);

/** A kana or a kanji reading says itself, in hiragana. */
const self = (kana: string): Spoken => {
  const r = toHiragana(kana);
  return { text: r, reading: r };
};

/** A word says its reading; a loanword (no reading) says itself. */
const wordSpoken = (w: WordItem): Spoken => ({
  text: w.word,
  reading: w.reading ?? w.word,
});

/** Lookups by character / word, built once per list. */
const kanjiMaps = new WeakMap<readonly KanjiItem[], Map<string, KanjiItem>>();
const wordMaps = new WeakMap<readonly WordItem[], Map<string, WordItem>>();
function byKey<T>(
  cache: WeakMap<readonly T[], Map<string, T>>,
  list: readonly T[],
  key: (t: T) => string,
): Map<string, T> {
  let m = cache.get(list);
  if (!m) {
    m = new Map();
    for (const t of list) if (!m.has(key(t))) m.set(key(t), t);
    cache.set(list, m);
  }
  return m;
}

/**
 * What a gate row says when it resolves, or null when its item is unknown.
 * A meaning gate says the reading this run's first reading gate for the
 * kanji would show (`shownReading` at the reading's seen count); a re-ask is
 * an ordinary row and says the same as its gate.
 */
export function spoken(row: GateRow, ctx: SpeechContext): Spoken | null {
  if (row.type === "kana") return self(row.prompt);
  if (row.type === "reading") return self(plainReading(row.answer));
  if (row.type === "meaning") {
    const k = byKey(kanjiMaps, ctx.kanji, (x) => x.char).get(row.prompt);
    if (!k || mainReadings(k).length === 0) return null;
    const turn = ctx.progress.items[itemKey(k.char, "reading")]?.seen ?? 0;
    return self(plainReading(showReading(shownReading(k, turn))));
  }
  const w = byKey(wordMaps, ctx.words, (x) => x.word).get(row.prompt);
  return w ? wordSpoken(w) : null;
}

/**
 * The clip key: `text|reading`, katakana in `reading` folded to hiragana
 * except for loanwords (a katakana text that is its own reading). Stable
 * across builds: the clip build and the game both use it.
 */
export function clipKey(s: Spoken): string {
  const loan = s.text === s.reading && isKatakana(s.text);
  return `${s.text}|${loan ? s.reading : toHiragana(s.reading)}`;
}

/** Every line the game can say, once per clip key: all kana, every kanji's main readings, every word and loanword. */
export function allSpoken(data: {
  kana: readonly KanaItem[];
  kanji: readonly KanjiItem[];
  words: readonly WordItem[];
}): Spoken[] {
  const out = new Map<string, Spoken>();
  const add = (s: Spoken): void => {
    const key = clipKey(s);
    if (!out.has(key)) out.set(key, s);
  };
  for (const k of data.kana) add(self(k.char));
  for (const k of data.kanji)
    for (const r of mainReadings(k)) add(self(plainReading(showReading(r))));
  for (const w of data.words) add(wordSpoken(w));
  return [...out.values()];
}
