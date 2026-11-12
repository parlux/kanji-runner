import type { Missed } from "./run";
import type { GateRow, KanaItem, KanjiItem, WordItem } from "./types";

/** WaniKani's mnemonics (raw text). */
export type Mnemonics = { meaning?: string; reading?: string };

/** A WaniKani radical shown on a kanji card. */
export type StoryRadical = {
  /** The radical's character, or null when WaniKani draws it as an image. */
  char: string | null;
  name: string;
  /** SVG URL, only when `char` is null. */
  image: string | null;
};

/** What a story lookup gives for one kanji: stories and WaniKani's radicals. */
export type Story = Mnemonics & { radicals?: readonly StoryRadical[] };

/** One study card: what to learn about an item missed in a run. */
export type StudyCard =
  | {
      kind: "kanji";
      char: string;
      /** English glosses, primary first. */
      meanings: string[];
      /** Main on'yomi, hiragana, or null. */
      on: string | null;
      /** Main kun'yomi as shown on gates, e.g. あ(げる), or null. */
      kun: string | null;
      /** Every reading, for the full picture. */
      readings: string[];
      components: string[];
      mnemonics?: Mnemonics;
      /** WaniKani's radicals in order, when a story lookup has the kanji. */
      radicals?: StoryRadical[];
      /** Answered wrongly in the run; false for a kanji only answered right. */
      missed: boolean;
    }
  | {
      kind: "kana";
      char: string;
      romaji: string;
      script: KanaItem["script"];
      missed: true;
    }
  | {
      kind: "word";
      /** The katakana word. */
      char: string;
      /** English glosses, first is the one shown on gates. */
      meanings: string[];
      /** Each character with its romaji or note, in order. */
      breakdown: WordPart[];
      missed: boolean;
    };

/** One character of a word with how to read it, e.g. ヒ "hi", ー "(long)", ャ "ya (small)". */
export type WordPart = { char: string; note: string };

const SMALL: Record<string, string> = {
  ァ: "ア",
  ィ: "イ",
  ゥ: "ウ",
  ェ: "エ",
  ォ: "オ",
  ャ: "ヤ",
  ュ: "ユ",
  ョ: "ヨ",
};

/** Per-character reading of a word: romaji from `kana`, ー "(long)", ッ "(double next)", small kana "ya (small)". */
export function wordBreakdown(
  word: string,
  kana: readonly KanaItem[],
): WordPart[] {
  const romaji = (c: string) => kana.find((k) => k.char === c)?.romaji ?? "?";
  return [...word].map((char) => {
    if (char === "ー") return { char, note: "(long)" };
    if (char === "ッ") return { char, note: "(double next)" };
    const full = SMALL[char];
    return { char, note: full ? `${romaji(full)} (small)` : romaji(char) };
  });
}

function wordCard(
  w: WordItem,
  missed: boolean,
  kana: readonly KanaItem[],
): StudyCard {
  return {
    kind: "word",
    char: w.word,
    meanings: w.glosses,
    breakdown: wordBreakdown(w.word, kana),
    missed,
  };
}

function kanjiCard(
  k: KanjiItem,
  missed: boolean,
  stories?: ReadonlyMap<string, Story>,
): StudyCard {
  const st = stories?.get(k.char);
  const mn: Mnemonics = {};
  if (st?.meaning) mn.meaning = st.meaning;
  if (st?.reading) mn.reading = st.reading;
  const hasMn = mn.meaning !== undefined || mn.reading !== undefined;
  return {
    kind: "kanji",
    char: k.char,
    meanings: k.glosses,
    on: k.on,
    kun: k.kun
      ? k.kun.okurigana
        ? `${k.kun.base}(${k.kun.okurigana})`
        : k.kun.base
      : null,
    readings: k.readings,
    components: k.components,
    ...(hasMn ? { mnemonics: mn } : {}),
    ...(st?.radicals?.length ? { radicals: [...st.radicals] } : {}),
    missed,
  };
}

/**
 * One card per missed item, in the order first missed, then one card per
 * other kanji in `seen` (the run's kanji, in order), marked not missed. An item
 * missed on several gates (e.g. meaning and reading) gets one card. Items not
 * found in the given lists are skipped. `stories` (mnemonics and radicals, either
 * mode) are attached by character; a kanji missing from it gets today's card.
 */
export function studyCards(
  missed: readonly Missed[],
  kanji: readonly KanjiItem[],
  kana: readonly KanaItem[],
  stories?: ReadonlyMap<string, Story>,
  seen: readonly string[] = [],
  words: readonly WordItem[] = [],
): StudyCard[] {
  const done = new Set<string>();
  const out: StudyCard[] = [];
  for (const m of missed) {
    const key = `${m.type === "kana" || m.type === "word" ? m.type : "kanji"}:${m.prompt}`;
    if (done.has(key)) continue;
    done.add(key);
    if (m.type === "kana") {
      const k = kana.find((x) => x.char === m.prompt);
      if (k)
        out.push({
          kind: "kana",
          char: k.char,
          romaji: k.romaji,
          script: k.script,
          missed: true,
        });
    } else if (m.type === "word") {
      const w = words.find((x) => x.word === m.prompt);
      if (w) out.push(wordCard(w, true, kana));
    } else {
      const k = kanji.find((x) => x.char === m.prompt);
      if (k) out.push(kanjiCard(k, true, stories));
    }
  }
  for (const char of seen) {
    const key = `kanji:${char}`;
    if (done.has(key)) continue;
    done.add(key);
    const k = kanji.find((x) => x.char === char);
    if (k) out.push(kanjiCard(k, false, stories));
  }
  return out;
}

/** The kanji asked on the run's answered gates (not kana or words), in order of first sight. */
export function runKanji(
  rows: readonly GateRow[],
  results: readonly boolean[],
): string[] {
  const out = new Set<string>();
  results.forEach((_, i) => {
    const row = rows[i];
    if (row && row.type !== "kana" && row.type !== "word") out.add(row.prompt);
  });
  return [...out];
}

/** Whether the end screen offers "Study": always after a loss, after a win only if there is a card. */
export const canStudy = (cards: number, won: boolean): boolean =>
  !won || cards > 0;

/**
 * The story lookup for the study screen: the library entry for a kanji, with
 * any mnemonic it lacks filled from the taught-cache mnemonics (WaniKani
 * mode); a kanji only in the taught cache gets those alone. Undefined when
 * neither source exists.
 */
export function storiesWithFallback(
  library: ReadonlyMap<string, Story> | undefined,
  taught: ReadonlyMap<string, Mnemonics> | undefined,
): ReadonlyMap<string, Story> | undefined {
  if (!taught || taught.size === 0) return library;
  const out = new Map<string, Story>(library);
  for (const [char, mn] of taught) {
    const lib = out.get(char);
    const meaning = lib?.meaning ?? mn.meaning;
    const reading = lib?.reading ?? mn.reading;
    out.set(char, {
      ...lib,
      ...(meaning ? { meaning } : {}),
      ...(reading ? { reading } : {}),
    });
  }
  return out;
}

/** The pause screen's look back at the last answered gate: what it asked, what was picked, and its card. */
export type LastAnswer = {
  type: GateRow["type"];
  prompt: string;
  picked: string;
  answer: string;
  correct: boolean;
  card: StudyCard | null;
};

/**
 * The most recently resolved row of a run (`rows[results.length - 1]`) with the
 * option picked (`choice`) and the item's study card, marked missed when wrong.
 * Null before the first answer. Kana cards are always typed `missed: true`, so
 * callers show `correct`, not the card's tag.
 */
export function lastAnswer(
  rows: readonly GateRow[],
  results: readonly boolean[],
  choice: number,
  kanji: readonly KanjiItem[],
  kana: readonly KanaItem[],
  stories?: ReadonlyMap<string, Story>,
  words: readonly WordItem[] = [],
): LastAnswer | null {
  const i = results.length - 1;
  const row = rows[i];
  if (i < 0 || !row) return null;
  const correct = results[i] === true;
  let card: StudyCard | null = null;
  if (row.type === "kana") {
    const k = kana.find((x) => x.char === row.prompt);
    if (k)
      card = {
        kind: "kana",
        char: k.char,
        romaji: k.romaji,
        script: k.script,
        missed: true,
      };
  } else if (row.type === "word") {
    const w = words.find((x) => x.word === row.prompt);
    if (w) card = wordCard(w, !correct, kana);
  } else {
    const k = kanji.find((x) => x.char === row.prompt);
    if (k) card = kanjiCard(k, !correct, stories);
  }
  return {
    type: row.type,
    prompt: row.prompt,
    picked: row.options[choice] ?? "",
    answer: row.answer,
    correct,
    card,
  };
}
