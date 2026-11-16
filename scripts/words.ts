/**
 * Kanji words for gates (SPEC-word-gates): which JMdict entries can be words,
 * and which of them each level teaches. Pure functions, called by
 * `build-data.ts`. Two separate steps:
 *
 * 1. `wordCandidates(jmdictXml, kanji)` → every usable word (`Candidate`),
 *    after the named filters in `FILTERS`, plus how many entries each removed.
 *    No ranking happens here beyond keeping one entry per spelling.
 * 2. `WORD_PICKER(candidates, KANJI_WORDS_PER_LEVEL)` → the words to teach, in
 *    teaching order (level, then rank within the level).
 *
 * `wordReport(removed, chosen)` renders the report for `.data-cache/`.
 *
 * Adding a picker: write a function of type `WordPicker` (it sees only the
 * candidates and the per-level count; `nf` and `pri` are its frequency
 * facts), return the chosen candidates in teaching order, and point
 * `WORD_PICKER` at it. Nothing else needs editing; rebuild the data.
 */
import { cleanGloss, pickGlosses } from "./glosses";

/** What the word build needs of a kanji (a `kanji.json` row). */
export type WordKanji = {
  char: string;
  level: number;
  on: string | null;
  kun: { base: string; okurigana: string } | null;
};

type WordKind = "single" | "okurigana" | "compound";

export type Candidate = {
  word: string;
  /** Kana as JMdict writes it (hiragana, katakana for loan parts). */
  reading: string;
  glosses: string[];
  kind: WordKind;
  /** Highest level of its kanji. */
  level: number;
  /** JMdict `nfXX` of the spelling (1–48, lower is more frequent), or null. */
  nf: number | null;
  /** The spelling's priority tags other than nf (news1, ichi1, …). */
  pri: string[];
};

/** A (spelling, reading) option of one entry, before filtering. */
type Draft = {
  word: string;
  reading: string;
  pri: string[];
  /** First sense: `pos` and `misc` as raw entity text (`&uk;`), glosses. */
  pos: string[];
  misc: string[];
  glosses: string[];
};

const COMMON = /^(news1|ichi1|spec1|spec2|gai1)$/;
const HIRAGANA = /^[\u3041-\u3096]$/;
/** Katakana, small kana and ー. */
const KATAKANA = /^[\u30a1-\u30fa\u30fc]$/;
const isKana = (c: string) => HIRAGANA.test(c) || KATAKANA.test(c);
const MAX_WORD = 6;
const MAX_READING = 7;
const ONLY_AFFIX = new Set(["&pref;", "&suf;", "&ctr;"]);
const OLD_OR_RARE = new Set(["&arch;", "&obs;", "&rare;", "&obsc;"]);

const tags = (body: string, tag: string): string[] =>
  [...body.matchAll(new RegExp(`<${tag}(?: [^>]*)?>(.*?)</${tag}>`, "g"))].map(
    (m) => m[1] ?? "",
  );
const isCommon = (pri: string[]) => pri.some((p) => COMMON.test(p));
const decode = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

type Ctx = { kanji: Map<string, WordKanji> };
type Filter = (d: Draft, ctx: Ctx) => boolean;

/** Kanji characters of a spelling (`々` counts here, not for level). */
const kanjiCount = (word: string) => [...word].filter((c) => !isKana(c)).length;

/** True when the word only repeats its kanji's taught reading (人 ひと). */
function repeatsKanji(d: Draft, ctx: Ctx): boolean {
  const [first = "", ...rest] = [...d.word];
  const k = ctx.kanji.get(first);
  if (!k || !rest.every((c) => HIRAGANA.test(c))) return false;
  const tail = rest.join("");
  if (!tail) return d.reading === k.on || d.reading === k.kun?.base;
  return (
    !!k.kun &&
    tail === k.kun.okurigana &&
    d.reading === k.kun.base + k.kun.okurigana
  );
}

/**
 * The filters, in order; each keeps a draft when it returns true. An entry is
 * counted against the first filter that leaves it no spelling.
 */
const FILTERS = {
  /** Only our kanji, kana and 々; the reading is all kana. */
  characters: (d, ctx) =>
    [...d.word].every((c) => ctx.kanji.has(c) || isKana(c) || c === "々") &&
    d.reading !== "" &&
    [...d.reading].every(isKana),
  /**
   * Has a kanji, and starts with a kanji, katakana, or お/ご then a kanji
   * (drops その上).
   */
  startsWithKanji: (d, ctx) => {
    const [a = "", b = ""] = [...d.word];
    return (
      [...d.word].some((c) => ctx.kanji.has(c)) &&
      (ctx.kanji.has(a) ||
        KATAKANA.test(a) ||
        (/^[おご]$/.test(a) && ctx.kanji.has(b)))
    );
  },
  /** First sense isn't usually written in kana (drops 出来る). */
  notUsuallyKana: (d) => !d.misc.includes("&uk;"),
  /** First sense isn't only a prefix/suffix/counter, nor archaic or rare. */
  usualSense: (d) =>
    !(d.pos.length && d.pos.every((p) => ONLY_AFFIX.has(p))) &&
    !d.misc.some((m) => OLD_OR_RARE.has(m)),
  /** Fits a gate: spelling ≤ 6 characters, reading ≤ 7 kana. */
  fitsGate: (d) =>
    [...d.word].length <= MAX_WORD && [...d.reading].length <= MAX_READING,
  /** The first sense has a usable gloss. */
  usableGloss: (d) => d.glosses.some((g) => cleanGloss(g)),
  /** Not one kanji read as the kanji itself is taught (人 ひと). */
  notRepeatOfKanji: (d, ctx) => !repeatsKanji(d, ctx),
} satisfies Record<string, Filter>;

export type RemovedBy = keyof typeof FILTERS | "duplicateSpelling";

/** The entry's drafts: one per common spelling, with its reading. */
function drafts(entry: string): Draft[] {
  const kebs = [...entry.matchAll(/<k_ele>([\s\S]*?)<\/k_ele>/g)]
    .map((m) => m[1] ?? "")
    .map((k) => ({ keb: tags(k, "keb")[0] ?? "", pri: tags(k, "ke_pri") }))
    .filter((k) => isCommon(k.pri));
  const rebs = [...entry.matchAll(/<r_ele>([\s\S]*?)<\/r_ele>/g)]
    .map((m) => m[1] ?? "")
    .filter((r) => !r.includes("<re_nokanji"))
    .map((r) => ({
      reb: tags(r, "reb")[0] ?? "",
      restr: tags(r, "re_restr"),
      common: isCommon(tags(r, "re_pri")),
    }));
  const sense = /<sense>([\s\S]*?)<\/sense>/.exec(entry)?.[1] ?? "";
  const first = {
    pos: tags(sense, "pos"),
    misc: tags(sense, "misc"),
    glosses: tags(sense, "gloss").map(decode),
  };
  return kebs.map(({ keb, pri }) => {
    const apply = rebs.filter((r) => !r.restr.length || r.restr.includes(keb));
    const reb = (apply.find((r) => r.common) ?? apply[0])?.reb ?? "";
    return { word: keb, reading: reb, pri, ...first };
  });
}

/** Two or more kanji, or any katakana: compound. */
function kindOf(word: string): WordKind {
  if (kanjiCount(word) >= 2 || [...word].some((c) => KATAKANA.test(c)))
    return "compound";
  return [...word].length === 1 ? "single" : "okurigana";
}

const nfOf = (pri: string[]) => {
  const nf = pri.find((p) => /^nf\d\d$/.test(p));
  return nf ? Number(nf.slice(2)) : null;
};

/**
 * Frequency order: `nf` (null after 48), then more priority tags first, then
 * spelling. Used to keep one entry per spelling and by `byFrequency`.
 */
function byRank(a: Candidate, b: Candidate): number {
  return (
    (a.nf ?? 49) - (b.nf ?? 49) ||
    b.pri.length - a.pri.length ||
    (a.word < b.word ? -1 : a.word > b.word ? 1 : 0)
  );
}

function toCandidate(d: Draft, ctx: Ctx): Candidate {
  const level = Math.max(
    ...[...d.word].map((c) => ctx.kanji.get(c)?.level ?? 0),
  );
  return {
    word: d.word,
    reading: d.reading,
    glosses: pickGlosses(d.glosses),
    kind: kindOf(d.word),
    level,
    nf: nfOf(d.pri),
    pri: d.pri.filter((p) => !/^nf\d\d$/.test(p)),
  };
}

/**
 * Candidates from JMdict: per entry with a common kanji spelling, the first
 * common spelling that passes every filter, read with the first common
 * reading that applies to it (else the first that applies). One candidate
 * per spelling (the better-ranked entry). `removed` counts entries per filter.
 */
export function wordCandidates(
  xml: string,
  kanji: WordKanji[],
): { candidates: Candidate[]; removed: Record<RemovedBy, number> } {
  const ctx: Ctx = { kanji: new Map(kanji.map((k) => [k.char, k])) };
  const removed = Object.fromEntries(
    [...Object.keys(FILTERS), "duplicateSpelling"].map((k) => [k, 0]),
  ) as Record<RemovedBy, number>;
  const bySpelling = new Map<string, Candidate>();
  for (const entry of xml.split("<entry>")) {
    if (!entry.includes("<ke_pri>")) continue;
    let left = drafts(entry);
    if (!left.length) continue;
    for (const [name, keep] of Object.entries(FILTERS) as [
      keyof typeof FILTERS,
      Filter,
    ][]) {
      left = left.filter((d) => keep(d, ctx));
      if (!left.length) {
        removed[name]++;
        break;
      }
    }
    const pick = left[0];
    if (!pick) continue;
    const c = toCandidate(pick, ctx);
    const other = bySpelling.get(c.word);
    if (other) removed.duplicateSpelling++;
    if (!other || byRank(c, other) < 0) bySpelling.set(c.word, c);
  }
  return { candidates: [...bySpelling.values()], removed };
}

/**
 * Chooses the words to teach from all candidates: `perLevel` per level (all
 * of a level's candidates when it has fewer), in teaching order (level, then
 * rank within the level).
 */
export type WordPicker = (
  candidates: Candidate[],
  perLevel: number,
) => Candidate[];

/** Kanji words per level (SPEC-word-gates). */
export const KANJI_WORDS_PER_LEVEL = 30;

/** Share of each kind a level aims at; compounds take the rest. */
const MIX: Record<Exclude<WordKind, "compound">, number> = {
  single: 0.25,
  okurigana: 0.25,
};

/**
 * Today's picker: per level, rank by frequency (`byRank`), fill each kind's
 * share (about 25% single, 25% okurigana, 50% compound) from its best-ranked
 * candidates, then any shortfall from the best-ranked of the rest.
 */
export const byFrequency: WordPicker = (candidates, perLevel) => {
  const levels = [...new Set(candidates.map((c) => c.level))].sort(
    (a, b) => a - b,
  );
  return levels.flatMap((level) => {
    const ranked = candidates.filter((c) => c.level === level).sort(byRank);
    const single = Math.floor(perLevel * MIX.single);
    const okurigana = Math.floor(perLevel * MIX.okurigana);
    const share: Record<WordKind, number> = {
      single,
      okurigana,
      compound: perLevel - single - okurigana,
    };
    const chosen = new Set<Candidate>();
    for (const c of ranked) if (share[c.kind]-- > 0) chosen.add(c);
    for (const c of ranked) if (chosen.size < perLevel) chosen.add(c);
    return ranked.filter((c) => chosen.has(c));
  });
};

/** The one picker the build uses; point it at another `WordPicker` to swap. */
export const WORD_PICKER: WordPicker = (candidates, perLevel) =>
  byFrequency(candidates, perLevel);

const LISTED_LEVELS = { from: 2, to: 10 };

/**
 * The word report: total, removals per filter, kind mix per level, and the
 * chosen words of levels 2–10 (`word reading gloss kind`). The first line is
 * the one-line summary the build prints.
 */
export function wordReport(
  removed: Record<RemovedBy, number>,
  chosen: Candidate[],
): string {
  const levels = [...new Set(chosen.map((c) => c.level))].sort((a, b) => a - b);
  const at = (level: number) => chosen.filter((c) => c.level === level);
  const kinds: WordKind[] = ["single", "okurigana", "compound"];
  return [
    `words: ${chosen.length} over ${levels.length} levels`,
    "",
    "# Removed per filter",
    ...Object.entries(removed).map(([name, n]) => `${name} ${n}`),
    "",
    "# Kind mix per level",
    ...levels.map((l) => {
      const ws = at(l);
      const mix = kinds.map(
        (k) => `${k} ${ws.filter((c) => c.kind === k).length}`,
      );
      return `L${l}  ${mix.join("  ")}  (${ws.length})`;
    }),
    ...levels
      .filter((l) => l >= LISTED_LEVELS.from && l <= LISTED_LEVELS.to)
      .flatMap((l) => [
        "",
        `# Level ${l}`,
        ...at(l).map(
          (c) => `${c.word} ${c.reading} ${c.glosses[0] ?? ""} ${c.kind}`,
        ),
      ]),
    "",
  ].join("\n");
}
