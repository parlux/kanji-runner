/// <reference types="node" />
/**
 * Lists the story flags sent from the game (SPEC-own-stories: Flag):
 * `npm run stories:flags [-- --resolve <id,…>]`.
 *
 * Reads `VITE_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from `.env.local`
 * (the service-role key bypasses row-level security, so it never goes in the
 * app or in git; it is never printed). Prints each unresolved flag with our
 * current story; `--resolve` marks the given ids resolved after a rewrite pass.
 */
import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { DICTIONARY } from "./levels";

const ENV_FILE = ".env.local";
const TABLE_HINT =
  "No story_flags table yet: run supabase/story-flags.sql once in the Supabase SQL editor.";

/** KEY=value lines of a dotenv file (comments and blanks skipped; quotes stripped). */
export function parseEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim().replace(/^export\s+/, "");
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    let value = line.slice(eq + 1).trim();
    if (/^(["']).*\1$/.test(value)) value = value.slice(1, -1);
    out[line.slice(0, eq).trim()] = value;
  }
  return out;
}

/** The ids after `--resolve` (comma separated whole numbers), or null when absent; throws on a bad list. */
export function parseResolve(argv: readonly string[]): number[] | null {
  const i = argv.indexOf("--resolve");
  if (i < 0) return null;
  const ids = (argv[i + 1] ?? "").split(",").map((s) => s.trim());
  if (ids.some((s) => !/^\d+$/.test(s)))
    throw new Error("--resolve expects ids like 3,5,8");
  return ids.map(Number);
}

/** The story file name for a level as the player sees it ("Kanji 5" → kanji-005.json), or null. */
export function storyFileOfLevel(level: string): string | null {
  const m = /^Kanji (\d+)$/.exec(level);
  return m ? `kanji-${String(Number(m[1])).padStart(3, "0")}.json` : null;
}

type Entry = { meaning?: string; on?: string; kun?: string };
export type FlagRow = {
  id: number;
  kanji: string;
  level: string;
  note: string;
  created_at: string;
};

const plain = (s: string): string => s.replace(/<[^<>]*>/g, "");

/** Our current story for a kanji as plain text lines, or a note that there is none. */
export function storyText(entry: Entry | undefined): string {
  if (!entry) return "  (no story in dictionary/)";
  return (["meaning", "on", "kun"] as const)
    .flatMap((f) => (entry[f] ? [`  ${f}: ${plain(entry[f])}`] : []))
    .join("\n");
}

const isRow = (v: unknown): v is FlagRow => {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  return typeof r.id === "number" && typeof r.kanji === "string";
};

/** The flags as printable text; `story` looks up our current story for a flag. */
export function formatFlags(
  rows: unknown,
  story: (row: FlagRow) => string,
): string {
  if (!Array.isArray(rows)) return "Unexpected reply from Supabase.";
  const flags = rows.filter(isRow);
  if (flags.length === 0) return "No unresolved story flags.";
  return flags
    .map((r) =>
      [
        `#${r.id} ${r.kanji} (${r.level}) ${String(r.created_at).slice(0, 10)}`,
        `  note: ${r.note || "(none)"}`,
        story(r),
      ].join("\n"),
    )
    .join("\n\n");
}

/** Whether Supabase's reply to a read means the table has not been created. */
export const tableMissing = (status: number, body: string): boolean =>
  status === 404 || body.includes("PGRST205") || body.includes("story_flags");

function ourStory(row: FlagRow): string {
  const file = storyFileOfLevel(row.level);
  const path = file ? `${DICTIONARY}/stories/${file}` : "";
  if (!path || !existsSync(path)) return storyText(undefined);
  const data = JSON.parse(readFileSync(path, "utf8")) as {
    kanji?: Record<string, Entry>;
  };
  return storyText(data.kanji?.[row.kanji]);
}

async function main(): Promise<number> {
  const resolve = parseResolve(process.argv.slice(2));
  const env = existsSync(ENV_FILE)
    ? parseEnv(readFileSync(ENV_FILE, "utf8"))
    : {};
  const url = (env.VITE_SUPABASE_URL ?? "").replace(/\/+$/, "");
  const key = env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) {
    process.stderr.write(
      `Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in ${ENV_FILE}.\n`,
    );
    return 1;
  }
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const base = `${url}/rest/v1/story_flags`;
  if (resolve) {
    const res = await fetch(`${base}?id=in.(${resolve.join(",")})`, {
      method: "PATCH",
      headers: {
        ...headers,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ resolved_at: new Date().toISOString() }),
    });
    const body = await res.text();
    if (!res.ok) {
      if (tableMissing(res.status, body)) {
        process.stdout.write(TABLE_HINT + "\n");
        return 0;
      }
      process.stderr.write(
        `Supabase said ${res.status}: ${body.slice(0, 300)}\n`,
      );
      return 1;
    }
    const n = (JSON.parse(body) as unknown[]).length;
    process.stdout.write(`Resolved ${n} flag${n === 1 ? "" : "s"}.\n`);
    return 0;
  }
  const res = await fetch(
    `${base}?select=id,kanji,level,note,created_at&resolved_at=is.null&order=created_at.asc`,
    { headers },
  );
  if (!res.ok) {
    const body = await res.text();
    if (tableMissing(res.status, body)) {
      process.stdout.write(TABLE_HINT + "\n");
      return 0;
    }
    process.stderr.write(
      `Supabase said ${res.status}: ${body.slice(0, 300)}\n`,
    );
    return 1;
  }
  process.stdout.write(formatFlags(await res.json(), ourStory) + "\n");
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().then(
    (code) => (process.exitCode = code),
    (e: unknown) => {
      process.stderr.write(`Failed: ${String(e)}\n`);
      process.exitCode = 1;
    },
  );
