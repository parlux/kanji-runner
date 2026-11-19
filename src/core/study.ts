import { plainReading, showReading, mainReadings } from "./distractors";
import { storyReadings } from "./mnemonic";
import type { Missed } from "./run";
import { kanjiNeeded } from "./words";
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
export type Story = Mnemonics & {
  radicals?: readonly StoryRadical[];
  /** WaniKani's `primary: true` readings, hiragana (library only). */
  primaryReadings?: readonly string[];
  /** Single-kanji vocabulary with reading stories, in WaniKani id order (library only). */
  vocab?: readonly StoryVocab[];
  /** One compound story per on'yomi the kanji story and bare-kanji vocabulary miss (library only). */
  compounds?: readonly StoryCompound[];
};

/** A compound word whose reading story stands in for one of the kanji's on'yomi. */
export type StoryCompound = {
  /** The kanji's on'yomi, hiragana. */
  reading: string;
  word: string;
  /** The word's reading that uses the on'yomi, hiragana. */
  wordReading: string;
  story: string;
};

/** A vocabulary entry that can tell one kanji's reading: the word, its accepted readings, its story. */
type StoryVocab = {
  word: string;
  readings: readonly string[];
  story: string;
};

type KanjiCard = Extract<StudyCard, { kind: "kanji" }>;

/** Our own story for one kanji (`dictionary/stories/`): meaning, and one per main reading. */
export type DictEntry = { meaning: string; on?: string; kun?: string };

/** Our own dictionary: part names by component glyph, and story entries by kanji. */
export type Dictionary = {
  parts: ReadonlyMap<string, string>;
  entries: ReadonlyMap<string, DictEntry>;
};

/** A component of a kanji with our name for it. */
export type CardPart = { char: string; name: string };

/** The story for one shown reading. */
type ReadingStory =
  | {
      reading: string;
      source: "kanji" | { word: string; wordReading?: string };
      text: string;
    }
  | { reading: string; none: true };

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
      mnemonics?: { meaning?: string };
      /** One reading story per presented reading, when a story lookup has the kanji. */
      readingStories?: ReadingStory[];
      /** WaniKani's radicals in order, when a story lookup has the kanji. */
      radicals?: StoryRadical[];
      /** Set when the stories are ours (`dictionary/`): headings say "story". */
      own?: true;
      /** With `own`: each component and its name (none for a kanji without components). */
      parts?: CardPart[];
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
      /** The word: katakana, or a kanji word. */
      char: string;
      /** Kanji words: the reading in kana. */
      reading?: string;
      /** English glosses, first is the one shown on gates. */
      meanings: string[];
      /** Loanwords: each character with its romaji or note, in order. Kanji words: each kanji with its first gloss and main readings. */
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

/** Each kanji of a kanji word with its first gloss and main readings: 人 "person; じん, ひと". */
function kanjiBreakdown(word: string, kanji: readonly KanjiItem[]): WordPart[] {
  return kanjiNeeded(word).flatMap((char) => {
    const k = kanji.find((x) => x.char === char);
    return k
      ? [
          {
            char,
            note: [
              k.glosses[0] ?? "",
              mainReadings(k).map(showReading).join(", "),
            ]
              .filter(Boolean)
              .join("; "),
          },
        ]
      : [];
  });
}

function wordCard(
  w: WordItem,
  missed: boolean,
  kana: readonly KanaItem[],
  kanji: readonly KanjiItem[],
): StudyCard {
  return {
    kind: "word",
    char: w.word,
    ...(w.reading ? { reading: w.reading } : {}),
    meanings: w.glosses,
    breakdown: w.reading
      ? kanjiBreakdown(w.word, kanji)
      : wordBreakdown(w.word, kana),
    missed,
  };
}

/** Word meaning and reading gates share one study card per word. */
const isWordType = (t: GateRow["type"]): boolean =>
  t === "word" || t === "wordreading";

/** The story for one shown reading label (あ(げる), じょう): the kanji's own, else a vocabulary one, else (on'yomi) a compound's, else none. */
function readingStory(k: KanjiItem, st: Story, label: string): ReadingStory {
  const plain = plainReading(label);
  const base = label.split("(")[0] ?? label;
  const text = st.reading;
  const set = storyReadings(text, st.primaryReadings);
  if (text && (set.includes(plain) || set.includes(base)))
    return { reading: label, source: "kanji", text };
  const hits = (st.vocab ?? []).filter((v) => v.readings.includes(plain));
  const isOn = !label.includes("(") && label === k.on;
  const okuri = label.includes("(") ? label.slice(base.length + 1, -1) : "";
  const hit = isOn
    ? hits.find((v) => v.word === k.char)
    : (hits.find((v) => v.word === k.char + okuri) ?? hits[0]);
  if (hit)
    return { reading: label, source: { word: hit.word }, text: hit.story };
  const c = isOn ? st.compounds?.find((x) => x.reading === label) : undefined;
  return c
    ? {
        reading: label,
        source: { word: c.word, wordReading: c.wordReading },
        text: c.story,
      }
    : { reading: label, none: true };
}

/** The reading blocks for a kanji card, or undefined when the lookup has nothing on the kanji. */
function readingStories(
  k: KanjiItem,
  st: Story | undefined,
  presented: readonly string[],
): ReadingStory[] | undefined {
  if (!st || !(st.meaning || st.reading || st.vocab?.length)) return undefined;
  // no reading presented (meaning gate): one block per main reading
  const labels =
    presented.length > 0 ? presented : mainReadings(k).map(showReading);
  return labels.length > 0
    ? labels.map((label) => readingStory(k, st, label))
    : undefined;
}

/** The reading blocks from our entry: `on` for the on'yomi label, `kun` for the kun'yomi label, else none. */
function ownReadingStories(
  k: KanjiItem,
  e: DictEntry,
  presented: readonly string[],
): ReadingStory[] | undefined {
  const mains = mainReadings(k).map(showReading);
  const labels = presented.length > 0 ? presented : mains;
  if (labels.length === 0) return undefined;
  return labels.map((label): ReadingStory => {
    const text =
      label === mains[0] && k.on
        ? e.on
        : label === mains[mains.length - 1] && k.kun
          ? e.kun
          : undefined;
    return text
      ? { reading: label, source: "kanji", text }
      : { reading: label, none: true };
  });
}

/** The card for a kanji with an entry in our dictionary. */
function ownCard(
  k: KanjiItem,
  missed: boolean,
  d: Dictionary,
  e: DictEntry,
  presented: readonly string[],
): KanjiCard {
  const rs = ownReadingStories(k, e, presented);
  return {
    ...kanjiCard(k, missed),
    mnemonics: { meaning: e.meaning },
    ...(rs ? { readingStories: rs } : {}),
    own: true,
    ...(k.components.length > 0
      ? {
          parts: k.components.map((char) => ({
            char,
            name: d.parts.get(char) ?? "",
          })),
        }
      : {}),
  };
}

function kanjiCard(
  k: KanjiItem,
  missed: boolean,
  stories?: ReadonlyMap<string, Story>,
  presented: readonly string[] = [],
  dict?: Dictionary,
): KanjiCard {
  const own = dict?.entries.get(k.char);
  if (dict && own) return ownCard(k, missed, dict, own, presented);
  const st = stories?.get(k.char);
  const rs = readingStories(k, st, presented);
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
    ...(st?.meaning ? { mnemonics: { meaning: st.meaning } } : {}),
    ...(rs ? { readingStories: rs } : {}),
    ...(st?.radicals?.length ? { radicals: [...st.radicals] } : {}),
    missed,
  };
}

/**
 * The readings each kanji was shown with on the run's answered reading gates
 * (their `answer` labels), by character, in order of first sight.
 */
export function presentedReadings(
  rows: readonly GateRow[],
  results: readonly boolean[],
): Map<string, string[]> {
  const out = new Map<string, string[]>();
  results.forEach((_, i) => {
    const row = rows[i];
    if (!row || row.type !== "reading") return;
    const list = out.get(row.prompt) ?? [];
    if (!list.includes(row.answer)) list.push(row.answer);
    out.set(row.prompt, list);
  });
  return out;
}

/**
 * One card per missed item, in the order first missed, then one card per
 * other kanji in `seen` (the run's kanji, in order), marked not missed. An item
 * missed on several gates (e.g. meaning and reading) gets one card. Items not
 * found in the given lists are skipped. `presented` (from `presentedReadings`) picks each kanji's reading blocks. `stories` (mnemonics and radicals, either
 * mode) are attached by character; a kanji missing from it gets today's card. `dict` (our own stories) wins over `stories`.
 */
export function studyCards(
  missed: readonly Missed[],
  kanji: readonly KanjiItem[],
  kana: readonly KanaItem[],
  stories?: ReadonlyMap<string, Story>,
  seen: readonly string[] = [],
  words: readonly WordItem[] = [],
  presented: ReadonlyMap<string, readonly string[]> = new Map(),
  dict?: Dictionary,
): StudyCard[] {
  const done = new Set<string>();
  const out: StudyCard[] = [];
  for (const m of missed) {
    const key = `${m.type === "kana" ? "kana" : isWordType(m.type) ? "word" : "kanji"}:${m.prompt}`;
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
    } else if (isWordType(m.type)) {
      const w = words.find((x) => x.word === m.prompt);
      if (w) out.push(wordCard(w, true, kana, kanji));
    } else {
      const k = kanji.find((x) => x.char === m.prompt);
      if (k) out.push(kanjiCard(k, true, stories, presented.get(k.char), dict));
    }
  }
  for (const char of seen) {
    const key = `kanji:${char}`;
    if (done.has(key)) continue;
    done.add(key);
    const k = kanji.find((x) => x.char === char);
    if (k) out.push(kanjiCard(k, false, stories, presented.get(k.char), dict));
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
    if (row && row.type !== "kana" && !isWordType(row.type))
      out.add(row.prompt);
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
  dict?: Dictionary,
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
  } else if (isWordType(row.type)) {
    const w = words.find((x) => x.word === row.prompt);
    if (w) card = wordCard(w, !correct, kana, kanji);
  } else {
    const k = kanji.find((x) => x.char === row.prompt);
    if (k)
      card = kanjiCard(
        k,
        !correct,
        stories,
        row.type === "reading" ? [row.answer] : [],
        dict,
      );
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
