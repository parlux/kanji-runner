import type { DictEntry, Dictionary } from "../core/study";

type LevelFile = { kanji: Record<string, DictEntry> };
type Loader = () => Promise<{ default: LevelFile }>;

// one chunk per level file, fetched only when a card first needs it
const FILES = import.meta.glob<{ default: LevelFile }>(
  "/dictionary/stories/*.json",
);

const entries = new Map<string, DictEntry>();
const parts = new Map<string, string>();
const done = new Map<string, Promise<void>>();
const settled = new Set<string>();

/** The file key for a game level: "kanji-05.json" is game level 6 (Kanji 5). */
const fileOf = (level: number): string =>
  `/dictionary/stories/kanji-${String(level - 1).padStart(2, "0")}.json`;

function once(key: string, load: () => Promise<void>): Promise<void> {
  let p = done.get(key);
  if (!p) {
    // a failed load leaves that level without our stories: today's card shows
    p = load()
      .catch(() => undefined)
      .then(() => void settled.add(key));
    done.set(key, p);
  }
  return p;
}

/** Loads (once) the part names and the story files for these game levels; never rejects. */
export async function loadDictionary(levels: Iterable<number>): Promise<void> {
  const jobs = [
    once("parts", async () => {
      const mod = (await import("../../dictionary/parts.json")) as {
        default: Record<string, { name: string }>;
      };
      for (const [g, v] of Object.entries(mod.default)) parts.set(g, v.name);
    }),
  ];
  for (const level of new Set(levels)) {
    const key = fileOf(level);
    const load: Loader | undefined = FILES[key];
    if (!load) continue;
    jobs.push(
      once(key, async () => {
        const mod = await load();
        for (const [c, e] of Object.entries(mod.default.kanji))
          entries.set(c, e);
      }),
    );
  }
  await Promise.all(jobs);
}

/** Whether these levels have finished loading (loaded or failed). */
export function dictionaryReady(levels: Iterable<number>): boolean {
  if (!settled.has("parts")) return false;
  for (const level of levels) {
    const key = fileOf(level);
    if (key in FILES && !settled.has(key)) return false;
  }
  return true;
}

/** What has loaded so far. */
export const dictionary: Dictionary = { parts, entries };
