import data from "../data/kanji.json";
import type { KanjiItem } from "./types";

/** The highest level with any items (the last kanji level). */
export const maxLevel = (kanji: readonly KanjiItem[]): number =>
  kanji.reduce((m, k) => Math.max(m, k.level), 1);

export const KANJI = data as KanjiItem[];
