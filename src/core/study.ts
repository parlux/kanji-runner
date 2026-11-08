import type { Missed } from "./run";
import type { GateRow, KanaItem, KanjiItem } from "./types";

/** WaniKani's mnemonics (W5); unused for built-in cards. */
export type Mnemonics = { meaning?: string; reading?: string };

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
      /** Answered wrongly in the run; false for a kanji only answered right. */
      missed: boolean;
    }
  | {
      kind: "kana";
      char: string;
      romaji: string;
      script: KanaItem["script"];
      missed: true;
    };

function kanjiCard(
  k: KanjiItem,
  missed: boolean,
  mnemonics?: ReadonlyMap<string, Mnemonics>,
): StudyCard {
  const mn = mnemonics?.get(k.char);
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
    ...(mn ? { mnemonics: mn } : {}),
    missed,
  };
}

/**
 * One card per missed item, in the order first missed, then one card per
 * other kanji in `seen` (the run's kanji, in order), marked not missed. An item
 * missed on several gates (e.g. meaning and reading) gets one card. Items not
 * found in the given lists are skipped. `mnemonics` (WaniKani mode) are
 * attached by character.
 */
export function studyCards(
  missed: readonly Missed[],
  kanji: readonly KanjiItem[],
  kana: readonly KanaItem[],
  mnemonics?: ReadonlyMap<string, Mnemonics>,
  seen: readonly string[] = [],
): StudyCard[] {
  const done = new Set<string>();
  const out: StudyCard[] = [];
  for (const m of missed) {
    const key = `${m.type === "kana" ? "kana" : "kanji"}:${m.prompt}`;
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
    } else {
      const k = kanji.find((x) => x.char === m.prompt);
      if (k) out.push(kanjiCard(k, true, mnemonics));
    }
  }
  for (const char of seen) {
    const key = `kanji:${char}`;
    if (done.has(key)) continue;
    done.add(key);
    const k = kanji.find((x) => x.char === char);
    if (k) out.push(kanjiCard(k, false, mnemonics));
  }
  return out;
}

/** The kanji asked on the run's answered gates, in order of first sight. */
export function runKanji(
  rows: readonly GateRow[],
  results: readonly boolean[],
): string[] {
  const out = new Set<string>();
  results.forEach((_, i) => {
    const row = rows[i];
    if (row && row.type !== "kana") out.add(row.prompt);
  });
  return [...out];
}

/** Whether the end screen offers "Study": always after a loss, after a win only if there is a card. */
export const canStudy = (cards: number, won: boolean): boolean =>
  !won || cards > 0;
