import { firstReading } from "./distractors";
import {
  groupName,
  groupOf,
  levelItems,
  levelName,
  levelProgress,
  type LevelItem,
} from "./progression";
import { LEARNED_BOX, stageName } from "./srs";
import { kanjiNeeded } from "./words";
import type { KanaItem, KanjiItem, Progress, WordItem } from "./types";

/** One item of a level page (SPEC-run-items §4). */
export type LevelPageItem = {
  /** The char (kana, kanji) or word. */
  key: string;
  kind: "kana" | "kanji" | "word" | "loanword";
  /** Kanji: its first main reading; kanji word: its reading; kana: romaji; loanword: none. */
  reading?: string;
  /** The first gloss; kana: none. */
  meaning?: string;
  /** "M Strong · R Recalled" for two gates, else the single stage. */
  stages: string;
  /** Every gate at LEARNED_BOX or higher. */
  learned: boolean;
};

export type LevelPage = {
  level: number;
  /** "Kanji 1 · Foundations", "Hiragana · Kana". */
  title: string;
  learned: number;
  total: number;
  /** Items whose meaning is learned but reading not (the bar's dim segment). */
  readingToGo: number;
  /** Above the unlocked level: everything is drawn dim. */
  locked: boolean;
  /** Unlearned first, then learned; teaching order within each. */
  items: LevelPageItem[];
};

/**
 * Teaching order: each kanji, then the level's kanji words whose first kanji
 * of this level it is (data order); words without one of the level's kanji
 * after; loanwords last.
 */
function teachingOrder(items: readonly LevelItem[]): LevelItem[] {
  const kanji = items.filter((i) => i.part === "kanji");
  const words = items.filter((i) => i.part === "word");
  const loan = words.filter((i) => i.keys.length === 1);
  const kanjiWords = words.filter((i) => i.keys.length > 1);
  const chars = new Set(kanji.map((k) => k.char));
  const ownerOf = (w: LevelItem): string | undefined =>
    kanjiNeeded(w.char).find((c) => chars.has(c));
  const out: LevelItem[] = items.filter((i) => i.part === "kana");
  for (const k of kanji) {
    out.push(k);
    for (const w of kanjiWords) if (ownerOf(w) === k.char) out.push(w);
  }
  out.push(...kanjiWords.filter((w) => ownerOf(w) === undefined), ...loan);
  return out;
}

/** The level page of `level`: header counts and one row per item. */
export function levelPage(
  progress: Progress,
  level: number,
  kana: readonly KanaItem[],
  kanji: readonly KanjiItem[],
  words: readonly WordItem[] = [],
  meaning = false,
): LevelPage {
  const p = levelProgress(progress, level, kana, kanji, words, meaning);
  const box = (k: string): number => progress.items[k]?.box ?? 0;
  const rows = teachingOrder(
    levelItems(level, kana, kanji, words, meaning),
  ).map((i): LevelPageItem => {
    const stages =
      i.keys.length === 2
        ? `M ${stageName(box(i.keys[0] as string))} · R ${stageName(box(i.keys[1] as string))}`
        : stageName(box(i.keys[0] as string));
    const learned = i.keys.every((k) => box(k) >= LEARNED_BOX);
    const base = { key: i.char, stages, learned };
    if (i.part === "kana") {
      const romaji = kana.find((k) => k.char === i.char)?.romaji;
      return { ...base, kind: "kana", ...(romaji ? { reading: romaji } : {}) };
    }
    if (i.part === "kanji") {
      const k = kanji.find((x) => x.char === i.char);
      const reading = k ? firstReading(k) : undefined;
      return {
        ...base,
        kind: "kanji",
        meaning: k?.glosses[0] ?? "",
        ...(reading ? { reading } : {}),
      };
    }
    const w = words.find((x) => x.word === i.char);
    return {
      ...base,
      kind: w?.reading ? "word" : "loanword",
      meaning: w?.glosses[0] ?? "",
      ...(w?.reading ? { reading: w.reading } : {}),
    };
  });
  return {
    level,
    title: `${levelName(level)} · ${groupName(groupOf(level))}`,
    learned: p.learned,
    total: p.total,
    readingToGo: p.readingToGo,
    locked: level > progress.unlockedLevel,
    items: [
      ...rows.filter((r) => !r.learned),
      ...rows.filter((r) => r.learned),
    ],
  };
}
