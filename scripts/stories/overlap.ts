/// <reference types="node" />
/**
 * Similarity pre-pass for the judge (SPEC-own-stories: Pipeline).
 *
 * - `npm run stories:overlap -- <levels>`: scores each of our entries against
 *   WaniKani's story for the same kanji (meaning vs meaning mnemonic, on/kun
 *   vs reading mnemonic) and writes `.data-cache/stories/overlap-NNN.txt`,
 *   highest first, marking scores at or over `SUSPECT` as suspects.
 * - `npm run stories:overlap -- --names`: `parts.json` names and `sounds.json`
 *   keywords that equal a WaniKani radical name → `overlap-names.txt`
 *   (listed, not failed).
 *
 * Score (0–1) = mean of
 * - phrasing: shared word 3-grams / 3-grams of the shorter text (grams of
 *   stopwords only don't count), and
 * - rare words: IDF weight of the content words both share / IDF weight of
 *   ours. IDF comes from WaniKani's own stories, so words every story uses
 *   weigh almost nothing.
 * Words that any story of this kanji is bound to use are dropped first: the
 * glosses, the readings (kana and romaji), our part names and WaniKani's
 * radical names, plus English stopwords. Words are lightly stemmed.
 *
 * `SUSPECT` = 0.2, from the made-up fixtures in
 * `tests/data/stories-overlap.test.ts`: a copy scores 1, a copy with a few
 * words changed ~0.6, the same scene in new words (shared rare nouns) ~0.23,
 * an unrelated story with the same parts and meaning ~0.05.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import kana from "../../src/data/kana.json";
import { KANJI, maxLevel } from "../../src/core/kanji";
import { toHiragana } from "../../src/core/mnemonic";
import type { KanjiItem } from "../../src/core/types";
import { DICTIONARY, parseLevels, storyFile } from "./levels";
import { WK_LIBRARY, type WkDigest } from "./wk";

export const SUSPECT = 0.2;
const OUT = ".data-cache/stories";

// prettier-ignore
const STOP = new Set(("a an the and or but if so of to in on at by for with from into onto out up down off over under " +
  "about as is are was were be been being am it its it's this that these those there here then than too very " +
  "i you he she we they me him her us them my your his our their mine yours what which who whom whose when where " +
  "why how all any each every some no not nor only own same just can will would should could may might must shall " +
  "do does did done have has had having get gets got make makes made go goes went say says said one two like " +
  "now also more most much many such even still again ever never always back away around through while because " +
  "yes oh just don't can't won't isn't you're that's let's").split(" "));

const ROMAJI = new Map(
  kana.filter((k) => k.script === "hiragana").map((k) => [k.char, k.romaji]),
);

/** Hepburn-ish romaji for kana, with long vowels kept (しょう → shou). */
export function romaji(s: string): string {
  let out = "";
  let double = false;
  for (const c of toHiragana(s)) {
    const small = { ゃ: "a", ゅ: "u", ょ: "o" }[c];
    if (small) {
      out = /(sh|ch|j)i$/.test(out)
        ? out.slice(0, -1) + small
        : out.slice(0, -1) + "y" + small;
    } else if (c === "っ") double = true;
    else {
      const r = ROMAJI.get(c) ?? "";
      out += (double ? (r[0] ?? "") : "") + r;
      double = false;
    }
  }
  return out;
}

const stem = (w: string): string =>
  w.length > 4 ? w.replace(/(ing|ed|es|s)$/, "") : w;

/** Lower-case, stemmed English words of a story, tags dropped. */
export function words(text: string): string[] {
  const plain = text.replace(/<[^<>]*>/g, " ").toLowerCase();
  return [...plain.matchAll(/[a-z]+(?:'[a-z]+)?/g)].map((m) =>
    stem(m[0].replace(/'s$/, "")),
  );
}

/** Words any story of this kanji is bound to use. */
export function ignoreFor(k: KanjiItem, names: readonly string[]): Set<string> {
  const out = new Set<string>();
  for (const t of [...k.glosses, ...names])
    for (const w of words(t)) out.add(w);
  const kanaReadings = [k.on, k.kun?.base, ...k.readings].filter(
    (r): r is string => !!r,
  );
  for (const r of kanaReadings) {
    const ro = romaji(r);
    for (const v of [ro, ro.replace(/ou/g, "o").replace(/uu/g, "u")])
      out.add(stem(v));
  }
  return out;
}

/** Inverse document frequency over a corpus; unseen words weigh the most. */
export function buildIdf(docs: readonly string[]): (w: string) => number {
  const df = new Map<string, number>();
  for (const d of docs)
    for (const w of new Set(words(d))) df.set(w, (df.get(w) ?? 0) + 1);
  const n = docs.length;
  return (w) => Math.log((n + 1) / ((df.get(w) ?? 0) + 1));
}

export type Similarity = { score: number; grams: string[]; words: string[] };

export function similarity(
  ours: string,
  theirs: string,
  ignore: ReadonlySet<string>,
  idf: (w: string) => number,
): Similarity {
  const keep = (t: string) => words(t).filter((w) => !ignore.has(w));
  const a = keep(ours);
  const b = keep(theirs);
  const grams = (ws: string[]) => {
    const out = new Set<string>();
    for (let i = 0; i + 3 <= ws.length; i++) {
      const g = ws.slice(i, i + 3);
      if (g.some((w) => !STOP.has(w))) out.add(g.join(" "));
    }
    return out;
  };
  const ga = grams(a);
  const gb = grams(b);
  const sharedGrams = [...ga].filter((g) => gb.has(g));
  const gramScore =
    sharedGrams.length / Math.max(1, Math.min(ga.size, gb.size));

  const content = (ws: string[]) =>
    new Set(ws.filter((w) => !STOP.has(w) && w.length >= 3));
  const ca = content(a);
  const cb = content(b);
  const shared = [...ca].filter((w) => cb.has(w));
  const weight = (ws: Iterable<string>) => {
    let s = 0;
    for (const w of ws) s += idf(w);
    return s;
  };
  const rareScore = weight(shared) / Math.max(1e-9, weight(ca));
  return {
    score: (gramScore + rareScore) / 2,
    grams: sharedGrams,
    words: shared.sort((x, y) => idf(y) - idf(x)),
  };
}

type Entry = { meaning?: string; on?: string; kun?: string };
type Names = Record<string, { name?: string; keyword?: string }>;

/** One line per (kanji, field) with a WaniKani counterpart, highest score first. */
export function levelReport(
  level: number,
  kanji: readonly KanjiItem[],
  ours: Record<string, Entry>,
  wk: WkDigest,
  parts: Names,
): string {
  const idf = buildIdf(
    Object.values(wk.kanji).flatMap((k) =>
      [k.meaning, k.reading].filter((t): t is string => !!t),
    ),
  );
  const rows: { s: Similarity; line: string }[] = [];
  for (const k of kanji.filter((x) => x.level === level)) {
    const e = ours[k.char];
    const w = wk.kanji[k.char];
    if (!e || !w) continue;
    const names = [
      ...k.components.map((c) => parts[c]?.name ?? ""),
      ...w.radicals,
    ];
    const ignore = ignoreFor(k, names);
    const pairs: [string, string | undefined, string | null][] = [
      ["meaning", e.meaning, w.meaning],
      ["on", e.on, w.reading],
      ["kun", e.kun, w.reading],
    ];
    for (const [field, a, b] of pairs) {
      if (!a || !b) continue;
      const s = similarity(a, b, ignore, idf);
      const mark = s.score >= SUSPECT ? "SUSPECT" : "ok";
      rows.push({
        s,
        line: `${s.score.toFixed(2)} ${mark.padEnd(7)} ${k.char} ${field.padEnd(7)} grams: ${s.grams.join(" | ") || "-"}; words: ${s.words.slice(0, 8).join(", ") || "-"}`,
      });
    }
  }
  rows.sort((x, y) => y.s.score - x.s.score);
  const suspects = rows.filter((r) => r.s.score >= SUSPECT).length;
  return [
    `overlap ${storyFile(level)}: ${rows.length} entries compared, ${suspects} suspect (score >= ${SUSPECT})`,
    ...rows.map((r) => r.line),
  ].join("\n");
}

/** Our part names and sound keywords that equal a WaniKani radical name. */
export function namesReport(parts: Names, sounds: Names, wk: WkDigest): string {
  const theirs = new Set(wk.radicals.map((n) => n.trim().toLowerCase()));
  const hits = (kind: string, src: Names, key: "name" | "keyword") =>
    Object.entries(src)
      .filter(([, v]) => theirs.has((v[key] ?? "").trim().toLowerCase()))
      .map(([k, v]) => `${kind} ${k} "${v[key]}"`);
  const lines = [
    ...hits("part", parts, "name"),
    ...hits("sound", sounds, "keyword"),
  ];
  return [
    `names shared with WaniKani radicals (listed, not failed): ${lines.length}`,
    ...lines,
  ].join("\n");
}

const readJson = <T>(file: string): T =>
  JSON.parse(readFileSync(file, "utf8")) as T;

function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error("usage: stories:overlap -- <levels> | --names");
    process.exit(1);
  }
  if (!existsSync(WK_LIBRARY)) {
    console.error(`${WK_LIBRARY} missing: run npm run stories:wk first`);
    process.exit(1);
  }
  const wk = readJson<WkDigest>(WK_LIBRARY);
  const parts = readJson<Names>(`${DICTIONARY}/parts.json`);
  if (arg === "--names") {
    const sounds = readJson<Names>(`${DICTIONARY}/sounds.json`);
    const report = namesReport(parts, sounds, wk);
    writeFileSync(`${OUT}/overlap-names.txt`, report + "\n");
    console.log(`${report.split("\n")[0]} → ${OUT}/overlap-names.txt`);
    return;
  }
  for (const level of parseLevels(arg, maxLevel(KANJI))) {
    const file = storyFile(level);
    const path = `${DICTIONARY}/stories/${file}`;
    if (!existsSync(path)) {
      console.log(`${file}: not written yet, skipped`);
      continue;
    }
    const ours = readJson<{ kanji: Record<string, Entry> }>(path).kanji;
    const report = levelReport(level, KANJI, ours, wk, parts);
    const out = `${OUT}/${file.replace(/^kanji-(\d+)\.json$/, "overlap-$1.txt")}`;
    writeFileSync(out, report + "\n");
    console.log(`${report.split("\n")[0]} → ${out}`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
