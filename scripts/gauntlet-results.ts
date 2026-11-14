/// <reference types="node" />
/**
 * Prints the latest horde gauntlet runs (`?sandbox=horde`) saved to Supabase:
 * `npx tsx scripts/gauntlet-results.ts [n]` (n defaults to 3).
 *
 * Reads `VITE_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from `.env.local`
 * (the service-role key bypasses row-level security, so it never goes in
 * the app or in git). The key is never printed.
 */
import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { RATINGS } from "../src/game/sandbox/gauntlet";
import {
  parseResults,
  type GauntletResults,
} from "../src/game/sandbox/results";

const ENV_FILE = ".env.local";

/** KEY=value lines of a dotenv file (comments, blanks and `export ` skipped; quotes stripped). */
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

/** What the script needs, or a message saying what is missing. */
export function readConfig(
  env: Record<string, string>,
  fileFound: boolean,
): { url: string; key: string } | { error: string } {
  const url = env.VITE_SUPABASE_URL ?? "";
  const key = env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const missing = [
    !url && "VITE_SUPABASE_URL",
    !key && "SUPABASE_SERVICE_ROLE_KEY",
  ].filter((m): m is string => !!m);
  if (missing.length === 0) return { url: url.replace(/\/+$/, ""), key };
  const where = fileFound ? ENV_FILE : `${ENV_FILE} (not found)`;
  return {
    error:
      `Missing ${missing.join(" and ")} in ${where}.\n` +
      (missing.includes("SUPABASE_SERVICE_ROLE_KEY")
        ? "Add SUPABASE_SERVICE_ROLE_KEY=<the service_role key from Supabase: Project Settings → API keys>. Never commit it.\n"
        : ""),
  };
}

/** The count argument: a whole number ≥ 1, else 3. */
export function parseCount(arg: string | undefined): number {
  const n = Number(arg);
  return Number.isInteger(n) && n >= 1 ? n : 3;
}

const pad = (s: string, n: number): string =>
  s.length >= n ? s : s + " ".repeat(n - s.length);

/** One run as a table: a row per wave, its preset, what it measured and the rating. */
export function runTable(r: GauntletResults): string {
  const head = [
    "#",
    "rating",
    "army",
    "for",
    "enem",
    "kill",
    "width",
    "size",
    "adapt",
    "| kill",
    "heads",
    "reached",
    "lost",
    "fps",
    "note",
  ];
  const rows = r.waves.map((w) => {
    const p = w.preset;
    return [
      String(w.wave),
      RATINGS.find((x) => x.id === w.rating)?.label ?? "-",
      String(p.army),
      String(p.expected),
      String(p.enemies),
      `${p.killSeconds}s`,
      String(p.packWidth),
      String(p.hordeScale),
      String(p.packAdapt),
      "| " + (w.killSeconds === null ? "reached" : `${w.killSeconds}s`),
      String(w.enemies),
      String(w.reached),
      String(w.lost) + (w.died ? " died" : ""),
      String(w.fps),
      p.note,
    ];
  });
  const widths = head.map((h, i) =>
    Math.max(h.length, ...rows.map((row) => (row[i] ?? "").length)),
  );
  const line = (cells: string[]): string =>
    cells
      .map((c, i) => pad(c, i === cells.length - 1 ? 0 : (widths[i] ?? 0)))
      .join("  ")
      .trimEnd();
  return [
    `${r.createdAt.slice(0, 16).replace("T", " ")} UTC · build ${r.version} · ${r.device}`,
    line(head),
    ...rows.map(line),
  ].join("\n");
}

/** The rows the REST API returned, as printable text (newest first). */
export function formatRows(rows: unknown): string {
  if (!Array.isArray(rows)) return "Unexpected reply from Supabase.";
  if (rows.length === 0) return "No gauntlet runs saved yet.";
  return rows
    .map((row: unknown) => {
      const data =
        typeof row === "object" && row !== null && "data" in row
          ? row.data
          : null;
      const r = parseResults(data);
      return r ? runTable(r) : "(a row that isn't a gauntlet run)";
    })
    .join("\n\n");
}

async function main(): Promise<number> {
  const found = existsSync(ENV_FILE);
  const config = readConfig(
    found ? parseEnv(readFileSync(ENV_FILE, "utf8")) : {},
    found,
  );
  if ("error" in config) {
    process.stderr.write(config.error);
    return 1;
  }
  const n = parseCount(process.argv[2]);
  const res = await fetch(
    `${config.url}/rest/v1/tuning_results?select=created_at,data&order=created_at.desc&limit=${n}`,
    { headers: { apikey: config.key, Authorization: `Bearer ${config.key}` } },
  );
  if (!res.ok) {
    const body = await res.text();
    process.stderr.write(
      `Supabase said ${res.status}: ${body.slice(0, 300)}\n` +
        (res.status === 404 || body.includes("tuning_results")
          ? "Has the tuning_results SQL in supabase/schema.sql been run in the dashboard?\n"
          : ""),
    );
    return 1;
  }
  process.stdout.write(formatRows(await res.json()) + "\n");
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
