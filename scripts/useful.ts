/**
 * Usefulness of a word (SPEC-useful-order): theme membership, everyday
 * speech (TUBELEX rank) and easy text (Tatoeba sentence counts), combined
 * into one `value`. Pure functions; `build-data.ts` does the I/O.
 */
import type { Candidate } from "./words";

/** Weights of the three parts of `value` (tuned in U4). */
export const W_THEME = 3;
export const W_SPOKEN = 1;
export const W_EASY = 0.5;

/** `scripts/themes.json`: situation → words as JMdict spells them. */
export type Themes = Record<string, string[]>;

/**
 * Log-scaled rank in [0, 1]: `1 − log(rank)/log(listSize)`, rank 1-based.
 * 0 when unlisted (null, Infinity or below 1). A one-word list scores its
 * word 1.
 */
export function logScore(rank: number | null, listSize: number): number {
  if (rank === null || !Number.isFinite(rank) || rank < 1) return 0;
  if (listSize <= 1) return rank === 1 ? 1 : 0;
  return Math.max(0, 1 - Math.log(rank) / Math.log(listSize));
}

/** `value = W_THEME·theme + W_SPOKEN·spoken + W_EASY·easy`. */
export function wordValue(parts: {
  theme: boolean;
  spoken: number;
  easy: number;
}): number {
  return (
    W_THEME * (parts.theme ? 1 : 0) +
    W_SPOKEN * parts.spoken +
    W_EASY * parts.easy
  );
}

/** One theme word and the candidate it matched, if any. */
export type ThemeMatch = {
  theme: string;
  word: string;
  candidate: Candidate | null;
  /** True when it matched another kanji spelling of the entry, not `word`. */
  viaSpelling: boolean;
};

/**
 * Matches each theme word to a candidate: by spelling, else by another kanji
 * spelling of a candidate's entry (`Candidate.spellings`).
 */
export function matchThemes(
  themes: Themes,
  candidates: Candidate[],
): ThemeMatch[] {
  const byWord = new Map(candidates.map((c) => [c.word, c]));
  const bySpelling = new Map<string, Candidate>();
  for (const c of candidates)
    for (const s of c.spellings) if (!bySpelling.has(s)) bySpelling.set(s, c);
  return Object.entries(themes).flatMap(([theme, words]) =>
    words.map((word) => {
      const direct = byWord.get(word);
      const other = direct ? undefined : bySpelling.get(word);
      return {
        theme,
        word,
        candidate: direct ?? other ?? null,
        viaSpelling: !!other,
      };
    }),
  );
}

/** Japanese sentences from a Tatoeba export: `id<TAB>lang<TAB>text` rows. */
export function parseTatoeba(tsv: string): string[] {
  return tsv
    .split("\n")
    .map((line) => line.split("\t")[2] ?? "")
    .filter((s) => s !== "");
}

const HAS_KANJI = /[㐀-鿿々]/u;

/**
 * Per candidate, how many sentences contain its spelling or another of its
 * kanji spellings. Sentences are indexed by kanji, and each spelling is only
 * searched for in the sentences holding its rarest kanji.
 */
export function easyCounts(
  sentences: string[],
  candidates: Candidate[],
): Map<Candidate, number> {
  const index = new Map<string, number[]>();
  sentences.forEach((s, i) => {
    for (const c of new Set(s)) {
      if (!HAS_KANJI.test(c)) continue;
      const list = index.get(c);
      if (list) list.push(i);
      else index.set(c, [i]);
    }
  });
  const holding = (spelling: string): number[] => {
    let best: number[] | undefined;
    for (const c of spelling) {
      if (!HAS_KANJI.test(c)) continue;
      const list = index.get(c) ?? [];
      if (!best || list.length < best.length) best = list;
    }
    return (best ?? []).filter((i) => sentences[i]?.includes(spelling));
  };
  return new Map(
    candidates.map((c) => {
      const forms = [c.word, ...c.spellings].filter((s) => HAS_KANJI.test(s));
      const hits = new Set(forms.flatMap(holding));
      return [c, hits.size];
    }),
  );
}

/**
 * 1-based ranks by count, highest first; ties share the rank (1, 2, 2, 4).
 * Count 0 is unlisted (null). `size` is the number of listed words.
 */
export function countRanks<T>(counts: Map<T, number>): {
  ranks: Map<T, number | null>;
  size: number;
} {
  const listed = [...counts].filter(([, n]) => n > 0);
  listed.sort((a, b) => b[1] - a[1]);
  const ranks = new Map<T, number | null>();
  listed.forEach(([item, n], i) => {
    const prev = listed[i - 1];
    ranks.set(
      item,
      prev && prev[1] === n ? (ranks.get(prev[0]) ?? i + 1) : i + 1,
    );
  });
  for (const [item, n] of counts) if (n <= 0) ranks.set(item, null);
  return { ranks, size: listed.length };
}

export type Usefulness = {
  theme: boolean;
  spoken: number;
  easy: number;
  value: number;
};

/**
 * Every candidate's usefulness. `spokenRanks` are 0-based `usageRanks`
 * (Infinity = unlisted) over a list of `usageSize` forms; `easy` are
 * `easyCounts`.
 */
export function usefulness(
  candidates: Candidate[],
  themed: Set<Candidate>,
  spokenRanks: Map<Candidate, number>,
  usageSize: number,
  easy: Map<Candidate, number>,
): Map<Candidate, Usefulness> {
  const { ranks, size } = countRanks(easy);
  return new Map(
    candidates.map((c) => {
      const r = spokenRanks.get(c) ?? Infinity;
      const parts = {
        theme: themed.has(c),
        spoken: logScore(r + 1, usageSize),
        easy: logScore(ranks.get(c) ?? null, size),
      };
      return [c, { ...parts, value: wordValue(parts) }];
    }),
  );
}

const TOP = 100;
const fmt = (n: number) => n.toFixed(2);

/**
 * The useful report: per theme matched/total, the unmatched words, matches
 * through another spelling, and the top 100 candidates by value. The first
 * line is the summary the build prints.
 */
export function usefulReport(
  matches: ThemeMatch[],
  useful: Map<Candidate, Usefulness>,
): string {
  const matched = matches.filter((m) => m.candidate);
  const themes = [...new Set(matches.map((m) => m.theme))];
  const top = [...useful]
    .sort(
      ([a, x], [b, y]) =>
        y.value - x.value || (a.word < b.word ? -1 : a.word > b.word ? 1 : 0),
    )
    .slice(0, TOP);
  const pct = matches.length
    ? Math.round((100 * matched.length) / matches.length)
    : 0;
  return [
    `theme words: ${matched.length} of ${matches.length} match a candidate (${pct}%)`,
    "",
    "# Per theme (matched / total)",
    ...themes.map((t) => {
      const ms = matches.filter((m) => m.theme === t);
      return `${t} ${ms.filter((m) => m.candidate).length} / ${ms.length}`;
    }),
    "",
    "# Unmatched",
    ...matches.filter((m) => !m.candidate).map((m) => `${m.theme}: ${m.word}`),
    "",
    "# Matched through another spelling",
    ...matches
      .filter((m) => m.viaSpelling)
      .map((m) => `${m.theme}: ${m.word} → ${m.candidate?.word ?? ""}`),
    "",
    `# Top ${TOP} by value (value theme spoken easy)`,
    ...top.map(
      ([c, u], i) =>
        `${i + 1}. ${c.word} ${c.reading} ${fmt(u.value)} ${u.theme ? 1 : 0} ${fmt(u.spoken)} ${fmt(u.easy)}`,
    ),
    "",
  ].join("\n");
}
