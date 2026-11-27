/// <reference types="node" />
/**
 * Dev-only: `npm run data:travel` writes `src/data/travel.json`, the kanji
 * token counts of the travel texts (`scripts/coverage/{menu,signs,phrasebook}.txt`),
 * for `src/core/coverage.ts`. Offline and deterministic: texts in a fixed
 * order, kanji sorted by code point, one per line so diffs stay small.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { kanjiOf } from "./coverage";

export const TRAVEL_TEXTS = ["menu", "signs", "phrasebook"];
export const TRAVEL_FILE = "src/data/travel.json";

export type TravelText = {
  name: string;
  total: number;
  counts: Record<string, number>;
};

/** The kanji counts of one text's lines. */
export function travelText(name: string, lines: string[]): TravelText {
  const tokens = lines.flatMap(kanjiOf);
  const counts: Record<string, number> = {};
  for (const c of [...new Set(tokens)].sort(
    (a, b) => (a.codePointAt(0) ?? 0) - (b.codePointAt(0) ?? 0),
  ))
    counts[c] = tokens.filter((t) => t === c).length;
  return { name, total: tokens.length, counts };
}

/** The file's text for the three shipped texts. */
export function travelJson(): string {
  const texts = TRAVEL_TEXTS.map((name) =>
    travelText(
      name,
      readFileSync(`scripts/coverage/${name}.txt`, "utf8")
        .split("\n")
        .filter((l) => l.trim()),
    ),
  );
  return JSON.stringify(texts, null, 2) + "\n";
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  writeFileSync(TRAVEL_FILE, travelJson());
  console.log(`wrote ${TRAVEL_FILE}`);
}
