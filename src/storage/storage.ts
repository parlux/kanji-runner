import { defaultProgress, MAX_BOX } from "../core/srs";
import type { ItemProgress, Progress } from "../core/types";

export const STORAGE_KEY = "kanji-runner:v1";
export const SCHEMA_VERSION = 1;

/** The slice of `localStorage` used here, so tests can pass a fake. */
export type KeyValueStore = Pick<Storage, "getItem" | "setItem">;

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isCount = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= 0;

/**
 * Upgrades from older schema versions: `MIGRATIONS[n]` turns version n into
 * n + 1. Empty while the schema is at version 1.
 */
const MIGRATIONS: Record<number, (old: Json) => Json> = {};

function toItem(v: unknown): ItemProgress | null {
  if (!isObject(v)) return null;
  const { box, seen, correct, wrong, lastSeen } = v;
  if (!isCount(box) || box > MAX_BOX) return null;
  if (!isCount(seen) || !isCount(correct) || !isCount(wrong)) return null;
  if (typeof lastSeen !== "number" || !Number.isFinite(lastSeen)) return null;
  return { box, seen, correct, wrong, lastSeen };
}

/**
 * Parsed JSON → Progress at the current schema version, or null if it is not
 * recognisably progress. Single bad item records are dropped.
 */
export function migrate(raw: unknown): Progress | null {
  if (!isObject(raw) || !isCount(raw.version)) return null;
  let data = raw;
  for (let v = raw.version; v < SCHEMA_VERSION; v++) {
    const step = MIGRATIONS[v];
    if (!step) return null;
    data = step(data);
  }
  if (data.version !== SCHEMA_VERSION) return null;
  const { unlockedLevel, items, stats } = data;
  if (!isCount(unlockedLevel) || !isObject(items) || !isObject(stats))
    return null;
  const { runs, wins, losses } = stats;
  if (!isCount(runs) || !isCount(wins) || !isCount(losses)) return null;
  const out: Progress = {
    version: 1,
    unlockedLevel,
    items: {},
    stats: { runs, wins, losses },
  };
  for (const [key, v] of Object.entries(items)) {
    const item = toItem(v);
    if (item) out.items[key] = item;
  }
  return out;
}

/** Stored progress, or defaults when missing, corrupt or unreadable. Never throws. */
export function loadProgress(store: KeyValueStore): Progress {
  try {
    const text = store.getItem(STORAGE_KEY);
    if (text === null) return defaultProgress();
    return migrate(JSON.parse(text)) ?? defaultProgress();
  } catch {
    return defaultProgress();
  }
}

/** Writes progress. Returns false if storage refused (full, blocked); never throws. */
export function saveProgress(
  store: KeyValueStore,
  progress: Progress,
): boolean {
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}
