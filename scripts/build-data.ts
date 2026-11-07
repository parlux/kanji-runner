/// <reference types="node" />
/**
 * Dev-only data build: `npm run data:build`.
 *
 * Downloads KANJIDIC2 and KRADFILE (EDRDG, CC BY-SA 4.0) into the gitignored
 * `.data-cache/` (pass `--refresh` to download again) and writes compact JSON
 * into `src/data/`. Output depends only on the cached files, so running it
 * twice gives identical JSON.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

const CACHE = ".data-cache";
const SOURCES = {
  kanjidic: "http://www.edrdg.org/kanjidic/kanjidic2.xml.gz",
  kradfile: "http://ftp.edrdg.org/pub/Nihongo/kradfile.gz",
};

type Kun = { base: string; okurigana: string };

type RawKanji = {
  char: string;
  /** School grade: 1–6 kyōiku, 8 the rest of Jōyō. */
  grade: number;
  /** Newspaper frequency rank, or null when KANJIDIC2 has none. */
  freq: number | null;
  strokes: number;
  on: string[];
  kun: string[];
  meanings: string[];
};

async function cached(
  name: keyof typeof SOURCES,
  refresh: boolean,
): Promise<Buffer> {
  const url = SOURCES[name];
  const file = `${CACHE}/${url.split("/").pop()}`;
  if (refresh || !existsSync(file)) {
    console.log(`downloading ${url}`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    mkdirSync(CACHE, { recursive: true });
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  return gunzipSync(readFileSync(file));
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Jōyō kanji from KANJIDIC2 (grades 1–6 and 8), in file order. */
export function parseKanjidic(xml: string): RawKanji[] {
  const out: RawKanji[] = [];
  for (const [, body = ""] of xml.matchAll(
    /<character>([\s\S]*?)<\/character>/g,
  )) {
    const grade = Number(/<grade>(\d+)<\/grade>/.exec(body)?.[1] ?? 0);
    if (grade < 1 || grade > 8) continue;
    const all = (re: RegExp) =>
      [...body.matchAll(re)].map((m) => decodeEntities(m[1] ?? ""));
    const freq = /<freq>(\d+)<\/freq>/.exec(body)?.[1];
    out.push({
      char: /<literal>(.*?)<\/literal>/.exec(body)?.[1] ?? "",
      grade,
      freq: freq ? Number(freq) : null,
      strokes: Number(
        /<stroke_count>(\d+)<\/stroke_count>/.exec(body)?.[1] ?? 0,
      ),
      // Drop gairaigo on'yomi such as 打 ダース (dozen).
      on: all(/<reading r_type="ja_on">(.*?)<\/reading>/g).filter(
        (r) => !r.includes("ー"),
      ),
      // Drop katakana kun'yomi, also gairaigo: 粉 デシメートル.
      kun: all(/<reading r_type="ja_kun">(.*?)<\/reading>/g).filter(
        (r) => !/[\u30a0-\u30ff]/.test(r),
      ),
      meanings: all(/<meaning>(.*?)<\/meaning>/g),
    });
  }
  return out;
}

/** Katakana to hiragana; other characters pass through. */
export function toHiragana(s: string): string {
  return s.replace(/[\u30a1-\u30f6]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0x60),
  );
}

/** Kun'yomi `-あ.げる-` → { base: "あ", okurigana: "げる" }. */
export function splitKun(kun: string): Kun {
  const [base = "", okurigana = ""] = toHiragana(
    kun.replace(/^-|-$/g, ""),
  ).split(".");
  return { base, okurigana };
}

/** All readings, normalized and deduped: on'yomi, then kun'yomi in full. */
function allReadings(k: RawKanji): string[] {
  const kun = k.kun.map(splitKun);
  const list = [
    ...k.on.map((r) => toHiragana(r.replace(/^-|-$/g, ""))),
    ...kun.map((r) => r.base + r.okurigana),
  ];
  return [...new Set(list)];
}

/** A meaning with parentheticals removed, or "" when it is not usable as an answer. */
export function cleanGloss(meaning: string): string {
  const g = meaning
    .replace(/\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!g || /^-|-$|radical|kokuji|counter|variant|\bno\.|abbreviation/i.test(g))
    return "";
  return g;
}

const SHORT = 12;
const isShort = (g: string) => g.length <= SHORT && g.split(" ").length <= 2;

/**
 * Glosses with the primary first: the first short clean meaning among the
 * first three, else the shortest clean one of those, else of all meanings.
 * An entry in gloss-overrides.json replaces the primary.
 */
export function pickGlosses(meanings: string[], override?: string): string[] {
  const clean = [...new Set(meanings.map(cleanGloss).filter(Boolean))];
  const head = meanings.slice(0, 3).map(cleanGloss).filter(Boolean);
  const pool = head.length ? head : clean;
  const shortest = [...pool].sort((a, b) => a.length - b.length)[0];
  const primary =
    override ?? pool.find(isShort) ?? shortest ?? meanings[0] ?? "";
  return [primary, ...clean.filter((g) => g !== primary)];
}

/** One entry per line: compact, yet diffs stay readable. Prettier-ignored. */
function writeJsonLines(file: string, items: unknown[]): void {
  const lines = items.map((item) => "  " + JSON.stringify(item));
  writeFileSync(file, "[\n" + lines.join(",\n") + "\n]\n");
}

async function main(): Promise<void> {
  const refresh = process.argv.includes("--refresh");
  const xml = (await cached("kanjidic", refresh)).toString("utf8");
  await cached("kradfile", refresh);
  const raw = parseKanjidic(xml);
  console.log(`${raw.length} Jōyō kanji`);
  const glossOverrides = JSON.parse(
    readFileSync("scripts/gloss-overrides.json", "utf8"),
  ) as Record<string, string>;
  const kanji = raw.map((k) => ({
    char: k.char,
    grade: k.grade,
    freq: k.freq,
    glosses: pickGlosses(k.meanings, glossOverrides[k.char]),
    on: k.on[0] ? toHiragana(k.on[0].replace(/^-|-$/g, "")) : null,
    kun: k.kun[0] ? splitKun(k.kun[0]) : null,
    readings: allReadings(k),
  }));
  writeJsonLines("src/data/kanji.json", kanji);
}

await main();
