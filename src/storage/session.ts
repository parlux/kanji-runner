import type { SessionItem, SessionLog } from "../core/session";
import type { KeyValueStore } from "./storage";

export const SESSION_KEY = "kanji-runner:session:v1";
/** Meaning mode keeps its own session log. */
export const MEANING_SESSION_KEY = "kanji-runner:meaning:session:v1";

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isTime = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

function toItem(v: unknown): SessionItem | null {
  if (!isObject(v)) return null;
  const { prompt, type, state } = v;
  if (typeof prompt !== "string") return null;
  if (type !== "kana" && type !== "meaning" && type !== "reading") return null;
  if (state !== "missing" && state !== "fixed") return null;
  return { prompt, type, state };
}

/**
 * Parsed JSON -> SessionLog, or null if it is not recognisably a log (bad
 * times or run count, or non-array lists). Single bad items and non-string
 * `fixedThisRun` entries are dropped.
 */
export function parseSessionLog(raw: unknown): SessionLog | null {
  if (!isObject(raw)) return null;
  const { startedAt, lastRunAt, runs, items, fixedThisRun } = raw;
  if (!isTime(startedAt) || !isTime(lastRunAt)) return null;
  if (typeof runs !== "number" || !Number.isInteger(runs) || runs < 0)
    return null;
  if (!Array.isArray(items) || !Array.isArray(fixedThisRun)) return null;
  return {
    startedAt,
    lastRunAt,
    runs,
    items: items.flatMap((v) => toItem(v) ?? []),
    fixedThisRun: fixedThisRun.filter(
      (k): k is string => typeof k === "string",
    ),
  };
}

/** The stored session log, or null when missing, corrupt or unreadable. Never throws. */
export function loadSessionLog(
  store: KeyValueStore,
  key: string = SESSION_KEY,
): SessionLog | null {
  try {
    const text = store.getItem(key);
    if (text === null) return null;
    return parseSessionLog(JSON.parse(text));
  } catch {
    return null;
  }
}

/** Writes the log. Returns false if storage refused; never throws. */
export function saveSessionLog(
  store: KeyValueStore,
  log: SessionLog,
  key: string = SESSION_KEY,
): boolean {
  try {
    store.setItem(key, JSON.stringify(log));
    return true;
  } catch {
    return false;
  }
}

export const loadMeaningSessionLog = (
  store: KeyValueStore,
): SessionLog | null => loadSessionLog(store, MEANING_SESSION_KEY);

export const saveMeaningSessionLog = (
  store: KeyValueStore,
  log: SessionLog,
): boolean => saveSessionLog(store, log, MEANING_SESSION_KEY);
