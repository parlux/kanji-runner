/// <reference types="node" />
/**
 * Writer input files for the story dictionary (SPEC-own-stories: Pipeline).
 *
 * - `npm run stories:prep -- <levels>` (game levels, `N` or `A-B`): one file
 *   per level, `.data-cache/stories/in/kanji-NNN.json`, with what the writer
 *   needs per kanji (see `KanjiInput`).
 * - `npm run stories:prep -- --parts`: every component, the kanji that use it,
 *   whether it is one of our kanji, and its KANJIDIC2 meaning when the cached
 *   `.data-cache/kanjidic2.xml.gz` has it → `in/parts.json`.
 * - `npm run stories:prep -- --sounds`: every main on'yomi with its kanji
 *   count and examples → `in/sounds.json`.
 *
 * Reads `dictionary/parts.json` and `sounds.json` for names already chosen.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { gunzipSync } from "node:zlib";
import words from "../../src/data/words.json";
import { showReading } from "../../src/core/distractors";
import { KANJI, maxLevel } from "../../src/core/kanji";
import { levelName } from "../../src/core/progression";
import type { KanjiItem } from "../../src/core/types";
import { DICTIONARY, parseLevels, storyFile } from "./levels";

const OUT = ".data-cache/stories/in";
/** Words listed per kanji, most useful first. */
const WORDS_PER_KANJI = 8;
/** Example kanji listed per part or sound. */
const EXAMPLES = 6;

type Word = { word: string; reading: string; glosses: string[]; level: number };
type Names = Record<string, { name?: string; keyword?: string }>;

export type KanjiInput = {
  char: string;
  glosses: string[];
  /** Main on'yomi, hiragana. */
  on: string | null;
  /** Main kun'yomi as gates show it: やす(む). */
  kun: string | null;
  readings: string[];
  components: { part: string; name: string | null }[];
  /** The `sounds.json` keyword for the main on'yomi. */
  onSound: string | null;
  words: { word: string; reading: string; gloss: string }[];
  /** Earlier kanji (in teaching order) that are parts of this one. */
  earlier: { char: string; gloss: string; level: string }[];
};

/** The writer's input for one game level. */
export function levelInput(
  level: number,
  kanji: readonly KanjiItem[],
  wordList: readonly Word[],
  parts: Names,
  sounds: Names,
) {
  const index = new Map(kanji.map((k, i) => [k.char, i]));
  const ordered = wordList
    .map((w, i) => ({ w, i }))
    .sort((a, b) => a.w.level - b.w.level || a.i - b.i)
    .map((x) => x.w);
  const items: KanjiInput[] = kanji
    .filter((k) => k.level === level)
    .map((k) => ({
      char: k.char,
      glosses: k.glosses,
      on: k.on,
      kun: k.kun ? showReading(k.kun) : null,
      readings: k.readings,
      components: k.components.map((part) => ({
        part,
        name: parts[part]?.name ?? null,
      })),
      onSound: (k.on && sounds[k.on]?.keyword) || null,
      words: ordered
        .filter((w) => w.level <= level && w.word.includes(k.char))
        .slice(0, WORDS_PER_KANJI)
        .map((w) => ({
          word: w.word,
          reading: w.reading,
          gloss: w.glosses[0] ?? "",
        })),
      earlier: k.components.flatMap((c) => {
        const i = index.get(c);
        const e = i === undefined ? undefined : kanji[i];
        return e && (i as number) < (index.get(k.char) as number)
          ? [{ char: c, gloss: e.glosses[0] ?? "", level: levelName(e.level) }]
          : [];
      }),
    }));
  return {
    level: levelName(level),
    gameLevel: level,
    output: `${DICTIONARY}/stories/${storyFile(level)}`,
    kanji: items,
  };
}

const example = (k: KanjiItem) => ({ char: k.char, gloss: k.glosses[0] });

/** Every component, most used first. `meanings` maps a character to its KANJIDIC2 meaning. */
export function partsInput(
  kanji: readonly KanjiItem[],
  parts: Names,
  meanings: ReadonlyMap<string, string>,
) {
  const users = new Map<string, KanjiItem[]>();
  for (const k of kanji)
    for (const c of k.components) users.set(c, [...(users.get(c) ?? []), k]);
  const own = new Map(kanji.map((k) => [k.char, k]));
  return [...users]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([part, ks]) => {
      const k = own.get(part);
      return {
        part,
        name: parts[part]?.name ?? null,
        uses: ks.length,
        examples: ks.slice(0, EXAMPLES).map(example),
        kanji: k ? { gloss: k.glosses[0], level: levelName(k.level) } : null,
        kanjidic: meanings.get(part) ?? null,
      };
    });
}

/** Every main on'yomi, most kanji first. */
export function soundsInput(kanji: readonly KanjiItem[], sounds: Names) {
  const by = new Map<string, KanjiItem[]>();
  for (const k of kanji) if (k.on) by.set(k.on, [...(by.get(k.on) ?? []), k]);
  return [...by]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([sound, ks]) => ({
      sound,
      keyword: sounds[sound]?.keyword ?? null,
      count: ks.length,
      examples: ks.slice(0, EXAMPLES).map(example),
    }));
}

/** First English meaning per KANJIDIC2 character, if the file is cached. */
function kanjidicMeanings(): Map<string, string> {
  const out = new Map<string, string>();
  const file = ".data-cache/kanjidic2.xml.gz";
  if (!existsSync(file)) return out;
  const xml = gunzipSync(readFileSync(file)).toString("utf8");
  for (const [, body = ""] of xml.matchAll(
    /<character>([\s\S]*?)<\/character>/g,
  )) {
    const lit = /<literal>(.*?)<\/literal>/.exec(body)?.[1];
    const meaning = /<meaning>(.*?)<\/meaning>/.exec(body)?.[1];
    if (lit && meaning) out.set(lit, meaning);
  }
  return out;
}

const readNames = (file: string): Names =>
  JSON.parse(readFileSync(`${DICTIONARY}/${file}`, "utf8")) as Names;

function write(name: string, data: unknown) {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/${name}`, JSON.stringify(data, null, 1) + "\n");
  console.log(`wrote ${OUT}/${name}`);
}

function main() {
  const arg = process.argv[2];
  const parts = readNames("parts.json");
  const sounds = readNames("sounds.json");
  if (arg === "--parts") {
    const list = partsInput(KANJI, parts, kanjidicMeanings());
    write("parts.json", list);
    console.log(`${list.length} components`);
  } else if (arg === "--sounds") {
    const list = soundsInput(KANJI, sounds);
    write("sounds.json", list);
    const common = list.filter((s) => s.count >= 3).length;
    console.log(`${list.length} main on'yomi, ${common} on 3+ kanji`);
  } else if (arg) {
    for (const level of parseLevels(arg, maxLevel(KANJI)))
      write(
        storyFile(level),
        levelInput(level, KANJI, words as Word[], parts, sounds),
      );
  } else {
    console.error("usage: stories:prep -- <levels> | --parts | --sounds");
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
