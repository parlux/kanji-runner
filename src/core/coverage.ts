import travel from "../data/travel.json";

/**
 * How much of the travel texts (menu, station signs, phrasebook) a player can
 * read: the mean over the texts of the share of their kanji tokens that are
 * known. `src/data/travel.json` comes from `npm run data:travel`.
 */
export function travelCoverage(known: (char: string) => boolean): number {
  const shares = travel.map((t) => {
    if (!t.total) return 1;
    let hits = 0;
    for (const [c, n] of Object.entries(t.counts)) if (known(c)) hits += n;
    return hits / t.total;
  });
  return shares.reduce((s, x) => s + x, 0) / shares.length;
}
