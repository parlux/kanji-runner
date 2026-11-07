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
/** Kanji levels 2+ hold 30 kanji each (SPEC: Progression and levels). */
const LEVEL_SIZE = 30;
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
export function parseKradfile(text: string): Map<string, string[]> {
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

type OrderOverride = { char: string; before?: string; after?: string };

/**
 * Progression order: grade, then frequency (unranked last, then by strokes and
 * code point), then the component pass (a component that is itself in the set
 * comes before every kanji using it), then the order overrides.
 */
export function orderKanji(
  raw: RawKanji[],
  components: Map<string, string[]>,
  overrides: OrderOverride[],
): string[] {
  const base = [...raw]
    .sort(
      (a, b) =>
        a.grade - b.grade ||
        (a.freq ?? Infinity) - (b.freq ?? Infinity) ||
        a.strokes - b.strokes ||
        (a.char.codePointAt(0) ?? 0) - (b.char.codePointAt(0) ?? 0),
    )
    .map((k) => k.char);
  const rank = new Map(base.map((c, i) => [c, i]));
  const order: string[] = [];
  const placed = new Set<string>();
  const visiting = new Set<string>();
  const place = (c: string): void => {
    if (placed.has(c) || visiting.has(c)) return;
    visiting.add(c);
    const parts = (components.get(c) ?? []).filter((p) => rank.has(p));
    parts
      .sort((a, b) => (rank.get(a) ?? 0) - (rank.get(b) ?? 0))
      .forEach(place);
    visiting.delete(c);
    placed.add(c);
    order.push(c);
  };
  base.forEach(place);
  for (const o of overrides) {
    const target = o.before ?? o.after;
    if (!rank.has(o.char) || !target || !rank.has(target))
      throw new Error(`bad order override ${JSON.stringify(o)}`);
    order.splice(order.indexOf(o.char), 1);
    order.splice(order.indexOf(target) + (o.before ? 0 : 1), 0, o.char);
  }
  return order;
}

/** One entry per line: compact, yet diffs stay readable. Prettier-ignored. */
function writeJsonLines(file: string, items: unknown[]): void {
  const lines = items.map((item) => "  " + JSON.stringify(item));
  writeFileSync(file, "[\n" + lines.join(",\n") + "\n]\n");
}

const readJson = <T>(file: string): T =>
  JSON.parse(readFileSync(file, "utf8")) as T;

async function main(): Promise<void> {
  const refresh = process.argv.includes("--refresh");
  const xml = (await cached("kanjidic", refresh)).toString("utf8");
  const krad = new TextDecoder("euc-jp").decode(
    await cached("kradfile", refresh),
  );
  const kradMap = parseKradfile(krad);
  const raw = parseKanjidic(xml);
  console.log(`${raw.length} Jōyō kanji`);
  const glossOverrides = readJson<Record<string, string>>(
    "scripts/gloss-overrides.json",
  );
  const components = new Map(
    raw.map((k) => [
      k.char,
      kradMap.get(k.char) ?? kradMap.get(KRAD_VARIANTS[k.char] ?? "") ?? [],
    ]),
  );
  const order = orderKanji(
    raw,
    components,
    readJson<OrderOverride[]>("scripts/order-overrides.json"),
  );
  const pos = new Map(order.map((c, i) => [c, i]));
  const sorted = [...raw].sort(
    (a, b) => (pos.get(a.char) ?? 0) - (pos.get(b.char) ?? 0),
  );
  const kanji = sorted.map((k, i) => ({
    char: k.char,
    level: 2 + Math.floor(i / LEVEL_SIZE),
    grade: k.grade,
    freq: k.freq,
    glosses: pickGlosses(k.meanings, glossOverrides[k.char]),
    on: k.on[0] ? toHiragana(k.on[0].replace(/^-|-$/g, "")) : null,
    kun: k.kun[0] ? splitKun(k.kun[0]) : null,
    readings: allReadings(k),
    components: components.get(k.char) ?? [],
  }));
  writeJsonLines("src/data/kanji.json", kanji);
}

await main();
