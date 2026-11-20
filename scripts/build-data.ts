/// <reference types="node" />
/**
 * Dev-only data build: `npm run data:build`.
 *
 * Downloads KANJIDIC2, KRADFILE and JMdict (EDRDG, CC BY-SA 4.0), KanjiVG
 * (CC BY-SA 3.0) for the parts each kanji shows, and the
 * TUBELEX Japanese word frequencies (BSD-3-Clause; unpacked with the `xz`
 * command), and Tatoeba's Japanese sentences (CC BY 2.0 FR) for word value,
 * into the gitignored `.data-cache/` (pass `--refresh` to download again) and writes compact JSON
 * into `src/data/`. Output depends only on the cached files, so running it
 * twice gives identical JSON.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import {
  components as composite,
  parseKanjivg,
  partsReport,
  type Chunk,
} from "./kanjivg";
import { orderReport, usefulOrder, type OrderOverride } from "./order";
import {
  commonWords,
  countReadings,
  pickReadings,
  reportRow,
  type Override,
} from "./readings";
import { cleanGloss, isShort, pickGlosses } from "./glosses";
import {
  KANJI_WORDS_PER_LEVEL,
  parseUsage,
  setLevels,
  usageRank,
  usageRanks,
  WORD_PICKER,
  wordCandidates,
  wordReport,
  type Candidate,
  type UsageRanks,
} from "./words";
import { CACHE, cached, jouyouKanji, type RawKanji } from "./sources";
import {
  easyCounts,
  matchThemes,
  parseTatoeba,
  usefulness,
  usefulReport,
  type Themes,
  type Usefulness,
} from "./useful";

/** Kanji levels 2+ hold 30 kanji each (SPEC: Progression and levels). */
const LEVEL_SIZE = 30;

type Kun = { base: string; okurigana: string };

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

/** One entry per line: compact, yet diffs stay readable. Prettier-ignored. */
function writeJsonLines(file: string, items: unknown[]): void {
  const lines = items.map((item) => "  " + JSON.stringify(item));
  writeFileSync(file, "[\n" + lines.join(",\n") + "\n]\n");
}

const readJson = <T>(file: string): T =>
  JSON.parse(readFileSync(file, "utf8")) as T;

async function main(): Promise<void> {
  const refresh = process.argv.includes("--refresh");
  const { raw, components } = await jouyouKanji(refresh);
  console.log(`${raw.length} Jōyō kanji`);
  const glossOverrides = readJson<Record<string, string>>(
    "scripts/gloss-overrides.json",
  );
  const readingOverrides = readJson<Record<string, Override>>(
    "scripts/reading-overrides.json",
  );
  for (const c of Object.keys(readingOverrides))
    if (!components.has(c))
      throw new Error(`reading override ${c}: not a Jōyō kanji`);
  const { shown, trees } = await shownComponents(raw, components, refresh);
  const jmdict = (await cached("jmdict", refresh)).toString("utf8");
  const counts = countReadings(commonWords(jmdict), raw);
  // Taught readings don't depend on the order; candidates need them first.
  const taught = new Map(
    raw.map((k) => {
      const pick = pickReadings(
        k,
        counts.get(k.char),
        readingOverrides[k.char],
      );
      return [
        k.char,
        {
          char: k.char,
          on: pick.on ? toHiragana(pick.on.replace(/^-|-$/g, "")) : null,
          kun: pick.kun ? splitKun(pick.kun) : null,
        },
      ];
    }),
  );
  const { candidates, removed, racers } = wordCandidates(jmdict, [
    ...taught.values(),
  ]);
  const usage = parseUsage((await cached("usage", refresh)).toString("utf8"));
  const listed = new Set(candidates.map((c) => c.word));
  const ranked = candidates.filter((c) => usageRank(c, usage, listed) !== null);
  console.log(
    `usage list: ${usage.size} word forms; ranks ${ranked.length} of ${candidates.length} candidates; ${racers.length} lone-kanji racers`,
  );
  const useful = await usefulnessOf(candidates, racers, usage, refresh);

  const orderStart = performance.now();
  const { order, why } = usefulOrder(
    raw,
    components,
    [...candidates, ...racers].map((c) => {
      const u = useful.get(c);
      return { word: c.word, value: u?.value ?? 0, theme: !!u?.theme };
    }),
    readJson<OrderOverride[]>("scripts/order-overrides.json"),
  );
  const levelAt = (i: number) => 2 + Math.floor(i / LEVEL_SIZE);
  const orderText = orderReport(order, why, levelAt);
  writeFileSync(`${CACHE}/order-report.txt`, orderText);
  const orderSecs = ((performance.now() - orderStart) / 1000).toFixed(1);
  console.log(
    `${orderText.split("\n")[0]}; ${orderSecs} s; order report written to ${CACHE}/order-report.txt`,
  );
  const pos = new Map(order.map((c, i) => [c, i]));
  const sorted = [...raw].sort(
    (a, b) => (pos.get(a.char) ?? 0) - (pos.get(b.char) ?? 0),
  );
  const kanji = sorted.map((k, i) => ({
    char: k.char,
    level: levelAt(i),
    grade: k.grade,
    freq: k.freq,
    glosses: pickGlosses(k.meanings, glossOverrides[k.char]),
    on: taught.get(k.char)?.on ?? null,
    kun: taught.get(k.char)?.kun ?? null,
    readings: allReadings(k),
    components: shown.get(k.char) ?? [],
  }));
  writeJsonLines("src/data/kanji.json", kanji);
  writeConfusables(kanji);
  writePartsReport(kanji, trees);

  const report = glossReport(sorted, kanji, glossOverrides);
  writeFileSync(`${CACHE}/gloss-report.txt`, report);
  console.log(report);
  console.log(`gloss report written to ${CACHE}/gloss-report.txt`);

  // `sorted` and `kanji` share the progression order.
  const rows = sorted.flatMap((k, i) => {
    const level = kanji[i]?.level ?? 0;
    const row = reportRow(
      k,
      level,
      counts.get(k.char),
      readingOverrides[k.char],
    );
    return row ? [row] : [];
  });
  const onChanged = rows.filter((r) => / on /.test(r)).length;
  const kunChanged = rows.filter((r) => /( {2}|; )kun /.test(r)).length;
  const summary = `${onChanged} kanji changed on'yomi, ${kunChanged} changed kun'yomi`;
  writeFileSync(
    `${CACHE}/reading-report.txt`,
    [`# ${summary}`, ...rows, ""].join("\n"),
  );
  console.log(
    `${summary}; reading report written to ${CACHE}/reading-report.txt`,
  );

  setLevels(candidates, new Map(kanji.map((k) => [k.char, k.level])));
  const value = new Map(candidates.map((c) => [c, useful.get(c)?.value ?? 0]));
  const words = WORD_PICKER(usage, value)(candidates, KANJI_WORDS_PER_LEVEL);
  writeJsonLines(
    "src/data/words.json",
    words.map(({ word, reading, glosses, kind, level }) => ({
      word,
      reading,
      glosses,
      kind,
      level,
    })),
  );
  const wordText = wordReport(removed, words);
  writeFileSync(`${CACHE}/word-report.txt`, wordText);
  console.log(
    `${wordText.split("\n")[0]}; word report written to ${CACHE}/word-report.txt`,
  );
}

const PARTS = "dictionary/parts.json";

/** Each kanji's parts from KanjiVG, by the composite-parts rule. */
async function shownComponents(
  raw: RawKanji[],
  krad: Map<string, string[]>,
  refresh: boolean,
): Promise<{ shown: Map<string, string[]>; trees: Map<string, Chunk> }> {
  const chars = new Set(raw.map((k) => k.char));
  const xml = (await cached("kanjivg", refresh)).toString("utf8");
  const trees = parseKanjivg(xml, chars);
  const missing = [...chars].filter((c) => !trees.has(c));
  if (missing.length) throw new Error(`not in KanjiVG: ${missing.join("")}`);
  const named = new Set(Object.keys(readJson<object>(PARTS)));
  const { components: shown, fallbacks } = composite(trees, named, chars, krad);
  console.log(
    `parts: ${fallbacks.length} kanji with strokes outside their KanjiVG chunks use the KRADFILE fallback`,
  );
  return { shown, trees };
}

/**
 * For the part namers (Task C2): `stories/new-parts.json`, every component
 * parts.json doesn't name yet, and `stories/removed-parts.json`, the parts
 * no kanji uses any more.
 */
function writePartsReport(
  kanji: { char: string; components: string[] }[],
  trees: Map<string, Chunk>,
) {
  const named = Object.keys(readJson<object>(PARTS));
  const chars = new Set(kanji.map((k) => k.char));
  const { added, removed } = partsReport(kanji, trees, named, chars);
  mkdirSync(`${CACHE}/stories`, { recursive: true });
  writeFileSync(
    `${CACHE}/stories/new-parts.json`,
    JSON.stringify(added, null, 2) + "\n",
  );
  writeFileSync(
    `${CACHE}/stories/removed-parts.json`,
    JSON.stringify(removed, null, 2) + "\n",
  );
  const kanjiParts = added.filter((p) => p.kanji).length;
  console.log(
    `parts: ${added.length} new (${kanjiParts} kanji, ${added.length - kanjiParts} shapes), ${removed.length} removed (${removed.join(" ")}); written to ${CACHE}/stories/new-parts.json and removed-parts.json`,
  );
}

/**
 * Word value (SPEC-useful-order) of the candidates and the lone-kanji racers:
 * matches the themes to both and writes `useful-report.txt`. Candidates keep
 * their own spoken ranks (the お/ご rule looks only at candidates); racers'
 * ranks are taken over both.
 */
async function usefulnessOf(
  candidates: Candidate[],
  racers: Candidate[],
  usage: UsageRanks,
  refresh: boolean,
): Promise<Map<Candidate, Usefulness>> {
  const start = performance.now();
  const sentences = parseTatoeba(
    (await cached("tatoeba", refresh)).toString("utf8"),
  );
  const all = [...candidates, ...racers];
  const matches = matchThemes(readJson<Themes>("scripts/themes.json"), all);
  const themed = new Set(matches.flatMap((m) => m.candidate ?? []));
  const spoken = usageRanks(all, usage);
  for (const [c, r] of usageRanks(candidates, usage)) spoken.set(c, r);
  const useful = usefulness(
    all,
    themed,
    spoken,
    usage.size,
    easyCounts(sentences, all),
  );
  const text = usefulReport(matches, useful);
  writeFileSync(`${CACHE}/useful-report.txt`, text);
  const secs = ((performance.now() - start) / 1000).toFixed(1);
  console.log(
    `${text.split("\n")[0]}; ${sentences.length} Tatoeba sentences, ${secs} s; useful report written to ${CACHE}/useful-report.txt`,
  );
  return useful;
}

/** Hand-curated kana look-alikes, within one script (SPEC: Distractors). */
const KANA_LOOKALIKES = [
  ["ぬ", "め"],
  ["わ", "れ", "ね"],
  ["は", "ほ", "け"],
  ["さ", "ち", "き"],
  ["る", "ろ"],
  ["い", "り"],
  ["う", "ら"],
  ["あ", "お", "め"],
  ["こ", "に"],
  ["ま", "も"],
  ["し", "つ"],
  ["く", "へ"],
  ["ば", "ぱ"],
  ["ぶ", "ぷ"],
  ["シ", "ツ"],
  ["ソ", "ン", "リ"],
  ["ク", "ケ", "タ"],
  ["ウ", "ワ", "フ"],
  ["コ", "ユ", "ロ"],
  ["チ", "テ"],
  ["ノ", "メ", "ナ"],
  ["ア", "マ"],
  ["ヌ", "ス"],
  ["ラ", "ヲ"],
  ["セ", "ヒ"],
  ["ル", "レ"],
  ["エ", "ニ"],
  ["ハ", "ル"],
  ["バ", "パ"],
  ["ブ", "プ"],
];

/**
 * confusables.json: the kana look-alike groups, and for each element shared by
 * two or more kanji, those kanji in progression order (体 and 休 share ⺅).
 */
function writeConfusables(
  kanji: { char: string; components: string[] }[],
): void {
  const index = new Map<string, string[]>();
  for (const k of kanji) {
    for (const c of k.components)
      index.set(c, [...(index.get(c) ?? []), k.char]);
  }
  const shared = [...index]
    .filter(([, chars]) => chars.length > 1)
    .sort(([a], [b]) => (a.codePointAt(0) ?? 0) - (b.codePointAt(0) ?? 0));
  const line = (key: string, value: unknown) =>
    `    ${JSON.stringify(key)}: ${JSON.stringify(value)}`;
  const text = [
    "{",
    `  "kana": [`,
    KANA_LOOKALIKES.map((g) => `    ${JSON.stringify(g)}`).join(",\n"),
    "  ],",
    `  "components": {`,
    shared.map(([c, chars]) => line(c, chars)).join(",\n"),
    "  }",
    "}",
    "",
  ];
  writeFileSync("src/data/confusables.json", text.join("\n"));
}

/**
 * Primary glosses worth a look: no clean meaning to pick from, long ones,
 * and ones shared by several kanji. Overridden kanji are left out.
 */
function glossReport(
  raw: RawKanji[],
  kanji: { char: string; glosses: string[] }[],
  overrides: Record<string, string>,
): string {
  const primary = new Map(kanji.map((k) => [k.char, k.glosses[0] ?? ""]));
  const users = new Map<string, string[]>();
  for (const [c, g] of primary) users.set(g, [...(users.get(g) ?? []), c]);
  const lines: string[] = [];
  for (const k of raw) {
    if (k.char in overrides) continue;
    const g = primary.get(k.char) ?? "";
    const why: string[] = [];
    if (!k.meanings.some((m) => cleanGloss(m))) why.push("no clean meaning");
    if (!isShort(g)) why.push("long");
    const others = (users.get(g) ?? []).filter((c) => c !== k.char);
    if (others.length) why.push(`shared with ${others.join("")}`);
    if (why.length)
      lines.push(
        `${k.char}  ${g}  [${why.join("; ")}]  ← ${k.meanings.join(" | ")}`,
      );
  }
  return [`# Questionable glosses: ${lines.length}`, ...lines, ""].join("\n");
}

await main();
