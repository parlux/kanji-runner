/// <reference types="node" />
/**
 * `npm run stories:wk` (SPEC-own-stories: Pipeline): fetches the owner's
 * WaniKani library with `WANIKANI_TOKEN` from `.env.local`, through the game's
 * own client and `buildLibrary`, and writes the judge's comparison copy to
 * `.data-cache/stories/wk-library.json`. Dev-only: never committed, never
 * bundled, never read by the writer. Prints counts only.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { saveToken } from "../../src/wanikani/cache";
import { createWkClient } from "../../src/wanikani/client";
import type { StoryLibrary } from "../../src/wanikani/stories";

export const WK_LIBRARY = ".data-cache/stories/wk-library.json";

/** The comparison copy: per kanji its mnemonics and radical names, plus every radical name. */
export type WkDigest = {
  kanji: Record<
    string,
    { meaning: string | null; reading: string | null; radicals: string[] }
  >;
  radicals: string[];
};

export function digest(lib: StoryLibrary): WkDigest {
  const kanji: WkDigest["kanji"] = {};
  const radicals = new Set<string>();
  for (const [char, k] of Object.entries(lib.kanji)) {
    const names = k.radicals.map((r) => r.name);
    for (const n of names) radicals.add(n);
    kanji[char] = {
      meaning: k.meaning ?? null,
      reading: k.reading ?? null,
      radicals: names,
    };
  }
  return { kanji, radicals: [...radicals].sort() };
}

/** A `KEY=value` from a dotenv file (quotes optional), or null. */
export function envValue(text: string, key: string): string | null {
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([\w.]+)\s*=\s*(.*)$/.exec(line);
    if (m?.[1] !== key) continue;
    const v = (m[2] ?? "").trim().replace(/^(['"])(.*)\1$/, "$2");
    return v || null;
  }
  return null;
}

async function main() {
  const env = existsSync(".env.local")
    ? readFileSync(".env.local", "utf8")
    : "";
  const token = envValue(env, "WANIKANI_TOKEN");
  if (!token) {
    console.error("stories:wk: WANIKANI_TOKEN missing in .env.local");
    process.exit(1);
  }
  const mem = new Map<string, string>();
  const store = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
  };
  saveToken(store, token);
  const client = createWkClient({
    fetch: (...a) => fetch(...a),
    store,
    now: Date.now,
  });
  const r = await client.fetchStories();
  if (r.status !== "ok") {
    console.error(`stories:wk: fetch failed (${r.status})`);
    process.exit(1);
  }
  const d = digest(r.library);
  mkdirSync(".data-cache/stories", { recursive: true });
  writeFileSync(WK_LIBRARY, JSON.stringify(d, null, 1) + "\n");
  console.log(
    `wrote ${WK_LIBRARY}: ${Object.keys(d.kanji).length} kanji, ${d.radicals.length} radical names`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await main();
