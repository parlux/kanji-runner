/// <reference types="node" />
/**
 * The story dictionary validator (SPEC-own-stories: Pipeline):
 * `npm run stories:check [-- <levels>]`. Also runs in `npm test` over the
 * committed dictionary (`tests/data/stories.test.ts`).
 *
 * `validate` is pure: it takes the parsed files and the kanji data and returns
 * errors (fail the check) and warnings (printed for the judge). Without
 * `levels` it checks every story file present; with `levels` it checks only
 * those levels and requires their files to exist.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { KANJI, maxLevel } from "../../src/core/kanji";
import { toHiragana } from "../../src/core/mnemonic";
import { levelName } from "../../src/core/progression";
import type { KanjiItem } from "../../src/core/types";
import { DICTIONARY, fileLevel, parseLevels, storyFile } from "./levels";

/** The dictionary as parsed JSON: `parts.json`, `sounds.json` and story files by file name. */
export type Dictionary = {
  parts: unknown;
  sounds: unknown;
  stories: Record<string, unknown>;
};
export type Report = { errors: string[]; warnings: string[] };

const TAGS = new Set(["part", "kanji", "reading", "ja", "em"]);
const FIELDS = ["meaning", "on", "kun"] as const;
type Field = (typeof FIELDS)[number];
/** Plain-text length bands, in characters. */
export const BANDS: Record<Field, [number, number]> = {
  meaning: [120, 600],
  on: [60, 450],
  kun: [60, 450],
};

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** The text with every tag removed. */
export const plainText = (s: string): string => s.replace(/<[^<>]*>/g, "");

/** Contents of every `<tag>…</tag>` in the text, trimmed. */
function tagged(s: string, tag: string): string[] {
  const re = new RegExp(`<${tag}>([^<]*)</${tag}>`, "g");
  return [...s.matchAll(re)].map((m) => (m[1] ?? "").trim());
}

/** Tag problems: unknown tags, attributes, unbalanced tags, stray angle brackets. */
function tagErrors(s: string): string[] {
  const out: string[] = [];
  const stack: string[] = [];
  for (const m of s.matchAll(/<(\/?)([^<>]*)>/g)) {
    const name = m[2] ?? "";
    if (!TAGS.has(name)) {
      out.push(`bad tag <${m[1]}${name}>`);
      continue;
    }
    if (m[1] === "") stack.push(name);
    else if (stack[stack.length - 1] === name) stack.pop();
    else out.push(`unbalanced </${name}>`);
  }
  if (stack.length) out.push(`unclosed <${stack.join(">, <")}>`);
  if (/[<>]/.test(plainText(s))) out.push("stray < or >");
  return out;
}

const normName = (s: string): string => s.trim().toLowerCase();

/** Part glyph → name, for well-formed entries only. */
function partNames(parts: unknown): Map<string, string> {
  const out = new Map<string, string>();
  if (!isObj(parts)) return out;
  for (const [p, v] of Object.entries(parts))
    if (isObj(v) && typeof v.name === "string") out.set(p, v.name);
  return out;
}

/** Part note band, in characters. */
export const NOTE_BAND: [number, number] = [20, 120];
function checkParts(parts: unknown, kanji: readonly KanjiItem[], r: Report) {
  if (!isObj(parts)) {
    r.errors.push("parts.json: not an object");
    return;
  }
  const seen = new Map<string, string>();
  for (const [p, v] of Object.entries(parts)) {
    const name = isObj(v) ? v.name : undefined;
    if (typeof name !== "string" || !name.trim()) {
      r.errors.push(`parts.json ${p}: needs a "name"`);
      continue;
    }
    const words = name.trim().split(/\s+/).length;
    if (words > 3) r.errors.push(`parts.json ${p}: "${name}" is over 3 words`);
    checkAlts(`parts.json ${p}`, v as Obj, name, r);
    // `sameAs`: the same shape listed under another glyph (⻏ is ⻖ on the
    // right), so it shares that part's name.
    const same = (v as Obj).sameAs;
    if (same !== undefined) {
      const twin = typeof same === "string" ? parts[same] : undefined;
      if (!isObj(twin) || twin.sameAs !== undefined)
        r.errors.push(
          `parts.json ${p}: sameAs "${String(same)}" is not a part`,
        );
      else if (twin.name !== name)
        r.errors.push(
          `parts.json ${p}: sameAs ${String(same)} but named "${name}", not "${String(twin.name)}"`,
        );
    } else {
      const other = seen.get(normName(name));
      if (other)
        r.errors.push(`parts.json ${p}: "${name}" also names ${other}`);
      seen.set(normName(name), p);
    }
    const note = (v as Obj).note;
    if (note === undefined) {
      r.errors.push(`parts.json ${p}: needs a "note"`);
    } else if (typeof note !== "string") {
      r.errors.push(`parts.json ${p}: "note" must be text`);
    } else {
      const len = [...note.trim()].length;
      const [lo, hi] = NOTE_BAND;
      if (len < lo || len > hi)
        r.errors.push(
          `parts.json ${p}: note is ${len} characters, outside ${lo}-${hi}`,
        );
    }
  }
  if (Object.keys(parts).length === 0) return;
  const components = new Set(kanji.flatMap((k) => k.components));
  for (const c of components)
    if (!(c in parts)) r.errors.push(`parts.json: no name for component ${c}`);
  for (const p of Object.keys(parts))
    if (!components.has(p))
      r.warnings.push(`parts.json ${p}: not a component of any kanji`);
}

/** `alts` (review page only): 1-3 other names to offer, each 1-3 words. */
function checkAlts(where: string, v: Obj, name: string, r: Report) {
  const a = v.alts;
  if (a === undefined) return;
  if (
    !Array.isArray(a) ||
    a.length < 1 ||
    a.length > 3 ||
    a.some((x) => typeof x !== "string" || !x.trim())
  ) {
    r.errors.push(`${where}: "alts" must be 1-3 non-empty strings`);
    return;
  }
  for (const x of a as string[]) {
    if (x.trim().split(/\s+/).length > 3)
      r.errors.push(`${where}: alt "${x}" is over 3 words`);
    if (normName(x) === normName(name))
      r.errors.push(`${where}: alt "${x}" is the name itself`);
  }
}

function checkSounds(sounds: unknown, r: Report) {
  if (!isObj(sounds)) {
    r.errors.push("sounds.json: not an object");
    return;
  }
  for (const [s, v] of Object.entries(sounds)) {
    if (!/^[ぁ-ゖー]+$/.test(s))
      r.errors.push(`sounds.json "${s}": key must be hiragana`);
    if (!isObj(v) || typeof v.keyword !== "string" || !v.keyword.trim())
      r.errors.push(`sounds.json ${s}: needs a "keyword"`);
    else if (v.note !== undefined && typeof v.note !== "string")
      r.errors.push(`sounds.json ${s}: "note" must be text`);
    if (isObj(v) && typeof v.keyword === "string" && v.keyword.trim())
      checkAlts(`sounds.json ${s}`, v, v.keyword, r);
  }
}

function checkText(
  where: string,
  field: Field,
  text: string,
  k: KanjiItem,
  names: Map<string, string>,
  r: Report,
) {
  for (const e of tagErrors(text)) r.errors.push(`${where}: ${e}`);
  const len = [...plainText(text)].length;
  const [lo, hi] = BANDS[field];
  if (len < lo || len > hi)
    r.errors.push(`${where}: ${len} characters, outside ${lo}-${hi}`);

  const known = new Set([...names.values()].map(normName));
  const used = new Set(tagged(text, "part").map(normName));
  for (const p of used)
    if (!known.has(p)) r.errors.push(`${where}: part "${p}" not in parts.json`);

  if (field === "meaning") {
    if (tagged(text, "kanji").length === 0)
      r.errors.push(`${where}: no <kanji> meaning word`);
    for (const c of k.components) {
      const name = names.get(c);
      if (name && !used.has(normName(name)))
        r.warnings.push(`${where}: part ${c} "${name}" not named`);
    }
    return;
  }
  const allowed =
    field === "on"
      ? [k.on]
      : k.kun
        ? [k.kun.base, k.kun.base + k.kun.okurigana]
        : [];
  const readings = tagged(text, "reading").map(toHiragana);
  if (readings.length === 0) r.errors.push(`${where}: no <reading>`);
  for (const x of readings)
    if (!allowed.includes(x))
      r.errors.push(`${where}: <reading>${x}</reading> is not ${allowed[0]}`);
}

function checkStoryFile(
  name: string,
  file: unknown,
  kanji: readonly KanjiItem[],
  names: Map<string, string>,
  r: Report,
) {
  const level = fileLevel(name);
  if (level === null || level > maxLevel(kanji)) {
    r.errors.push(`stories/${name}: not a kanji level file`);
    return;
  }
  if (!isObj(file) || !isObj(file.kanji)) {
    r.errors.push(`stories/${name}: needs { "level", "kanji" }`);
    return;
  }
  if (file.level !== levelName(level))
    r.errors.push(`stories/${name}: level should be "${levelName(level)}"`);
  for (const key of Object.keys(file))
    if (key !== "level" && key !== "kanji")
      r.errors.push(`stories/${name}: unexpected key "${key}"`);

  const want = new Map(
    kanji.filter((k) => k.level === level).map((k) => [k.char, k]),
  );
  for (const c of want.keys())
    if (!(c in file.kanji)) r.errors.push(`stories/${name}: ${c} missing`);
  for (const [c, entry] of Object.entries(file.kanji)) {
    const k = want.get(c);
    const where = `stories/${name} ${c}`;
    if (!k) {
      r.errors.push(`${where}: not a kanji of ${levelName(level)}`);
      continue;
    }
    if (!isObj(entry)) {
      r.errors.push(`${where}: not an object`);
      continue;
    }
    for (const key of Object.keys(entry))
      if (!(FIELDS as readonly string[]).includes(key))
        r.errors.push(`${where}: unexpected key "${key}"`);
    const has = { meaning: true, on: k.on !== null, kun: k.kun !== null };
    for (const f of FIELDS) {
      const v = entry[f];
      if (v === undefined) {
        if (has[f]) r.errors.push(`${where}: ${f} missing`);
      } else if (!has[f]) {
        r.errors.push(`${where}: has ${f}, but the kanji has no main ${f}`);
      } else if (typeof v !== "string") {
        r.errors.push(`${where}: ${f} must be text`);
      } else checkText(`${where} ${f}`, f, v, k, names, r);
    }
  }
}

/** Check the dictionary against the kanji data. */
export function validate(
  dict: Dictionary,
  kanji: readonly KanjiItem[],
  levels?: readonly number[],
): Report {
  const r: Report = { errors: [], warnings: [] };
  checkParts(dict.parts, kanji, r);
  checkSounds(dict.sounds, r);
  const names = partNames(dict.parts);
  const files = levels
    ? levels.map(storyFile)
    : Object.keys(dict.stories).sort();
  for (const name of files) {
    if (!(name in dict.stories)) r.errors.push(`stories/${name}: missing`);
    else checkStoryFile(name, dict.stories[name], kanji, names, r);
  }
  return r;
}

/** Read the dictionary folder; unreadable or invalid JSON is reported in `errors`. */
export function loadDictionary(dir: string = DICTIONARY): {
  dict: Dictionary;
  errors: string[];
} {
  const errors: string[] = [];
  const read = (file: string, fallback: unknown): unknown => {
    try {
      return JSON.parse(readFileSync(`${dir}/${file}`, "utf8"));
    } catch (e) {
      errors.push(`${file}: ${(e as Error).message}`);
      return fallback;
    }
  };
  const stories: Record<string, unknown> = {};
  const storyDir = `${dir}/stories`;
  if (existsSync(storyDir))
    for (const f of readdirSync(storyDir).sort())
      if (f.endsWith(".json")) stories[f] = read(`stories/${f}`, null);
  return {
    dict: {
      parts: read("parts.json", {}),
      sounds: read("sounds.json", {}),
      stories,
    },
    errors,
  };
}

function main() {
  const args = process.argv.slice(2);
  const arg = args.find((a) => !a.startsWith("--"));
  const levels = arg ? parseLevels(arg, maxLevel(KANJI)) : undefined;
  const { dict, errors } = loadDictionary();
  const r = validate(dict, KANJI, levels);
  const all = [...errors, ...r.errors];
  for (const w of r.warnings) console.log(`warning: ${w}`);
  for (const e of all) console.log(`error: ${e}`);
  const files = levels ? levels.length : Object.keys(dict.stories).length;
  console.log(
    `stories:check: ${files} level file(s), ${all.length} error(s), ${r.warnings.length} warning(s)`,
  );
  if (all.length) process.exit(1);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
