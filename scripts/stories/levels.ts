/** Shared helpers for the story pipeline (SPEC-own-stories): level files and level arguments. */
export const DICTIONARY = "dictionary";

/** Story file name for a game level: level 2 ("Kanji 1") → `kanji-01.json`. */
export const storyFile = (level: number): string =>
  `kanji-${String(level - 1).padStart(2, "0")}.json`;

/** Game level of a story file name, or null if the name isn't `kanji-NN.json`. */
export function fileLevel(name: string): number | null {
  const m = /^kanji-(\d{2,})\.json$/.exec(name);
  return m ? Number(m[1]) + 1 : null;
}

/** Game levels from a CLI argument: `N` or `A-B`, within [2, max]. Throws on anything else. */
export function parseLevels(arg: string, max: number): number[] {
  const m = /^(\d+)(?:-(\d+))?$/.exec(arg.trim());
  if (!m) throw new Error(`levels: expected N or A-B, got "${arg}"`);
  const a = Number(m[1]);
  const b = Number(m[2] ?? m[1]);
  if (a < 2 || b > max || a > b)
    throw new Error(`levels: ${arg} is outside 2-${max} (game levels)`);
  return Array.from({ length: b - a + 1 }, (_, i) => a + i);
}
