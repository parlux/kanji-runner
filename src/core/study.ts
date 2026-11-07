import type { Missed } from "./run";
import type { KanaItem, KanjiItem } from "./types";

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
    }
  | {
      kind: "kana";
      char: string;
      romaji: string;
      script: KanaItem["script"];
    };

/**
 * One card per missed item, in the order first missed. An item missed on
 * several gates (e.g. meaning and reading) gets one card. Items not found in
 * the given lists are skipped. `mnemonics` (WaniKani mode) are attached by character.
 */
export function studyCards(
  missed: readonly Missed[],
  kanji: readonly KanjiItem[],
  kana: readonly KanaItem[],
  mnemonics?: ReadonlyMap<string, Mnemonics>,
): StudyCard[] {
  const seen = new Set<string>();
  const out: StudyCard[] = [];
  for (const m of missed) {
    const key = `${m.type === "kana" ? "kana" : "kanji"}:${m.prompt}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (m.type === "kana") {
      const k = kana.find((x) => x.char === m.prompt);
      if (k)
        out.push({
          kind: "kana",
          char: k.char,
          romaji: k.romaji,
          script: k.script,
        });
    } else {
      const k = kanji.find((x) => x.char === m.prompt);
      if (k)
        out.push({
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
          ...(mnemonics?.get(k.char)
            ? { mnemonics: mnemonics.get(k.char) }
            : {}),
        });
    }
  }
  return out;
}

/** Whether the end screen offers "Study": always after a loss, after a win only if something was missed. */
export const canStudy = (missed: number, won: boolean): boolean =>
  !won || missed > 0;
