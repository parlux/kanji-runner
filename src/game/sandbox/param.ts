/** The dev sandbox a page asked for (`?sandbox=horde`), or null for the game. */
export function sandboxParam(search: string): "horde" | null {
  return new URLSearchParams(search).get("sandbox") === "horde"
    ? "horde"
    : null;
}

/** The page's address for the horde gauntlet. */
export const GAUNTLET_SEARCH = "?sandbox=horde";
