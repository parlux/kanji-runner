import data from "../data/loanwords.json";
import { KANJI } from "./kanji";
import { LEARNED_BOX, maxLevel } from "./progression";
import { itemKey } from "./srs";
import { WORDS_PER_LEVEL } from "./tuning";
import type { Progress, WordItem } from "./types";

/** One entry of `loanwords.json`, before its level is assigned. */
export type LoanwordEntry = { word: string; glosses: string[] };

/** Entry i joins kanji level 2 + floor(i / WORDS_PER_LEVEL), capped at `lastLevel`. */
export function assignLevels(
  entries: readonly LoanwordEntry[],
  lastLevel: number,
): WordItem[] {
  return entries.map((e, i) => ({
    word: e.word,
    glosses: e.glosses,
    level: Math.min(2 + Math.floor(i / WORDS_PER_LEVEL), lastLevel),
  }));
}

export const WORDS: WordItem[] = assignLevels(
  data as LoanwordEntry[],
  maxLevel(KANJI),
);

const FULL_SIZE: Record<string, string> = {
  ァ: "ア",
  ィ: "イ",
  ゥ: "ウ",
  ェ: "エ",
  ォ: "オ",
  ッ: "ツ",
  ャ: "ヤ",
  ュ: "ユ",
  ョ: "ヨ",
};

/** The kana a word needs learned: ー dropped, small kana as full size, each once in order. */
export function kanaNeeded(word: string): string[] {
  const chars = [...word]
    .filter((c) => c !== "ー")
    .map((c) => FULL_SIZE[c] ?? c);
  return [...new Set(chars)];
}

/** A word may be asked once its level is unlocked and every kana it needs is learned. */
export function isWordEligible(word: WordItem, progress: Progress): boolean {
  return (
    word.level <= progress.unlockedLevel &&
    kanaNeeded(word.word).every(
      (c) => (progress.items[itemKey(c, "kana")]?.box ?? 0) >= LEARNED_BOX,
    )
  );
}
