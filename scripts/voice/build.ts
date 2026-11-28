/// <reference types="node" />
/**
 * Dev-only clip build (SPEC-sound-effects §3): `npm run voice:build`.
 *
 * Renders every line in `allSpoken` through a running VOICEVOX engine (HTTP
 * API at `VOICEVOX_URL`, default `http://127.0.0.1:50021`) in the character
 * of `voice.config.json`, trims the silence and encodes mono AAC `.m4a` with
 * `ffmpeg`. Writes `public/voice/<id>/<hash8>.m4a` and `index.json`
 * (`{ key: [file, ms] }`). Incremental: clips already in the index are kept;
 * keys no longer in `allSpoken` are deleted.
 *
 * A word's `audio_query` on its written form keeps the dictionary's pitch
 * accent; it is used when its moras read like the kana reading (the engine's
 * own query of the reading), else the reading is queried instead.
 *
 * Options: `--force` (re-render kept clips), `--limit N` (render at most N),
 * `--keys a,b` (only these keys, by full `text|reading` key or by text),
 * `--config <file>` and `--out <dir>` (another character or output folder,
 * e.g. for sample pages).
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { KANA } from "../../src/core/kana";
import { KANJI } from "../../src/core/kanji";
import { allSpoken, clipKey, type Spoken } from "../../src/core/speech";
import { WORDS } from "../../src/core/words";

export type VoiceConfig = {
  /** Folder name under `public/voice/`. */
  id: string;
  /** VOICEVOX style id. */
  speaker: number;
  /** Character name, for the credit `VOICEVOX:<name>`. */
  name: string;
  speed: number;
};

export type ClipIndex = Record<string, [file: string, ms: number]>;

type Mora = { text: string };
type AudioQuery = {
  accent_phrases: { moras: Mora[]; pause_mora: Mora | null }[];
  speedScale: number;
};

export const CONFIG = "scripts/voice/voice.config.json";
const ENGINE = process.env.VOICEVOX_URL ?? "http://127.0.0.1:50021";

/** The clip file of a key: 8 hex digits of its SHA-256. */
export const clipFile = (key: string): string =>
  `${createHash("sha256").update(key).digest("hex").slice(0, 8)}.m4a`;

const toHiragana = (s: string): string =>
  s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

/** What a query says, in hiragana (pauses left out). */
export const moraKana = (q: AudioQuery): string =>
  toHiragana(
    q.accent_phrases.flatMap((p) => p.moras.map((m) => m.text)).join(""),
  );

/** The index as Prettier would write it: one key per line, sorted. */
export function formatIndex(index: ClipIndex): string {
  const keys = Object.keys(index).sort();
  if (keys.length === 0) return "{}\n";
  const lines = keys.map(
    (k) =>
      `  ${JSON.stringify(k)}: ${JSON.stringify(index[k]).replace(",", ", ")}`,
  );
  return `{\n${lines.join(",\n")}\n}\n`;
}

/** `--keys` picks by full key or by text. */
export function pick(
  all: readonly Spoken[],
  wanted: readonly string[],
): Spoken[] {
  const want = new Set(wanted);
  return all.filter((s) => want.has(clipKey(s)) || want.has(s.text));
}

async function post(path: string, body?: unknown): Promise<Response> {
  const res = await fetch(`${ENGINE}${path}`, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok)
    throw new Error(
      `${path.split("?")[0]}: HTTP ${res.status} ${await res.text()}`,
    );
  return res;
}

const query = async (text: string, speaker: number): Promise<AudioQuery> =>
  (await (
    await post(
      `/audio_query?speaker=${speaker}&text=${encodeURIComponent(text)}`,
    )
  ).json()) as AudioQuery;

/** The query to synthesize: the written form's when it reads right, else the reading's. */
async function bestQuery(
  s: Spoken,
  speaker: number,
): Promise<{ q: AudioQuery; fellBack: boolean }> {
  const byReading = await query(s.reading, speaker);
  if (s.text === s.reading) return { q: byReading, fellBack: false };
  const byText = await query(s.text, speaker);
  const reads = moraKana(byText);
  const ok = reads === toHiragana(s.reading) || reads === moraKana(byReading);
  return ok ? { q: byText, fellBack: false } : { q: byReading, fellBack: true };
}

/** Trim leading and trailing silence; mono AAC at ~40 kbps. Returns the clip's length in ms. */
function encode(wav: string, out: string): number {
  const trim = "silenceremove=start_periods=1:start_threshold=-50dB";
  execFileSync("ffmpeg", [
    "-v",
    "error",
    "-y",
    "-i",
    wav,
    "-af",
    `${trim},areverse,${trim},areverse`,
    "-ac",
    "1",
    "-c:a",
    "aac",
    "-b:a",
    "40k",
    "-movflags",
    "+faststart",
    out,
  ]);
  const s = execFileSync("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "csv=p=0",
    out,
  ]).toString();
  return Math.round(Number(s) * 1000);
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i < 0 ? undefined : process.argv[i + 1];
}

async function main(): Promise<void> {
  const config = JSON.parse(
    readFileSync(arg("--config") ?? CONFIG, "utf8"),
  ) as VoiceConfig;
  const dir = arg("--out") ?? join("public/voice", config.id);
  const force = process.argv.includes("--force");
  const limit = Number(arg("--limit") ?? Infinity);
  const keysArg = arg("--keys");

  const all = allSpoken({ kana: KANA, kanji: KANJI, words: WORDS });
  const used = new Set(all.map(clipKey));
  const todo = keysArg ? pick(all, keysArg.split(",")) : all;
  if (keysArg && todo.length === 0)
    throw new Error(`no line matches --keys ${keysArg}`);

  mkdirSync(dir, { recursive: true });
  const indexFile = join(dir, "index.json");
  const old: ClipIndex = existsSync(indexFile)
    ? (JSON.parse(readFileSync(indexFile, "utf8")) as ClipIndex)
    : {};

  // Keys no longer used, and files no key points at, go.
  const index: ClipIndex = Object.fromEntries(
    Object.entries(old).filter(([key]) => used.has(key)),
  );
  let deleted = 0;
  const kept = new Set(Object.values(index).map(([f]) => f));
  for (const f of readdirSync(dir))
    if (f.endsWith(".m4a") && !kept.has(f)) {
      rmSync(join(dir, f));
      deleted++;
    }

  const tmp = mkdtempSync(join(tmpdir(), "voice-"));
  const fellBack: string[] = [];
  const failed: string[] = [];
  let rendered = 0;
  let bytes = 0;
  const started = Date.now();
  try {
    for (const s of todo) {
      if (rendered >= limit) break;
      const key = clipKey(s);
      const file = clipFile(key);
      if (!force && index[key] && existsSync(join(dir, file))) continue;
      try {
        const { q, fellBack: fb } = await bestQuery(s, config.speaker);
        q.speedScale = config.speed;
        const wav = join(tmp, "clip.wav");
        writeFileSync(
          wav,
          Buffer.from(
            await (
              await post(`/synthesis?speaker=${config.speaker}`, q)
            ).arrayBuffer(),
          ),
        );
        index[key] = [file, encode(wav, join(dir, file))];
        bytes += readFileSync(join(dir, file)).length;
        rendered++;
        if (fb) fellBack.push(key);
        if (rendered % 50 === 0) {
          writeFileSync(indexFile, formatIndex(index));
          console.log(`${rendered} rendered…`);
        }
      } catch (e) {
        failed.push(`${key}: ${(e as Error).message}`);
      }
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
    writeFileSync(indexFile, formatIndex(index));
  }

  const secs = (Date.now() - started) / 1000;
  console.log(
    `${config.name} (style ${config.speaker}) → ${dir}: ${rendered} rendered` +
      (rendered
        ? ` (avg ${(bytes / rendered / 1024).toFixed(1)} KB, ${(secs / rendered).toFixed(2)} s each)`
        : "") +
      `, ${Object.keys(index).length} in index, ${deleted} deleted, ${fellBack.length} fell back to the reading, ${failed.length} failed`,
  );
  if (fellBack.length)
    console.log(
      `fell back: ${fellBack.slice(0, 30).join(" ")}${fellBack.length > 30 ? " …" : ""}`,
    );
  for (const f of failed.slice(0, 20)) console.log(`failed: ${f}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await main();
