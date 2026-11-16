import { storyReadings, toHiragana } from "../core/mnemonic";
import type { Story, StoryCompound, StoryRadical } from "../core/study";
import type { Result } from "./parse";

/** One kanji's story entry: mnemonics and radicals in WaniKani's order. */
type StoryKanji = {
  meaning?: string;
  reading?: string;
  radicals: StoryRadical[];
  /** WaniKani's `primary: true` readings, hiragana. */
  primaryReadings: string[];
  /** Single-kanji vocabulary with a reading story, in WaniKani id order. */
  vocab: { word: string; readings: string[]; story: string }[];
  /** One compound story per on'yomi the kanji story and bare-kanji vocabulary miss. */
  compounds: StoryCompound[];
};

/** The story library: every kanji WaniKani has, by character. JSON-serialisable. */
export type StoryLibrary = {
  version: 3;
  kanji: Record<string, StoryKanji>;
};

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined =>
  typeof v === "string" && v !== "" ? v : undefined;
const int = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isInteger(v) ? v : undefined;
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const fail = (error: string): { ok: false; error: string } => ({
  ok: false,
  error,
});

/** The highest level to fetch: `subscription.max_level_granted`, else `level`. */
export function storyLevel(user: unknown): Result<number> {
  if (!isObj(user) || !isObj(user.data)) return fail("user: unexpected shape");
  const sub = isObj(user.data.subscription) ? user.data.subscription : {};
  const max = int(sub.max_level_granted);
  const level = max !== undefined && max >= 1 ? max : int(user.data.level);
  if (level === undefined || level < 1) return fail("user: missing level");
  return { ok: true, value: level };
}

const hidden = (d: Obj): boolean =>
  d.hidden_at !== null && d.hidden_at !== undefined;

function primaryName(d: Obj): string | undefined {
  const ms = arr(d.meanings).filter(isObj);
  return str((ms.find((m) => m.primary === true) ?? ms[0])?.meaning);
}

const HAN = /^\p{Script=Han}$/u;
const HIRAGANA = /^\p{Script=Hiragana}+$/u;
/** One kanji followed by zero or more hiragana, e.g. 上 or 上げる. */
const SINGLE_KANJI_WORD = /^\p{Script=Han}\p{Script=Hiragana}*$/u;

function readingsOf(d: Obj, primaryOnly: boolean, type?: string): string[] {
  return arr(d.readings)
    .filter(isObj)
    .filter((r) => !primaryOnly || r.primary === true)
    .filter((r) => type === undefined || r.type === type)
    .map((r) => str(r.reading))
    .filter((r): r is string => r !== undefined && HIRAGANA.test(r));
}

/** A multi-kanji vocabulary word that could lend a story to an on'yomi. */
type Candidate = { word: string; readings: string[]; story: string };

/** Does the word reading use the on'yomi where the kanji sits (first: prefix, last: suffix, else inside)? */
function usesOnyomi(word: string, char: string, wr: string, on: string) {
  const chars = [...word];
  const i = chars.indexOf(char);
  if (i === 0) return wr.startsWith(on);
  if (i === chars.length - 1) return wr.endsWith(on);
  return wr.includes(on);
}

/** The first candidate (already in level, id order) whose story mentions the on'yomi or word reading and whose reading fits. */
function pickCompound(
  char: string,
  on: string,
  words: readonly Candidate[],
): StoryCompound | undefined {
  for (const w of words) {
    const story = toHiragana(w.story);
    for (const wr of w.readings) {
      if (!usesOnyomi(w.word, char, wr, on)) continue;
      if (!story.includes(on) && !story.includes(wr)) continue;
      return { reading: on, word: w.word, wordReading: wr, story: w.story };
    }
  }
  return undefined;
}

function svgUrl(d: Obj): string | null {
  for (const i of arr(d.character_images).filter(isObj)) {
    if (i.content_type === "image/svg+xml" && str(i.url))
      return i.url as string;
  }
  return null;
}

/**
 * Trim every `/subjects` page (kanji and radicals mixed) to the story library.
 * Hidden subjects are dropped, and so is a kanji with no mnemonics, no
 * radicals and no vocabulary. Only single-kanji vocabulary with a reading
 * mnemonic is kept (see SPEC-reading-stories). Malformed input gives an error result.
 */
export function buildLibrary(subjectPages: unknown): Result<StoryLibrary> {
  if (!Array.isArray(subjectPages)) return fail("subjects: unexpected shape");
  const subjects: { id: number; object: unknown; d: Obj }[] = [];
  for (const p of subjectPages) {
    if (!isObj(p) || !Array.isArray(p.data)) return fail("subjects: bad page");
    for (const e of p.data) {
      const id = isObj(e) ? int(e.id) : undefined;
      if (!isObj(e) || id === undefined || !isObj(e.data)) {
        return fail("subjects: bad entry");
      }
      subjects.push({ id, object: e.object, d: e.data });
    }
  }

  const radicals = new Map<number, StoryRadical>();
  for (const { id, object, d } of subjects) {
    if (object !== "radical" || hidden(d)) continue;
    const name = primaryName(d);
    if (!name) continue;
    const char = str(d.characters) ?? null;
    radicals.set(id, { char, name, image: char ? null : svgUrl(d) });
  }

  const vocabByKanji = new Map<string, StoryKanji["vocab"]>();
  const compoundsByKanji = new Map<string, Candidate[]>();
  const vocabSubjects = subjects
    .filter((s) => s.object === "vocabulary")
    .sort((a, b) => a.id - b.id);
  const byLevel = [...vocabSubjects].sort(
    (a, b) =>
      (int(a.d.level) ?? Infinity) - (int(b.d.level) ?? Infinity) ||
      a.id - b.id,
  );
  for (const { d } of byLevel) {
    const word = str(d.characters);
    const story = str(d.reading_mnemonic);
    if (hidden(d) || !word || !story || SINGLE_KANJI_WORD.test(word)) continue;
    const readings = readingsOf(d, false);
    if (readings.length === 0) continue;
    for (const c of new Set([...word].filter((x) => HAN.test(x)))) {
      compoundsByKanji.set(c, [
        ...(compoundsByKanji.get(c) ?? []),
        { word, readings, story },
      ]);
    }
  }
  for (const { d } of vocabSubjects) {
    const word = str(d.characters);
    const story = str(d.reading_mnemonic);
    if (hidden(d) || !word || !story || !SINGLE_KANJI_WORD.test(word)) continue;
    const readings = readingsOf(d, false);
    if (readings.length === 0) continue;
    const key = [...word][0] as string;
    vocabByKanji.set(key, [
      ...(vocabByKanji.get(key) ?? []),
      { word, readings, story },
    ]);
  }

  const kanji: Record<string, StoryKanji> = {};
  for (const { object, d } of subjects) {
    if (object !== "kanji" || hidden(d)) continue;
    const char = str(d.characters);
    if (!char) return fail("subjects: kanji without characters");
    const rs = arr(d.component_subject_ids)
      .map((x) => (typeof x === "number" ? radicals.get(x) : undefined))
      .filter((r): r is StoryRadical => r !== undefined);
    const meaning = str(d.meaning_mnemonic);
    const reading = str(d.reading_mnemonic);
    const vocab = vocabByKanji.get(char) ?? [];
    if (!meaning && !reading && rs.length === 0 && vocab.length === 0) continue;
    const primaryReadings = readingsOf(d, true);
    const covered = new Set([
      ...storyReadings(reading, primaryReadings),
      ...vocab.filter((v) => v.word === char).flatMap((v) => v.readings),
    ]);
    const compounds = [...new Set(readingsOf(d, false, "onyomi"))]
      .filter((on) => !covered.has(on))
      .map((on) => pickCompound(char, on, compoundsByKanji.get(char) ?? []))
      .filter((c): c is StoryCompound => c !== undefined);
    kanji[char] = {
      ...(meaning ? { meaning } : {}),
      ...(reading ? { reading } : {}),
      radicals: rs.map((r) => ({ ...r })),
      primaryReadings,
      vocab: vocab.map((v) => ({ ...v })),
      compounds,
    };
  }
  return { ok: true, value: { version: 3, kanji } };
}

/** Validate a library read back from storage; wrong version or shape → error. */
export function parseLibrary(raw: unknown): Result<StoryLibrary> {
  if (!isObj(raw) || raw.version !== 3 || !isObj(raw.kanji)) {
    return fail("library: wrong version or shape");
  }
  const strArr = (v: unknown) =>
    Array.isArray(v) && v.every((x) => typeof x === "string");
  const optStr = (v: unknown) => v === undefined || typeof v === "string";
  for (const [char, k] of Object.entries(raw.kanji)) {
    if (
      !char ||
      !isObj(k) ||
      !optStr(k.meaning) ||
      !optStr(k.reading) ||
      !strArr(k.primaryReadings) ||
      !Array.isArray(k.vocab) ||
      !k.vocab.every(
        (v) =>
          isObj(v) &&
          typeof v.word === "string" &&
          typeof v.story === "string" &&
          strArr(v.readings),
      ) ||
      !Array.isArray(k.compounds) ||
      !k.compounds.every(
        (c) =>
          isObj(c) &&
          typeof c.reading === "string" &&
          typeof c.word === "string" &&
          typeof c.wordReading === "string" &&
          typeof c.story === "string",
      ) ||
      !Array.isArray(k.radicals) ||
      !k.radicals.every(
        (r) =>
          isObj(r) &&
          (r.char === null || typeof r.char === "string") &&
          typeof r.name === "string" &&
          (r.image === null || typeof r.image === "string"),
      )
    ) {
      return fail("library: bad kanji entry");
    }
  }
  return { ok: true, value: raw as StoryLibrary };
}

/** The lookup `studyCards` takes: character → stories and radicals. */
export const storyLookup = (lib: StoryLibrary): ReadonlyMap<string, Story> =>
  new Map(Object.entries(lib.kanji));
