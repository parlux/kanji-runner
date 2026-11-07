import type { Mnemonics } from "../core/study";

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
