import type { Missed } from "./run";
import type { GateRow, KanaItem, KanjiItem } from "./types";

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
    };

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
