import type { Mnemonics } from "../core/study";
import type { KanjiItem } from "../core/types";

/** Success or a plain error message; the parser never throws. */
export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export type WkReading = {
  /** Hiragana; kun'yomi may contain "." marking okurigana. */
  reading: string;
  primary: boolean;
  type: "onyomi" | "kunyomi" | "nanori";
};

/** One taught kanji, trimmed to what the game uses. JSON-serialisable. */
export type WkCacheKanji = {
  id: number;
  char: string;
  /** WaniKani's level, for display. */
  level: number;
  /** Primary first, then other accepted meanings, then whitelist; no blacklist. */
  glosses: string[];
  /** Accepted readings only, primary first. */
  readings: WkReading[];
  similarIds: number[];
  mnemonics: Mnemonics;
  hints: Mnemonics;
  srsStage: number;
  /** ISO time the assignment becomes available for review, or null. */
  availableAt: string | null;
};

/** The trimmed cache: only taught kanji, no raw responses. */
export type WkCache = {
  version: 1;
  /** The user's current WaniKani level. */
  level: number;
  kanji: WkCacheKanji[];
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

/** Flatten collection pages into their `data` entries, or null if malformed. */
function entries(pages: unknown): Obj[] | null {
  if (!Array.isArray(pages)) return null;
  const out: Obj[] = [];
  for (const p of pages) {
    if (!isObj(p) || !Array.isArray(p.data)) return null;
    for (const e of p.data) {
      if (!isObj(e) || !isObj(e.data)) return null;
      out.push(e);
    }
  }
  return out;
}

function glosses(d: Obj): string[] | null {
  const meanings = arr(d.meanings).filter(isObj);
  const primary = meanings
    .filter((m) => m.primary === true)
    .map((m) => str(m.meaning));
  const accepted = meanings
    .filter((m) => m.primary !== true && m.accepted_answer === true)
    .map((m) => str(m.meaning));
  const aux = arr(d.auxiliary_meanings).filter(isObj);
  const white = aux
    .filter((m) => m.type === "whitelist")
    .map((m) => str(m.meaning));
  const black = new Set(
    aux.filter((m) => m.type === "blacklist").map((m) => str(m.meaning)),
  );
  const out: string[] = [];
  for (const g of [...primary, ...accepted, ...white]) {
    if (g && !black.has(g) && !out.includes(g)) out.push(g);
  }
  return out.length > 0 ? out : null;
}

function readings(d: Obj): WkReading[] {
  const out: WkReading[] = [];
  for (const r of arr(d.readings).filter(isObj)) {
    const reading = str(r.reading);
    const type = r.type;
    if (
      !reading ||
      r.accepted_answer !== true ||
      (type !== "onyomi" && type !== "kunyomi" && type !== "nanori")
    )
      continue;
    out.push({ reading, primary: r.primary === true, type });
  }
  return out.sort((a, b) => Number(b.primary) - Number(a.primary));
}

const text = (d: Obj, key: string): string | undefined => str(d[key]);

function mn(d: Obj, a: string, b: string): Mnemonics {
  const out: Mnemonics = {};
  const m = text(d, a);
  const r = text(d, b);
  if (m) out.meaning = m;
  if (r) out.reading = r;
  return out;
}

/**
 * Trim `/user`, `/subjects` and `/assignments` responses (every page) to the
 * cache. Keeps only taught kanji: assignment with `srs_stage >= 1`, neither the
 * assignment nor the subject hidden. Malformed input gives an error result.
 */
export function trim(
  user: unknown,
  subjectPages: unknown,
  assignmentPages: unknown,
): Result<WkCache> {
  if (!isObj(user) || !isObj(user.data)) return fail("user: unexpected shape");
  const level = int(user.data.level);
  if (level === undefined || level < 1) return fail("user: missing level");
  const subjects = entries(subjectPages);
  if (!subjects) return fail("subjects: unexpected shape");
  const assignments = entries(assignmentPages);
  if (!assignments) return fail("assignments: unexpected shape");

  const bySubject = new Map<number, Obj>();
  for (const a of assignments) {
    const d = a.data as Obj;
    const id = int(d.subject_id);
    const stage = int(d.srs_stage);
    if (id === undefined || stage === undefined) {
      return fail("assignments: entry missing subject_id or srs_stage");
    }
    if (d.hidden === true || stage < 1) continue;
    const prev = bySubject.get(id);
    if (!prev || stage > (prev.srs_stage as number)) bySubject.set(id, d);
  }

  const kanji: WkCacheKanji[] = [];
  for (const s of subjects) {
    const d = s.data as Obj;
    const id = int(s.id);
    const char = str(d.characters);
    const lvl = int(d.level);
    if (id === undefined || !char || lvl === undefined) {
      return fail("subjects: entry missing id, characters or level");
    }
    if (s.object !== undefined && s.object !== "kanji") continue;
    const a = bySubject.get(id);
    if (!a || (d.hidden_at !== null && d.hidden_at !== undefined)) continue;
    const gl = glosses(d);
    if (!gl) return fail(`subjects: kanji ${id} has no meanings`);
    kanji.push({
      id,
      char,
      level: lvl,
      glosses: gl,
      readings: readings(d),
      similarIds: arr(d.visually_similar_subject_ids).filter(
        (x): x is number => typeof x === "number",
      ),
      mnemonics: mn(d, "meaning_mnemonic", "reading_mnemonic"),
      hints: mn(d, "meaning_hint", "reading_hint"),
      srsStage: a.srs_stage as number,
      availableAt: str(a.available_at) ?? null,
    });
  }
  return { ok: true, value: { version: 1, level, kanji } };
}

/** Per-kanji WaniKani data kept beside the list, not in `KanjiItem`. */
export type WkExtras = {
  srsStage: number;
  /** `available_at <= now`. */
  due: boolean;
  /** Visually similar kanji that are also in the list. */
  similar: string[];
  mnemonics: Mnemonics;
  hints: Mnemonics;
};

export type WkList = {
  level: number;
  /** Taught kanji, ordered by WaniKani level then id. */
  kanji: KanjiItem[];
  extras: Map<string, WkExtras>;
};

const plain = (r: string): string => r.replace(".", "");

/** A kun'yomi as shown on gates; okurigana from WaniKani's ".", else the built-in data. */
function kunReading(
  r: string,
  builtIn: KanjiItem | undefined,
): KanjiItem["kun"] {
  const dot = r.indexOf(".");
  if (dot > 0) return { base: r.slice(0, dot), okurigana: r.slice(dot + 1) };
  const k = builtIn?.kun;
  if (k && (r === k.base || r === k.base + k.okurigana)) return k;
  return { base: r, okurigana: "" };
}

/**
 * Build the WaniKani kanji list and extras from the cache. `now` is epoch ms.
 * A kanji with no on'yomi or kun'yomi (only nanori) is left out, since the
 * reading gate needs one. Built-in data supplies okurigana, components, grade
 * and frequency when the character exists there.
 */
export function buildList(
  cache: WkCache,
  builtIn: readonly KanjiItem[],
  now: number,
): WkList {
  const known = new Map(builtIn.map((k) => [k.char, k]));
  const rows = [...cache.kanji]
    .sort((a, b) => a.level - b.level || a.id - b.id)
    .flatMap((w) => {
      const own = known.get(w.char);
      const on = w.readings.find((r) => r.type === "onyomi");
      const kun = w.readings.find((r) => r.type === "kunyomi");
      if (!on && !kun) return [];
      const item: KanjiItem = {
        char: w.char,
        level: w.level,
        grade: own?.grade ?? 8,
        freq: own?.freq ?? null,
        glosses: w.glosses,
        on: on ? plain(on.reading) : null,
        kun: kun ? kunReading(kun.reading, own) : null,
        readings: [
          ...new Set(
            w.readings
              .filter((r) => r.type !== "nanori")
              .map((r) => plain(r.reading)),
          ),
        ],
        components: own?.components ?? [],
      };
      return [{ w, item }];
    });

  const charById = new Map(rows.map(({ w }) => [w.id, w.char]));
  const extras = new Map<string, WkExtras>();
  for (const { w, item } of rows) {
    const t = w.availableAt === null ? NaN : Date.parse(w.availableAt);
    extras.set(item.char, {
      srsStage: w.srsStage,
      due: t <= now,
      similar: w.similarIds
        .map((id) => charById.get(id))
        .filter((c): c is string => c !== undefined && c !== item.char),
      mnemonics: w.mnemonics,
      hints: w.hints,
    });
  }
  return { level: cache.level, kanji: rows.map((r) => r.item), extras };
}

/**
 * Validate a cache read back from storage (anything could be there). A wrong
 * version or shape gives an error result so the caller can refetch.
 */
export function parseCache(raw: unknown): Result<WkCache> {
  if (!isObj(raw) || raw.version !== 1) return fail("cache: wrong version");
  const level = int(raw.level);
  if (level === undefined || !Array.isArray(raw.kanji)) {
    return fail("cache: unexpected shape");
  }
  const strs = (v: unknown) =>
    Array.isArray(v) && v.every((x) => typeof x === "string");
  const optStr = (v: unknown) => v === undefined || typeof v === "string";
  const mnem = (v: unknown) =>
    isObj(v) && optStr(v.meaning) && optStr(v.reading);
  for (const k of raw.kanji) {
    if (
      !isObj(k) ||
      int(k.id) === undefined ||
      !str(k.char) ||
      int(k.level) === undefined ||
      !strs(k.glosses) ||
      (k.glosses as string[]).length === 0 ||
      !Array.isArray(k.readings) ||
      !k.readings.every(
        (r) =>
          isObj(r) &&
          typeof r.reading === "string" &&
          typeof r.primary === "boolean" &&
          (r.type === "onyomi" || r.type === "kunyomi" || r.type === "nanori"),
      ) ||
      !Array.isArray(k.similarIds) ||
      !k.similarIds.every((x) => typeof x === "number") ||
      !mnem(k.mnemonics) ||
      !mnem(k.hints) ||
      int(k.srsStage) === undefined ||
      !(k.availableAt === null || typeof k.availableAt === "string")
    ) {
      return fail("cache: bad kanji entry");
    }
  }
  return { ok: true, value: raw as WkCache };
}
