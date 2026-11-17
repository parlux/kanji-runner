/// <reference types="node" />
/**
 * Dev-only coverage report (SPEC-useful-order: Sample texts and coverage):
 * `npm run data:coverage [-- --wk <file>]`.
 *
 * How much of each sample text a player can read at Kanji 1, 3, 5, 10 and 20,
 * for the shipped order (`src/data/kanji.json`), today's order (`byGrade`,
 * computed from the cached KANJIDIC2 and KRADFILE) and, with `--wk`, a
 * WaniKani kanji-per-level JSON (`{ "1": ["一", …], … }`), compared at the
 * same kanji count. Texts: the travel texts in `scripts/coverage/` and the
 * Aozora Bunko stories (`STORIES`, cached). Two measures per text and level:
 *
 * - kanji coverage: the share of the text's kanji tokens that are known;
 * - readable lines: the share of lines with kanji whose every kanji is known.
 *   Lines without kanji are left out. Story text is split into sentences.
 *
 * Kanji outside every order (not Jōyō) count as unknown. 々, 〆 and 〇 are
 * not kanji here. Writes the table to stdout and `.data-cache/`.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { byGrade } from "./order";
import { CACHE, cached, jouyouKanji, STORIES } from "./sources";

/** Kanji 1, 3, 5, 10 and 20 (level 2 is Kanji 1). */
const KANJI_LEVELS = [1, 3, 5, 10, 20];
/** Kanji per level from level 2 (`LEVEL_SIZE` in `build-data.ts`). */
const LEVEL_SIZE = 30;
const TRAVEL = ["menu", "signs", "phrasebook"];

/** The kanji tokens of a line, in order, repeats kept. */
export function kanjiOf(line: string): string[] {
  return [...line].filter(
    (c) => /\p{Script=Han}/u.test(c) && !"々〆〇".includes(c),
  );
}

export type Measure = { coverage: number; lines: number };

/** Kanji coverage and readable lines, as shares in [0, 1]. */
export function measure(lines: string[], known: Set<string>): Measure {
  let tokens = 0;
  let hits = 0;
  let withKanji = 0;
  let readable = 0;
  for (const line of lines) {
    const ks = kanjiOf(line);
    if (!ks.length) continue;
    const k = ks.filter((c) => known.has(c)).length;
    tokens += ks.length;
    hits += k;
    withKanji += 1;
    if (k === ks.length) readable += 1;
  }
  return {
    coverage: tokens ? hits / tokens : 1,
    lines: withKanji ? readable / withKanji : 1,
  };
}

/**
 * An Aozora Bunko text file (decoded) as plain sentences: header, notes block
 * and 底本 footer dropped; ruby 《…》, ｜ markers and ［＃…］ notes (with
 * their ※ gaiji mark) removed.
 */
export function aozoraLines(text: string): string[] {
  const all = text.replace(/\r/g, "").split("\n");
  const rules = all.flatMap((l, i) => (/^-{10,}/.test(l) ? [i] : []));
  const start = rules.length >= 2 ? (rules[1] ?? 0) + 1 : all.indexOf("") + 1;
  const end = all.findIndex((l, i) => i >= start && l.startsWith("底本："));
  return all
    .slice(start, end < 0 ? undefined : end)
    .join("\n")
    .replace(/※?［＃[^］]*］/g, "")
    .replace(/《[^》]*》/g, "")
    .replace(/｜/g, "")
    .split(/(?<=。)|\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

/**
 * WaniKani's kanji at a count: its levels, in order, cumulated until they
 * hold at least `count` kanji.
 */
export function wkKnown(
  levels: Record<string, string[]>,
  count: number,
): Set<string> {
  const known = new Set<string>();
  const order = Object.keys(levels).sort((a, b) => Number(a) - Number(b));
  for (const l of order) {
    if (known.size >= count) break;
    for (const c of levels[l] ?? []) known.add(c);
  }
  return known;
}

type Order = { name: string; known: (count: number) => Set<string> };

const pct = (x: number) => String(Math.round(x * 100)).padStart(3);

/** The report: per text, one row per order, `coverage/lines` in %. */
export function coverageTable(
  texts: { name: string; lines: string[] }[],
  orders: Order[],
): string {
  const head = ["text", "order", ...KANJI_LEVELS.map((n) => `Kanji ${n}`)];
  const rows: string[][] = [];
  const avg = new Map<string, number[][]>();
  for (const t of texts)
    for (const o of orders) {
      const ms = KANJI_LEVELS.map((n) =>
        measure(t.lines, o.known(n * LEVEL_SIZE)),
      );
      rows.push([
        t.name,
        o.name,
        ...ms.map((m) => `${pct(m.coverage)} /${pct(m.lines)}`),
      ]);
      if (TRAVEL.includes(t.name))
        avg.set(o.name, [
          ...(avg.get(o.name) ?? []),
          ms.map((m) => m.coverage),
        ]);
    }
  for (const o of orders) {
    const per = avg.get(o.name);
    if (!per) continue;
    const mean = KANJI_LEVELS.map(
      (_, i) => per.reduce((s, r) => s + (r[i] ?? 0), 0) / per.length,
    );
    rows.push(["travel avg", o.name, ...mean.map((m) => `${pct(m)}     `)]);
  }
  const widths = head.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length)),
  );
  const fmt = (r: string[]) =>
    r
      .map((c, i) => c.padEnd(widths[i] ?? 0))
      .join("  ")
      .trimEnd();
  return [
    "# Kanji coverage % / readable lines % (Kanji N = first 30·N kanji)",
    fmt(head),
    ...rows.map(fmt),
    "",
  ].join("\n");
}

async function main(): Promise<void> {
  const refresh = process.argv.includes("--refresh");
  const wkArg = process.argv.indexOf("--wk");
  const texts = TRAVEL.map((name) => ({
    name,
    lines: readFileSync(`scripts/coverage/${name}.txt`, "utf8")
      .split("\n")
      .filter((l) => l.trim()),
  }));
  const sjis = new TextDecoder("shift_jis");
  const stories: string[] = [];
  for (const s of STORIES)
    stories.push(...aozoraLines(sjis.decode(await cached(s, refresh))));
  texts.push({ name: "stories", lines: stories });

  const shipped = (
    JSON.parse(readFileSync("src/data/kanji.json", "utf8")) as {
      char: string;
      level: number;
    }[]
  ).map((k) => k.char);
  const { raw, components } = await jouyouKanji(refresh);
  const today = byGrade(raw, components, []);
  const prefix = (order: string[]) => (n: number) => new Set(order.slice(0, n));
  const orders: Order[] = [
    { name: "new", known: prefix(shipped) },
    { name: "today", known: prefix(today) },
  ];
  if (wkArg >= 0) {
    const file = process.argv[wkArg + 1];
    if (!file) throw new Error("--wk needs a file");
    const levels = JSON.parse(readFileSync(file, "utf8")) as Record<
      string,
      string[]
    >;
    orders.push({ name: "wanikani", known: (n) => wkKnown(levels, n) });
  }
  const report = coverageTable(texts, orders);
  writeFileSync(`${CACHE}/coverage-report.txt`, report);
  console.log(report);
  console.log(`coverage report written to ${CACHE}/coverage-report.txt`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await main();
