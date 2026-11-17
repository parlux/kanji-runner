/// <reference types="node" />
/**
 * Dev-only data build: `npm run data:build`.
 *
 * Downloads KANJIDIC2, KRADFILE and JMdict (EDRDG, CC BY-SA 4.0) and the
 * TUBELEX Japanese word frequencies (BSD-3-Clause; unpacked with the `xz`
 * command), and Tatoeba's Japanese sentences (CC BY 2.0 FR) for word value,
 * into the gitignored `.data-cache/` (pass `--refresh` to download again) and writes compact JSON
 * into `src/data/`. Output depends only on the cached files, so running it
 * twice gives identical JSON.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { byGrade, type OrderOverride } from "./order";
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
  const order = byGrade(
    raw,
    components,
    readJson<OrderOverride[]>("scripts/order-overrides.json"),
  );
  const readingOverrides = readJson<Record<string, Override>>(
    "scripts/reading-overrides.json",
  );
  for (const c of Object.keys(readingOverrides))
    if (!components.has(c))
      throw new Error(`reading override ${c}: not a Jōyō kanji`);
  const jmdict = (await cached("jmdict", refresh)).toString("utf8");
  const counts = countReadings(commonWords(jmdict), raw);
  const pos = new Map(order.map((c, i) => [c, i]));
  const sorted = [...raw].sort(
    (a, b) => (pos.get(a.char) ?? 0) - (pos.get(b.char) ?? 0),
  );
  const kanji = sorted.map((k, i) => {
    const pick = pickReadings(k, counts.get(k.char), readingOverrides[k.char]);
    return {
      char: k.char,
      level: 2 + Math.floor(i / LEVEL_SIZE),
      grade: k.grade,
      freq: k.freq,
      glosses: pickGlosses(k.meanings, glossOverrides[k.char]),
      on: pick.on ? toHiragana(pick.on.replace(/^-|-$/g, "")) : null,
      kun: pick.kun ? splitKun(pick.kun) : null,
      readings: allReadings(k),
      components: components.get(k.char) ?? [],
    };
  });
  writeJsonLines("src/data/kanji.json", kanji);
  writeConfusables(kanji);

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

  const { candidates, removed } = wordCandidates(jmdict, kanji);
  const usage = parseUsage((await cached("usage", refresh)).toString("utf8"));
  const listed = new Set(candidates.map((c) => c.word));
  const ranked = candidates.filter((c) => usageRank(c, usage, listed) !== null);
  console.log(
    `usage list: ${usage.size} word forms; ranks ${ranked.length} of ${candidates.length} candidates`,
  );
  await reportUsefulness(candidates, usage, refresh);
  const words = WORD_PICKER(usage)(candidates, KANJI_WORDS_PER_LEVEL);
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

/**
 * Word value (SPEC-useful-order), not yet used by the order: matches the
 * themes to candidates and writes `useful-report.txt`.
 */
async function reportUsefulness(
  candidates: Candidate[],
  usage: UsageRanks,
  refresh: boolean,
): Promise<void> {
  const start = performance.now();
  const sentences = parseTatoeba(
    (await cached("tatoeba", refresh)).toString("utf8"),
  );
  const matches = matchThemes(
    readJson<Themes>("scripts/themes.json"),
    candidates,
  );
  const themed = new Set(matches.flatMap((m) => m.candidate ?? []));
  const useful = usefulness(
    candidates,
    themed,
    usageRanks(candidates, usage),
    usage.size,
    easyCounts(sentences, candidates),
  );
  const text = usefulReport(matches, useful);
  writeFileSync(`${CACHE}/useful-report.txt`, text);
  const secs = ((performance.now() - start) / 1000).toFixed(1);
  console.log(
    `${text.split("\n")[0]}; ${sentences.length} Tatoeba sentences, ${secs} s; useful report written to ${CACHE}/useful-report.txt`,
  );
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
