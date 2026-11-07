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
      on: all(/<reading r_type="ja_on">(.*?)<\/reading>/g),
      kun: all(/<reading r_type="ja_kun">(.*?)<\/reading>/g),
      meanings: all(/<meaning>(.*?)<\/meaning>/g),
    });
  }
  return out;
}

async function main(): Promise<void> {
  const refresh = process.argv.includes("--refresh");
  const xml = (await cached("kanjidic", refresh)).toString("utf8");
  await cached("kradfile", refresh);
  const raw = parseKanjidic(xml);
  console.log(`${raw.length} Jōyō kanji`);
  const kanji = raw.map((k) => ({
    char: k.char,
    grade: k.grade,
    freq: k.freq,
  }));
  writeFileSync("src/data/kanji.json", JSON.stringify(kanji, null, 2) + "\n");
}

await main();
