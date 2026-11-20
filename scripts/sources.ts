/// <reference types="node" />
/**
 * Dev-only data sources shared by `build-data.ts` and `coverage.ts`: the
 * pinned download list, the `.data-cache/` download cache (gzip, xz, bzip2
 * and zip files are unpacked on read), and the KANJIDIC2 and KRADFILE parsers.
 * KRADFILE's flat element lists drive the order and the look-alikes; the
 * parts shown on the study card come from KanjiVG (`kanjivg.ts`).
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

export const CACHE = ".data-cache";
export const SOURCES = {
  kanjidic: "http://www.edrdg.org/kanjidic/kanjidic2.xml.gz",
  kradfile: "http://ftp.edrdg.org/pub/Nihongo/kradfile.gz",
  jmdict: "http://ftp.edrdg.org/pub/Nihongo/JMdict_e.gz",
  /** Kanji element trees (CC BY-SA 3.0), pinned to a release. */
  kanjivg:
    "https://github.com/KanjiVG/kanjivg/releases/download/r20250816/kanjivg-20250816.xml.gz",
  /**
   * Everyday word frequency (SPEC-word-gates `byUsage`): TUBELEX, YouTube
   * subtitles, UniDic 3.1.0 lemmas. Pinned to a commit so builds repeat.
   */
  usage:
    "https://raw.githubusercontent.com/naist-nlp/tubelex/7cb5fb36add76b83a266d1967536e1a1d3faa513/frequencies/tubelex-ja-310-lemma-pos.tsv.xz",
  /**
   * Easy reader for the coverage check (SPEC-useful-order): Aozora Bunko
   * children's stories, public domain, 新字新仮名. Each zip name carries its
   * file revision, so the text is pinned. Unpacked with the `unzip` command.
   */
  gongitsune: "https://www.aozora.gr.jp/cards/000121/files/628_ruby_649.zip",
  tebukuro: "https://www.aozora.gr.jp/cards/000121/files/637_ruby_4095.zip",
  chumon: "https://www.aozora.gr.jp/cards/000081/files/43754_ruby_17594.zip",
  gauche: "https://www.aozora.gr.jp/cards/000081/files/470_ruby_3987.zip",
  kumonoito: "https://www.aozora.gr.jp/cards/000879/files/92_ruby_164.zip",
  /**
   * Easy-text frequency (SPEC-useful-order): Tatoeba's Japanese sentences
   * (CC BY 2.0 FR). A live weekly export that can't be pinned by URL: the
   * cached file is the pin, so `--refresh` may change the counts. Unpacked
   * with the `bzip2` command.
   */
  tatoeba:
    "https://downloads.tatoeba.org/exports/per_language/jpn/jpn_sentences.tsv.bz2",
};

/** The Aozora Bunko stories in `SOURCES`, Shift_JIS text with ruby. */
export const STORIES = [
  "gongitsune",
  "tebukuro",
  "chumon",
  "gauche",
  "kumonoito",
] as const;

export type RawKanji = {
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

export async function cached(
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
  if (file.endsWith(".xz"))
    return execFileSync("xz", ["-dc", file], { maxBuffer: 1 << 30 });
  if (file.endsWith(".bz2"))
    return execFileSync("bzip2", ["-dc", file], { maxBuffer: 1 << 30 });
  if (file.endsWith(".zip"))
    return execFileSync("unzip", ["-p", file, "*.txt"], { maxBuffer: 1 << 30 });
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
function parseKanjidic(xml: string): RawKanji[] {
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

/**
 * KRADFILE writes elements that are not JIS X 0208 characters as a kanji that
 * contains them (化 stands for ⺅). Map those back to the element, per the
 * table in the KRADFILE header, so 休 is not taken to contain 化.
 */
const KRAD_ELEMENTS: Record<string, string> = {
  化: "\u2e85",
  个: "\u{201a2}",
  并: "\u4e37",
  刈: "\u2e89",
  込: "\u2ecc",
  尚: "\u2e8c",
  忙: "\u2e96",
  扎: "\u2e98",
  汁: "\u2ea1",
  犯: "\u2ea8",
  艾: "\u2ebe",
  邦: "\u2ecf",
  阡: "\u2ed6",
  老: "\u2eb9",
  杰: "\u2ea3",
  礼: "\u2ead",
  疔: "\u2f67",
  禹: "\u2f71",
  初: "\u2ec2",
  買: "\u2eb2",
  滴: "\u5547",
  乞: "\u{20089}",
};

/** Jōyō kanji missing from KRADFILE (2010 additions): use their common variant. */
const KRAD_VARIANTS: Record<string, string> = {
  𠮟: "叱",
  塡: "填",
  剝: "剥",
  頰: "頬",
};

/** KRADFILE (EUC-JP): kanji → its elements, excluding itself. */
function parseKradfile(text: string): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const line of text.split("\n")) {
    if (line.startsWith("#") || !line.includes(" : ")) continue;
    const [char = "", rest = ""] = line.split(" : ");
    const parts = rest
      .trim()
      .split(/\s+/)
      .map((e) => KRAD_ELEMENTS[e] ?? e);
    map.set(
      char,
      [...new Set(parts)].filter((e) => e !== char),
    );
  }
  return map;
}

/** The Jōyō kanji and each one's KRADFILE elements, from the cache. */
export async function jouyouKanji(refresh: boolean): Promise<{
  raw: RawKanji[];
  components: Map<string, string[]>;
}> {
  const xml = (await cached("kanjidic", refresh)).toString("utf8");
  const krad = new TextDecoder("euc-jp").decode(
    await cached("kradfile", refresh),
  );
  const kradMap = parseKradfile(krad);
  const raw = parseKanjidic(xml);
  const components = new Map(
    raw.map((k) => [
      k.char,
      kradMap.get(k.char) ?? kradMap.get(KRAD_VARIANTS[k.char] ?? "") ?? [],
    ]),
  );
  return { raw, components };
}
