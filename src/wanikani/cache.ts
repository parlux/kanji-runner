import type { KeyValueStore as ReadWrite } from "../storage/storage";
import { parseCache, type WkCache } from "./parse";

/** Device-local WaniKani state. Never part of `Progress` or sync. */
export const WK_TOKEN_KEY = "kanji-runner:wk-token";
export const WK_CACHE_KEY = "kanji-runner:wk-cache";
export const WK_MODE_KEY = "kanji-runner:wk-mode";

export type WkMode = "builtin" | "wanikani";

/** The slice of `localStorage` used here, so tests can pass a fake. */
export type WkStore = ReadWrite & Pick<Storage, "removeItem">;

function read(store: WkStore, key: string): string | null {
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
}

function write(store: WkStore, key: string, value: string): boolean {
  try {
    store.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function remove(store: WkStore, key: string): void {
  try {
    store.removeItem(key);
  } catch {
    // Nothing more to do.
  }
}

/** The stored token, or null when none (or storage is unreadable). */
export function loadToken(store: WkStore): string | null {
  const t = read(store, WK_TOKEN_KEY)?.trim();
  return t ? t : null;
}

/** Stores the token. Returns false if storage refused. */
export function saveToken(store: WkStore, token: string): boolean {
  return write(store, WK_TOKEN_KEY, token.trim());
}

/** The stored cache, or null when missing, corrupt or the wrong version. */
export function loadWkCache(store: WkStore): WkCache | null {
  const text = read(store, WK_CACHE_KEY);
  if (text === null) return null;
  try {
    const r = parseCache(JSON.parse(text));
    return r.ok ? r.value : null;
  } catch {
    return null;
  }
}

/** Stores the cache. Returns false if storage refused (e.g. full). */
export function saveWkCache(store: WkStore, cache: WkCache): boolean {
  return write(store, WK_CACHE_KEY, JSON.stringify(cache));
}

/** The per-device mode; built-in unless set and a token exists. */
export function loadMode(store: WkStore): WkMode {
  return read(store, WK_MODE_KEY) === "wanikani" && loadToken(store)
    ? "wanikani"
    : "builtin";
}

export function saveMode(store: WkStore, mode: WkMode): boolean {
  return write(store, WK_MODE_KEY, mode);
}

/** "Remove token": clears the token and cache, and resets mode to built-in. */
export function removeToken(store: WkStore): void {
  remove(store, WK_TOKEN_KEY);
  remove(store, WK_CACHE_KEY);
  remove(store, WK_MODE_KEY);
}
