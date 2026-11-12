import { loadToken, loadWkCache, saveWkCache, type WkStore } from "./cache";
import { trim, type WkCache } from "./parse";
import { buildLibrary, storyLevel, type StoryLibrary } from "./stories";

export const WK_BASE = "https://api.wanikani.com/v2/";
export const WK_REVISION = "20170710";
/** Minimum gap between fetch attempts. */
export const WK_THROTTLE_MS = 5 * 60 * 1000;
const MAX_PAGES = 50;

/**
 * - `ok`: freshly fetched; `cache` is the new cache.
 * - `offline`: network error, rate limit, server error or a malformed body;
 *   `cache` is the stored cache (or null if there is none).
 * - `invalid`: WaniKani rejected the token (401/403); `cache` is whatever is
 *   stored, for the caller to decide about.
 * - `none`: no token stored, nothing fetched; `cache` is null.
 */
export type WkStatus = "ok" | "offline" | "invalid" | "none";
export type WkFetchResult = { status: WkStatus; cache: WkCache | null };

/** Result of a stories fetch; `library` is set only with `ok`. */
export type StoriesResult =
  | { status: "ok"; library: StoryLibrary }
  | { status: "offline" | "invalid" | "none" };

export type WkClientDeps = {
  fetch: typeof fetch;
  store: WkStore;
  now: () => number;
};

export type WkClient = {
  /**
   * Fetches from WaniKani and updates the stored cache. Never throws. Within
   * 5 minutes of the last attempt (for the same token) it returns the previous
   * result without fetching; concurrent calls share one fetch.
   */
  refresh(): Promise<WkFetchResult>;
  /**
   * Fetches the story library (`/user`, then kanji and radical `/subjects`).
   * Never throws, never stores anything; the caller owns the result.
   */
  fetchStories(): Promise<StoriesResult>;
};

class Stop extends Error {
  constructor(readonly status: "offline" | "invalid") {
    super(status);
  }
}

export function createWkClient(deps: WkClientDeps): WkClient {
  const { store, now } = deps;
  let inflight: Promise<WkFetchResult> | null = null;
  let last: { token: string; at: number; result: WkFetchResult } | null = null;

  async function get(url: string, token: string): Promise<unknown> {
    if (!url.startsWith(WK_BASE)) throw new Stop("offline");
    let res: Response;
    try {
      res = await deps.fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Wanikani-Revision": WK_REVISION,
        },
      });
    } catch {
      throw new Stop("offline");
    }
    if (res.status === 401 || res.status === 403) throw new Stop("invalid");
    if (!res.ok) throw new Stop("offline");
    try {
      return await res.json();
    } catch {
      throw new Stop("offline");
    }
  }

  async function pages(first: string, token: string): Promise<unknown[]> {
    const out: unknown[] = [];
    let url: string | null = first;
    while (url !== null) {
      if (out.length >= MAX_PAGES) throw new Stop("offline");
      const page = await get(url, token);
      out.push(page);
      const next: unknown = (page as { pages?: { next_url?: unknown } } | null)
        ?.pages?.next_url;
      url = typeof next === "string" ? next : null;
    }
    return out;
  }

  async function fetchAll(token: string): Promise<WkCache> {
    const user = await get(`${WK_BASE}user`, token);
    const level = (user as { data?: { level?: unknown } } | null)?.data?.level;
    if (typeof level !== "number" || !Number.isInteger(level) || level < 1) {
      throw new Stop("offline");
    }
    const levels = Array.from({ length: level }, (_, i) => i + 1).join(",");
    const subjects = await pages(
      `${WK_BASE}subjects?types=kanji&levels=${levels}`,
      token,
    );
    const assignments = await pages(
      `${WK_BASE}assignments?subject_types=kanji&levels=${levels}`,
      token,
    );
    const r = trim(user, subjects, assignments);
    if (!r.ok) throw new Stop("offline");
    return r.value;
  }

  async function run(token: string): Promise<WkFetchResult> {
    try {
      const cache = await fetchAll(token);
      saveWkCache(store, cache);
      return { status: "ok", cache };
    } catch (e) {
      const status = e instanceof Stop ? e.status : "offline";
      return { status, cache: loadWkCache(store) };
    }
  }

  async function fetchLibrary(token: string): Promise<StoryLibrary> {
    const level = storyLevel(await get(`${WK_BASE}user`, token));
    if (!level.ok) throw new Stop("offline");
    const levels = Array.from({ length: level.value }, (_, i) => i + 1);
    const subjects = await pages(
      `${WK_BASE}subjects?types=kanji,radical&levels=${levels.join(",")}`,
      token,
    );
    const lib = buildLibrary(subjects);
    if (!lib.ok) throw new Stop("offline");
    return lib.value;
  }

  return {
    async fetchStories() {
      const token = loadToken(store);
      if (!token) return { status: "none" };
      try {
        return { status: "ok", library: await fetchLibrary(token) };
      } catch (e) {
        return { status: e instanceof Stop ? e.status : "offline" };
      }
    },
    refresh() {
      const token = loadToken(store);
      if (!token) return Promise.resolve({ status: "none", cache: null });
      if (inflight) return inflight;
      if (last && last.token === token && now() - last.at < WK_THROTTLE_MS) {
        return Promise.resolve(last.result);
      }
      const at = now();
      inflight = run(token)
        .then((result) => {
          last = { token, at, result };
          return result;
        })
        .finally(() => {
          inflight = null;
        });
      return inflight;
    },
  };
}
