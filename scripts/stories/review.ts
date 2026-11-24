/// <reference types="node" />
/**
 * Seed and apply for the review page (SPEC-own-stories: Review page).
 *
 * - `npm run stories:review -- seed parts|sounds|<levels> [--all] [--versions <dir>]`
 *   writes `.data-cache/stories/review/seed-<scope>-NN.json`: JSON arrays of at
 *   most 50 `ArtifactData` batch writes (`set` on `items`), each file under
 *   1 MiB. `<levels>` are game levels (`N` or `A-B`); scope is `kanji-NN`.
 *   Pilot levels (`PILOT_LEVELS`) seed every kanji (`all`); later levels seed
 *   the kanji the judge failed (`judge-fail`) plus `RANDOM_PER_LEVEL` seeded
 *   random others (`random`); `--all` adds the rest as `extra`.
 *   `--versions <dir>` (an `items` listing saved with `out_dir`) adds
 *   `pass + 1` for items that already exist, and `if_version` from
 *   `--version-list <file>` (the listing's tool output saved as text: saved
 *   files carry no version, the output's `"<id>" … version N` lines do).
 *   `--bump <ids.json>` (a JSON array of doc ids) limits the `pass + 1` to
 *   those ids; other existing items keep their `pass` (and get `if_version`).
 *   `seed parts` puts the part `note`, and with `--renames <file>` (the
 *   `rename` input, `[{ part, from, to, why }]`) `was` (the old name).
 * - `rename <file>`: applies part renames (parts.json and every story's
 *   `<part>` text, as `apply`'s edit does) and lists the touched stories.
 * - `apply <dir> [--items <dir>]`: see the second half of this file.
 *
 * Nothing here carries WaniKani text: `close` reasons are never copied.
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { KANJI, maxLevel } from "../../src/core/kanji";
import { levelName } from "../../src/core/progression";
import type { KanjiItem } from "../../src/core/types";
import { showReading } from "../../src/core/distractors";
import { DICTIONARY, parseLevels, storyFile } from "./levels";

const OUT = ".data-cache/stories/review";
const CACHE = ".data-cache/stories";
/** Game levels whose every kanji is reviewed (Kanji 5 and 6). */
export const PILOT_LEVELS: readonly number[] = [6, 7];
export const RANDOM_PER_LEVEL = 10;
const USES = 8;
const MAX_WRITES = 50;
const MAX_BYTES = 1024 * 1024 - 4096;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj =>
  typeof v === "object" && v !== null && !Array.isArray(v);

export type Why = "all" | "judge-fail" | "random" | "extra";
export type Verdict = "pass" | "wrong" | "weak" | "close";
/** The judge's first-pass verdict; `reason` only for `wrong` and `weak`. */
export type JudgeNote = { verdict: Verdict; reason?: string };

export type ItemData = {
  kind: "part" | "sound" | "story";
  key: string;
  pass: number;
  why: Why;
  uses?: string[];
  /** Parts: the first game level with a kanji that uses it. */
  first?: number;
  name?: string;
  keyword?: string;
  note?: string;
  /** Other names the page offers as chips (review only). */
  alts?: string[];
  /** Part's old name, when it was renamed. */
  was?: string;
  level?: string;
  glosses?: string[];
  on?: string | null;
  kun?: string | null;
  parts?: { part: string; name: string | null }[];
  text?: { meaning?: string; on?: string; kun?: string };
  judge?: JudgeNote;
};
export type Write = {
  op: "set";
  collection: "items";
  doc_id: string;
  data: ItemData;
  if_version?: number;
};

const hex = (s: string): string =>
  [...s].map((c) => (c.codePointAt(0) as number).toString(16)).join("-");
export const partId = (p: string): string => `part-${hex(p)}`;
export const soundId = (s: string): string => `sound-${hex(s)}`;
export const storyId = (c: string): string => `story-${hex(c)}`;

/** The glyph or kana an item id stands for, or null for a malformed id. */
export function idKey(
  id: string,
): { kind: ItemData["kind"]; key: string } | null {
  const m = /^(part|sound|story)-([0-9a-f]+(?:-[0-9a-f]+)*)$/.exec(id);
  if (!m) return null;
  const key = String.fromCodePoint(
    ...(m[2] as string).split("-").map((h) => parseInt(h, 16)),
  );
  return { kind: m[1] as ItemData["kind"], key };
}

// --- judge files -----------------------------------------------------------

/** What a judge file says about one kanji: the first round's verdict and whether any round failed it. */
export type JudgeSummary = { first: JudgeNote; failed: boolean };

const VERDICTS = new Set<string>(["wrong", "weak", "close"]);

/** One entry: `"pass"`, `"wrong"`…, or `{ verdict: "pass"|"fail"|<reason>, reason?, text? }`. */
function entryVerdict(e: unknown): JudgeNote | null {
  const v = typeof e === "string" ? e : isObj(e) ? e.verdict : undefined;
  const cat = isObj(e) && typeof e.reason === "string" ? e.reason : undefined;
  const text = isObj(e)
    ? [e.text, e.note, e.detail, e.why].find(
        (t): t is string => typeof t === "string",
      )
    : undefined;
  let kind: string | undefined;
  if (v === "pass") return { verdict: "pass" };
  if (typeof v === "string" && VERDICTS.has(v)) kind = v;
  else if (v === "fail") kind = cat && VERDICTS.has(cat) ? cat : "weak";
  if (!kind) return null;
  const out: JudgeNote = { verdict: kind as Verdict };
  // `close` reasons can quote WaniKani: never kept.
  if (kind !== "close") {
    const reason = text ?? (cat && !VERDICTS.has(cat) ? cat : undefined);
    if (reason) out.reason = reason;
  }
  return out;
}

/** A judge file may be one round, `{ kanji: {...} }`, `{ rounds: [...] }` or an array of rounds. */
export function parseJudge(raw: unknown): Map<string, JudgeSummary> {
  const rounds = Array.isArray(raw)
    ? raw
    : isObj(raw) && Array.isArray(raw.rounds)
      ? raw.rounds
      : [raw];
  const out = new Map<string, JudgeSummary>();
  for (const r of rounds) {
    const round = isObj(r) && isObj(r.kanji) ? r.kanji : r;
    if (!isObj(round)) continue;
    for (const [c, e] of Object.entries(round)) {
      const v = entryVerdict(e);
      if (!v) continue;
      const prev = out.get(c);
      out.set(c, {
        first: prev?.first ?? v,
        failed: (prev?.failed ?? false) || v.verdict !== "pass",
      });
    }
  }
  return out;
}

// --- sampling --------------------------------------------------------------

/** Small seeded PRNG (mulberry32): 0 ≤ x < 1. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** `n` of `list`, picked by a PRNG keyed by `seed`; the same input gives the same picks. */
export function seededPick<T>(
  list: readonly T[],
  n: number,
  seed: number,
): T[] {
  const a = [...list];
  const rnd = prng(seed);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a.slice(0, n);
}

/** Why each kanji of a level is seeded, in teaching order; kanji left out are not reviewed. */
export function sample(
  level: number,
  chars: readonly string[],
  judge: ReadonlyMap<string, JudgeSummary> | null,
  all: boolean,
): Map<string, Why> {
  const out = new Map<string, Why>();
  if (PILOT_LEVELS.includes(level)) {
    for (const c of chars) out.set(c, "all");
    return out;
  }
  const fails = chars.filter((c) => {
    const j = judge?.get(c);
    return j && (j.failed || j.first.verdict !== "pass");
  });
  for (const c of fails) out.set(c, "judge-fail");
  const picks = new Set(
    seededPick(
      chars.filter((c) => !out.has(c)),
      RANDOM_PER_LEVEL,
      level,
    ),
  );
  for (const c of chars) if (picks.has(c)) out.set(c, "random");
  if (all) for (const c of chars) if (!out.has(c)) out.set(c, "extra");
  return new Map(
    chars.filter((c) => out.has(c)).map((c) => [c, out.get(c) as Why]),
  );
}

// --- items -----------------------------------------------------------------

const asNames = (
  v: unknown,
  field: string,
): Map<string, { text: string; note?: string; alts?: string[] }> => {
  const out = new Map<
    string,
    { text: string; note?: string; alts?: string[] }
  >();
  if (isObj(v))
    for (const [k, e] of Object.entries(v))
      if (isObj(e) && typeof e[field] === "string")
        out.set(k, {
          text: e[field] as string,
          note: typeof e.note === "string" ? e.note : undefined,
          alts:
            Array.isArray(e.alts) && e.alts.length
              ? (e.alts as string[])
              : undefined,
        });
  return out;
};

/** `{ first }`: the lowest game level of a kanji using part `p`, or `{}` if none. */
export function firstLevel(
  kanji: readonly KanjiItem[],
  p: string,
): { first?: number } {
  const ls = kanji.filter((k) => k.components.includes(p)).map((k) => k.level);
  return ls.length ? { first: Math.min(...ls) } : {};
}

/** `was`: part glyph → old name, for renamed parts. */
export function partItems(
  parts: unknown,
  kanji: readonly KanjiItem[],
  was: ReadonlyMap<string, string> = new Map(),
): Write[] {
  // `fixed` parts are named by their own meaning (戈 spear, 豕 pig): settled,
  // so they are not put up for review.
  const fixed = (p: string) =>
    isObj(parts) && isObj(parts[p]) && parts[p].fixed === true;
  return [...asNames(parts, "name")]
    .filter(([p]) => !fixed(p))
    .map(([p, { text, note, alts }]) => ({
      op: "set",
      collection: "items",
      doc_id: partId(p),
      data: {
        kind: "part",
        key: p,
        pass: 1,
        why: "all",
        name: text,
        ...(note ? { note } : {}),
        ...(alts ? { alts } : {}),
        ...(was.has(p) ? { was: was.get(p) } : {}),
        ...firstLevel(kanji, p),
        uses: kanji
          .filter((k) => k.components.includes(p))
          .slice(0, USES)
          .map((k) => k.char),
      },
    }));
}

export function soundItems(
  sounds: unknown,
  kanji: readonly KanjiItem[],
): Write[] {
  return [...asNames(sounds, "keyword")].map(([s, { text, note, alts }]) => ({
    op: "set",
    collection: "items",
    doc_id: soundId(s),
    data: {
      kind: "sound",
      key: s,
      pass: 1,
      why: "all",
      keyword: text,
      note: note ?? "",
      ...(alts ? { alts } : {}),
      uses: kanji
        .filter((k) => k.on === s)
        .slice(0, USES)
        .map((k) => k.char),
    },
  }));
}

/** Story items of one level. `file` is the parsed story file, `judge` the parsed judge file or null. */
export function storyItems(
  level: number,
  file: unknown,
  judge: ReadonlyMap<string, JudgeSummary> | null,
  parts: unknown,
  kanji: readonly KanjiItem[],
  all: boolean,
): Write[] {
  const entries = isObj(file) && isObj(file.kanji) ? file.kanji : {};
  const names = asNames(parts, "name");
  const items = kanji.filter(
    (k) => k.level === level && isObj(entries[k.char]),
  );
  const why = sample(
    level,
    items.map((k) => k.char),
    judge,
    all,
  );
  return items.flatMap((k) => {
    const w = why.get(k.char);
    if (!w) return [];
    const e = entries[k.char] as Obj;
    const text: NonNullable<ItemData["text"]> = {};
    for (const f of ["meaning", "on", "kun"] as const)
      if (typeof e[f] === "string") text[f] = e[f] as string;
    const j = judge?.get(k.char)?.first;
    const data: ItemData = {
      kind: "story",
      key: k.char,
      level: levelName(level),
      pass: 1,
      why: w,
      glosses: k.glosses,
      on: k.on,
      kun: k.kun ? showReading(k.kun) : null,
      parts: k.components.map((part) => ({
        part,
        name: names.get(part)?.text ?? null,
      })),
      text,
    };
    if (j) data.judge = j;
    return [
      {
        op: "set",
        collection: "items",
        doc_id: storyId(k.char),
        data,
      } satisfies Write,
    ];
  });
}

// --- batches and versions ---------------------------------------------------

/** Split writes into files of at most 50 writes and under 1 MiB each. */
export function batches(writes: readonly Write[]): Write[][] {
  const out: Write[][] = [];
  let cur: Write[] = [];
  let bytes = 2;
  for (const w of writes) {
    const size = Buffer.byteLength(JSON.stringify(w)) + 2;
    if (cur.length && (cur.length >= MAX_WRITES || bytes + size > MAX_BYTES)) {
      out.push(cur);
      cur = [];
      bytes = 2;
    }
    cur.push(w);
    bytes += size;
  }
  if (cur.length) out.push(cur);
  return out;
}

/** An existing document: its version and the fields (as written on the page). */
export type Existing = { version: number | null; data: Obj };

/** Read a listing saved with `out_dir`: `<dir>/items/<id>.json` or `<dir>/<id>.json`; fields at top level or under `data`. */
export function readListing(dir: string): Map<string, Existing> {
  const sub = ["items", "reviews"].find((c) => existsSync(`${dir}/${c}`));
  const base = sub ? `${dir}/${sub}` : dir;
  const out = new Map<string, Existing>();
  for (const f of readdirSync(base).sort()) {
    if (!f.endsWith(".json")) continue;
    const raw: unknown = JSON.parse(readFileSync(`${base}/${f}`, "utf8"));
    const doc = parseDoc(raw);
    if (doc) out.set(f.slice(0, -5), doc);
  }
  return out;
}

export function parseDoc(raw: unknown): Existing | null {
  if (!isObj(raw)) return null;
  const version = typeof raw.version === "number" ? raw.version : null;
  const data = isObj(raw.data) ? raw.data : raw;
  return { version, data };
}

/** `"<id>" … version N` lines (an `ArtifactData` list result) → versions. */
export function parseVersionList(text: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const m of text.matchAll(
    /"([A-Za-z0-9_\-.~:@+]+)"[^"\n]*version (\d+)/g,
  ))
    out.set(m[1] as string, Number(m[2]));
  return out;
}

/**
 * Writes for items that exist get `if_version` and `pass + 1`; with `bump`,
 * only listed ids get the `+ 1` (the rest keep their current `pass`).
 */
export function withVersions(
  writes: readonly Write[],
  existing: ReadonlyMap<string, Existing>,
  bump?: ReadonlySet<string>,
): Write[] {
  return writes.map((w) => {
    const old = existing.get(w.doc_id);
    if (!old) return w;
    const pass = typeof old.data.pass === "number" ? old.data.pass : 1;
    if (old.version === null)
      throw new Error(
        `${w.doc_id} exists but has no version: pass --version-list`,
      );
    return {
      ...w,
      if_version: old.version,
      data: { ...w.data, pass: !bump || bump.has(w.doc_id) ? pass + 1 : pass },
    };
  });
}

// --- apply -----------------------------------------------------------------

export type FieldVerdict = { verdict: "ok" | "work"; note?: string };
/** A `reviews/<id>` document as the page writes it. */
export type Review = {
  pass: number;
  name?: FieldVerdict;
  keyword?: FieldVerdict;
  meaning?: FieldVerdict;
  on?: FieldVerdict;
  kun?: FieldVerdict;
  /** New part name or sound keyword. */
  edit?: string;
  at?: string;
};
/** One ✗: our current text and the owner's note, nothing else. */
export type Note = { key: string; field: string; note: string; text: string };

const FIELD_NAMES = ["name", "keyword", "meaning", "on", "kun"] as const;

/** A review's fields, or null if it isn't one. */
export function parseReview(raw: unknown): Review | null {
  if (!isObj(raw) || typeof raw.pass !== "number") return null;
  const r: Review = { pass: raw.pass };
  for (const f of FIELD_NAMES) {
    const v = raw[f];
    if (isObj(v) && (v.verdict === "ok" || v.verdict === "work"))
      r[f] = {
        verdict: v.verdict,
        ...(typeof v.note === "string" ? { note: v.note } : {}),
      };
  }
  if (typeof raw.edit === "string") r.edit = raw.edit;
  if (typeof raw.at === "string") r.at = raw.at;
  return r;
}

export type Files = {
  parts: Record<string, Obj>;
  sounds: Record<string, Obj>;
  /** Story files by file name, as parsed: `{ level, kanji: { char: { meaning, on, kun } } }`. */
  stories: Record<string, Obj>;
};
export type Scope = {
  reviewed: number;
  ok: number;
  work: number;
  edits: number;
};
export type ApplyResult = {
  files: Files;
  /** Names of the files that changed: `parts.json`, `sounds.json`, `stories/kanji-NN.json`. */
  changed: string[];
  notes: Record<string, Note[]>;
  renames: { part: string; from: string; to: string; touched: string[] }[];
  keywords: { sound: string; from: string; to: string }[];
  rejected: string[];
  /** Reviews of an older pass than the item's (needs the items listing): ignored. */
  stale: string[];
  scopes: Record<string, Scope>;
  /** `random` stories with any ✗, by scope (needs the items listing). */
  randomMisses: Record<string, number> | null;
};

const MAX_WORDS = 3;

/** Why a new name or keyword can't be used, or null. `others` are the other names in use. */
export function nameProblem(
  name: string,
  others: Iterable<string>,
): string | null {
  const t = name.trim();
  if (!t) return "empty";
  if (t.split(/\s+/).length > MAX_WORDS) return `over ${MAX_WORDS} words`;
  for (const o of others)
    if (o.trim().toLowerCase() === t.toLowerCase()) return "already used";
  return null;
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const textOf = (v: unknown, f: string): string =>
  isObj(v) && typeof v[f] === "string" ? (v[f] as string) : "";

/**
 * Replace `<part>from</part>` with `<part>to</part>` in every story; returns the
 * touched kanji and adds the changed `stories/<file>` names to `changed`.
 * Shared by `apply`'s edit path and `rename`.
 */
function rewriteStories(
  files: Files,
  from: string,
  to: string,
  changed: Set<string>,
): string[] {
  const touched: string[] = [];
  for (const [file, f] of Object.entries(files.stories)) {
    if (!isObj(f.kanji)) continue;
    for (const [c, e] of Object.entries(f.kanji)) {
      let hit = false;
      if (isObj(e))
        for (const t of ["meaning", "on", "kun"]) {
          const v = e[t];
          if (typeof v !== "string") continue;
          const next = v
            .split(`<part>${from}</part>`)
            .join(`<part>${to}</part>`);
          if (next !== v) {
            e[t] = next;
            hit = true;
          }
        }
      if (hit) {
        touched.push(c);
        changed.add(`stories/${file}`);
      }
    }
  }
  return touched;
}

/** One entry of `renames.json`. */
export type Rename = { part: string; from: string; to: string; why: string };

/**
 * Apply renames to the dictionary files (pure: returns new files). Each is
 * checked like an `apply` edit (unique, 1-3 words) plus `from` matching the
 * current name; a bad one is rejected and the rest go on.
 */
export function applyRenames(
  renames: readonly Rename[],
  input: Files,
): Pick<ApplyResult, "files" | "changed" | "renames" | "rejected"> {
  const files = clone(input);
  const res = {
    files,
    changed: [] as string[],
    renames: [] as ApplyResult["renames"],
    rejected: [] as string[],
  };
  const changed = new Set<string>();
  for (const r of renames) {
    const entry = files.parts[r.part];
    if (!entry) {
      res.rejected.push(`${r.part}: not in parts.json`);
      continue;
    }
    const old = textOf(entry, "name");
    if (old !== r.from) {
      res.rejected.push(
        `${r.part}: "from" is "${r.from}", the name is "${old}"`,
      );
      continue;
    }
    const others = Object.entries(files.parts)
      .filter(([key]) => key !== r.part)
      .map(([, v]) => textOf(v, "name"));
    const to = r.to.trim();
    const problem = nameProblem(to, others);
    if (problem) {
      res.rejected.push(`${r.part}: name "${r.to}" rejected (${problem})`);
      continue;
    }
    entry.name = to;
    changed.add("parts.json");
    res.renames.push({
      part: r.part,
      from: old,
      to,
      touched: rewriteStories(files, old, to, changed),
    });
  }
  res.changed = [...changed].sort();
  return res;
}

/**
 * Apply the owner's reviews to the dictionary files (pure: returns new files).
 * `items` (the items listing, by doc id) gives each story's `why`.
 */
export function applyReviews(
  reviews: ReadonlyMap<string, Review>,
  input: Files,
  items: ReadonlyMap<string, Existing> | null,
): ApplyResult {
  const files = clone(input);
  const res: ApplyResult = {
    files,
    changed: [],
    notes: {},
    renames: [],
    keywords: [],
    rejected: [],
    stale: [],
    scopes: {},
    randomMisses: items ? {} : null,
  };
  const changed = new Set<string>();
  const scopeOf = (s: string): Scope =>
    (res.scopes[s] ??= { reviewed: 0, ok: 0, work: 0, edits: 0 });
  const note = (scope: string, n: Note) => (res.notes[scope] ??= []).push(n);
  const storyOf = (c: string): { file: string; entry: Obj } | null => {
    for (const [file, f] of Object.entries(files.stories))
      if (isObj(f.kanji) && isObj(f.kanji[c]))
        return { file, entry: f.kanji[c] as Obj };
    return null;
  };

  for (const [id, r] of [...reviews].sort((a, b) => a[0].localeCompare(b[0]))) {
    const pass = items?.get(id)?.data.pass;
    if (typeof pass === "number" && r.pass < pass) {
      res.stale.push(id);
      continue;
    }
    const k = idKey(id);
    if (!k) {
      res.rejected.push(`${id}: not an item id`);
      continue;
    }
    if (k.kind === "story") {
      const s = storyOf(k.key);
      if (!s) {
        res.rejected.push(`${id}: no story for ${k.key}`);
        continue;
      }
      const scope = s.file.replace(/\.json$/, "");
      const sc = scopeOf(scope);
      sc.reviewed++;
      let miss = false;
      for (const f of ["meaning", "on", "kun"] as const) {
        const v = r[f];
        if (v?.verdict === "work") {
          miss = true;
          note(scope, {
            key: k.key,
            field: f,
            note: v.note ?? "",
            text: textOf(s.entry, f),
          });
        }
      }
      if (miss) sc.work++;
      else sc.ok++;
      if (miss && res.randomMisses && items?.get(id)?.data.why === "random")
        res.randomMisses[scope] = (res.randomMisses[scope] ?? 0) + 1;
      continue;
    }
    const scope = k.kind === "part" ? "parts" : "sounds";
    const dict = k.kind === "part" ? files.parts : files.sounds;
    const field = k.kind === "part" ? "name" : "keyword";
    const entry = dict[k.key];
    const sc = scopeOf(scope);
    if (!entry) {
      res.rejected.push(`${id}: ${k.key} is not in ${scope}.json`);
      continue;
    }
    sc.reviewed++;
    const edit = r.edit?.trim();
    const old = textOf(entry, field);
    if (edit && edit !== old) {
      const others = Object.entries(dict)
        .filter(([key]) => key !== k.key)
        .map(([, v]) => textOf(v, field));
      const problem = nameProblem(edit, others);
      if (problem)
        res.rejected.push(`${k.key}: ${field} "${edit}" rejected (${problem})`);
      else {
        entry[field] = edit;
        changed.add(`${scope}.json`);
        sc.edits++;
        if (k.kind === "sound")
          res.keywords.push({ sound: k.key, from: old, to: edit });
        else {
          const touched = rewriteStories(files, old, edit, changed);
          res.renames.push({ part: k.key, from: old, to: edit, touched });
        }
      }
    }
    const v = r[field];
    if (v?.verdict === "work") {
      sc.work++;
      note(scope, {
        key: k.key,
        field,
        note: v.note ?? "",
        text: textOf(entry, field),
      });
    } else sc.ok++;
  }
  res.changed = [...changed].sort();
  return res;
}

function readFiles(): Files {
  const stories: Record<string, Obj> = {};
  for (const f of readdirSync(`${DICTIONARY}/stories`).sort())
    if (f.endsWith(".json"))
      stories[f] = readJson(`${DICTIONARY}/stories/${f}`) as Obj;
  return {
    parts: readJson(`${DICTIONARY}/parts.json`) as Record<string, Obj>,
    sounds: readJson(`${DICTIONARY}/sounds.json`) as Record<string, Obj>,
    stories,
  };
}

/** Write the changed dictionary files; returns their paths. */
function writeChanged(res: Pick<ApplyResult, "files" | "changed">): string[] {
  const written = res.changed.map((c) => `${DICTIONARY}/${c}`);
  for (const c of res.changed) {
    const data =
      c === "parts.json"
        ? res.files.parts
        : c === "sounds.json"
          ? res.files.sounds
          : res.files.stories[c.slice(8)];
    writeFileSync(`${DICTIONARY}/${c}`, JSON.stringify(data, null, 2) + "\n");
  }
  return written;
}

const printRenames = (renames: ApplyResult["renames"]) => {
  for (const r of renames)
    console.log(
      `part ${r.part}: "${r.from}" → "${r.to}"; re-read stories: ${r.touched.join(" ") || "none"}`,
    );
};

function renameMain(args: string[]) {
  const file = args[0];
  if (!file) throw new Error("usage: stories:review -- rename <renames.json>");
  const raw = readJson(file);
  if (!Array.isArray(raw)) throw new Error(`${file}: expected an array`);
  const list: Rename[] = raw.map((e, i) => {
    if (
      !isObj(e) ||
      typeof e.part !== "string" ||
      typeof e.from !== "string" ||
      typeof e.to !== "string"
    )
      throw new Error(`${file}[${i}]: needs part, from, to, why`);
    return { part: e.part, from: e.from, to: e.to, why: String(e.why ?? "") };
  });
  const res = applyRenames(list, readFiles());
  const written = writeChanged(res);
  if (written.length)
    execFileSync("npx", ["prettier", "--write", ...written], {
      stdio: "ignore",
    });
  printRenames(res.renames);
  for (const m of res.rejected) console.log(`rejected: ${m}`);
  console.log(
    `rename: ${res.renames.length} applied, ${res.rejected.length} rejected`,
  );
  if (res.rejected.length) process.exitCode = 1;
}

function applyMain(args: string[]) {
  const dir = args.find(
    (a, i) => !a.startsWith("--") && args[i - 1] !== "--items",
  );
  if (!dir)
    throw new Error(
      "usage: stories:review -- apply <reviews dir> [--items <items dir>]",
    );
  const itemsDir = args[args.indexOf("--items") + 1];
  const items =
    args.includes("--items") && itemsDir ? readListing(itemsDir) : null;
  const reviews = new Map<string, Review>();
  for (const [id, doc] of readListing(dir)) {
    const r = parseReview(doc.data);
    if (r) reviews.set(id, r);
    else console.warn(`warning: ${id} is not a review, skipped`);
  }
  const res = applyReviews(reviews, readFiles(), items);
  const written = writeChanged(res);
  mkdirSync(CACHE, { recursive: true });
  for (const [scope, notes] of Object.entries(res.notes)) {
    const file = `${CACHE}/notes-${scope}.json`;
    writeFileSync(file, JSON.stringify(notes, null, 2) + "\n");
    written.push(file);
  }
  if (written.length)
    execFileSync("npx", ["prettier", "--write", ...written], {
      stdio: "ignore",
    });
  printRenames(res.renames);
  for (const k of res.keywords)
    console.log(`sound ${k.sound}: "${k.from}" → "${k.to}"`);
  for (const m of res.rejected) console.log(`rejected: ${m}`);
  if (res.stale.length)
    console.log(
      `skipped ${res.stale.length} review(s) older than their item's pass: ${res.stale.join(" ")}`,
    );
  for (const [scope, c] of Object.entries(res.scopes).sort())
    console.log(
      `${scope}: ${c.reviewed} reviewed, ${c.ok} ok, ${c.work} need work, ${c.edits} edited, ${res.notes[scope]?.length ?? 0} notes`,
    );
  if (!res.randomMisses)
    console.log("random-miss count skipped: pass --items <items listing dir>");
  else
    for (const [scope, n] of Object.entries(res.randomMisses).sort())
      console.log(
        `${scope}: ${n} random stories with a ✗${n > 2 ? " → seed the whole level and revisit STYLE.md" : ""}`,
      );
}

// --- CLI -------------------------------------------------------------------

const readJson = (file: string): unknown =>
  JSON.parse(readFileSync(file, "utf8"));

function readJudge(level: number): ReadonlyMap<string, JudgeSummary> | null {
  const file = `${CACHE}/judge-${storyFile(level).slice(6, 8)}.json`;
  if (!existsSync(file)) return null;
  return parseJudge(readJson(file));
}

function writeFiles(scope: string, writes: Write[]): number {
  mkdirSync(OUT, { recursive: true });
  const files = batches(writes);
  files.forEach((b, i) => {
    const name = `${OUT}/seed-${scope}-${String(i + 1).padStart(2, "0")}.json`;
    writeFileSync(name, JSON.stringify(b, null, 1) + "\n");
    console.log(`wrote ${name} (${b.length} items)`);
  });
  return files.length;
}

function seedMain(args: string[]) {
  const flag = (name: string): string | undefined => {
    const i = args.indexOf(name);
    return i < 0 ? undefined : args[i + 1];
  };
  const all = args.includes("--all");
  const vdir = flag("--versions");
  const existing = vdir ? readListing(vdir) : null;
  const vlist = flag("--version-list");
  if (existing && vlist) {
    const versions = parseVersionList(readFileSync(vlist, "utf8"));
    for (const [id, doc] of existing) doc.version ??= versions.get(id) ?? null;
  }
  const bumpFile = flag("--bump");
  const bump = bumpFile
    ? new Set(
        (readJson(bumpFile) as unknown[]).filter(
          (x): x is string => typeof x === "string",
        ),
      )
    : undefined;
  const renamesFile = flag("--renames");
  const was = new Map<string, string>();
  if (renamesFile)
    for (const r of readJson(renamesFile) as Rename[]) was.set(r.part, r.from);
  const valueFlags = ["--versions", "--version-list", "--bump", "--renames"];
  const target = args.find(
    (a, i) => !a.startsWith("--") && !valueFlags.includes(args[i - 1] ?? ""),
  );
  if (!target)
    throw new Error(
      "usage: stories:review -- seed parts|sounds|<levels> [--all] [--versions <dir> --version-list <file>] [--bump <ids.json>] [--renames <renames.json>]",
    );
  const put = (scope: string, writes: Write[]) =>
    writeFiles(scope, existing ? withVersions(writes, existing, bump) : writes);
  if (target === "parts")
    put("parts", partItems(readJson(`${DICTIONARY}/parts.json`), KANJI, was));
  else if (target === "sounds")
    put("sounds", soundItems(readJson(`${DICTIONARY}/sounds.json`), KANJI));
  else {
    const parts = readJson(`${DICTIONARY}/parts.json`);
    for (const level of parseLevels(target, maxLevel(KANJI))) {
      const path = `${DICTIONARY}/stories/${storyFile(level)}`;
      if (!existsSync(path)) {
        console.warn(`warning: ${path} is missing, level skipped`);
        continue;
      }
      const judge = readJudge(level);
      if (!judge && !PILOT_LEVELS.includes(level))
        console.warn(
          `warning: no judge file for ${levelName(level)}: random items only`,
        );
      put(
        storyFile(level).slice(0, -5),
        storyItems(level, readJson(path), judge, parts, KANJI, all),
      );
    }
  }
}

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === "seed") seedMain(rest);
  else if (cmd === "apply") applyMain(rest);
  else if (cmd === "rename") renameMain(rest);
  else {
    console.error(
      "usage: stories:review -- seed <parts|sounds|levels> | apply <dir> | rename <file>",
    );
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
