/**
 * Gloss cleanup shared by the kanji build (`build-data.ts`) and the word
 * build (`words.ts`). Pure.
 */

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
export const isShort = (g: string) =>
  g.length <= SHORT && g.split(" ").length <= 2;

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
