import type { Story, StoryRadical } from "../core/study";
import type { Result } from "./parse";

/** One kanji's story entry: mnemonics and radicals in WaniKani's order. */
export type StoryKanji = {
  meaning?: string;
  reading?: string;
  radicals: StoryRadical[];
};

/** The story library: every kanji WaniKani has, by character. JSON-serialisable. */
export type StoryLibrary = {
  version: 1;
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

function svgUrl(d: Obj): string | null {
  for (const i of arr(d.character_images).filter(isObj)) {
    if (i.content_type === "image/svg+xml" && str(i.url))
      return i.url as string;
  }
  return null;
}

/**
 * Trim every `/subjects` page (kanji and radicals mixed) to the story library.
 * Hidden subjects are dropped, and so is a kanji with no mnemonics and no
 * radicals. Malformed input gives an error result.
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
    if (!meaning && !reading && rs.length === 0) continue;
    kanji[char] = {
      ...(meaning ? { meaning } : {}),
      ...(reading ? { reading } : {}),
      radicals: rs.map((r) => ({ ...r })),
    };
  }
  return { ok: true, value: { version: 1, kanji } };
}

/** Validate a library read back from storage; wrong version or shape → error. */
export function parseLibrary(raw: unknown): Result<StoryLibrary> {
  if (!isObj(raw) || raw.version !== 1 || !isObj(raw.kanji)) {
    return fail("library: wrong version or shape");
  }
  const optStr = (v: unknown) => v === undefined || typeof v === "string";
  for (const [char, k] of Object.entries(raw.kanji)) {
    if (
      !char ||
      !isObj(k) ||
      !optStr(k.meaning) ||
      !optStr(k.reading) ||
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
