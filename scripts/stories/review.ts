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
 *   `if_version` and `pass + 1` for items that already exist.
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
  name?: string;
  keyword?: string;
  note?: string;
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
): Map<string, { text: string; note?: string }> => {
  const out = new Map<string, { text: string; note?: string }>();
  if (isObj(v))
    for (const [k, e] of Object.entries(v))
      if (isObj(e) && typeof e[field] === "string")
        out.set(k, {
          text: e[field] as string,
          note: typeof e.note === "string" ? e.note : undefined,
        });
  return out;
};

export function partItems(
  parts: unknown,
  kanji: readonly KanjiItem[],
): Write[] {
  return [...asNames(parts, "name")].map(([p, { text }]) => ({
    op: "set",
    collection: "items",
    doc_id: partId(p),
    data: {
      kind: "part",
      key: p,
      pass: 1,
      why: "all",
      name: text,
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
  return [...asNames(sounds, "keyword")].map(([s, { text, note }]) => ({
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
export type Existing = { version: number; data: Obj };

/** Read a listing saved with `out_dir`: `<dir>/items/<id>.json` or `<dir>/<id>.json`; fields at top level or under `data`. */
export function readListing(dir: string): Map<string, Existing> {
  const base = existsSync(`${dir}/items`) ? `${dir}/items` : dir;
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
  return version === null ? null : { version, data };
}

/** Writes for items that exist get `if_version` and `pass + 1`. */
export function withVersions(
  writes: readonly Write[],
  existing: ReadonlyMap<string, Existing>,
): Write[] {
  return writes.map((w) => {
    const old = existing.get(w.doc_id);
    if (!old) return w;
    const pass = typeof old.data.pass === "number" ? old.data.pass : 1;
    return {
      ...w,
      if_version: old.version,
      data: { ...w.data, pass: pass + 1 },
    };
  });
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
  const target = args.find(
    (a, i) => !a.startsWith("--") && args[i - 1] !== "--versions",
  );
  if (!target)
    throw new Error(
      "usage: stories:review -- seed parts|sounds|<levels> [--all] [--versions <dir>]",
    );
  const put = (scope: string, writes: Write[]) =>
    writeFiles(scope, existing ? withVersions(writes, existing) : writes);
  if (target === "parts")
    put("parts", partItems(readJson(`${DICTIONARY}/parts.json`), KANJI));
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
  else {
    console.error(
      "usage: stories:review -- seed <parts|sounds|levels> | apply <dir>",
    );
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
