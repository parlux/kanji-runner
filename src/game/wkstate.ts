import { KANJI } from "../core/kanji";
import type { Mnemonics, Story } from "../core/study";
import { STORY_MAX_AGE_MS } from "../core/tuning";
import {
  loadMode,
  loadToken,
  loadWkCache,
  removeToken,
  saveMode,
  saveToken,
  type WkMode,
  type WkStore,
} from "../wanikani/cache";
import {
  WK_THROTTLE_MS,
  type WkClient,
  type WkStatus,
} from "../wanikani/client";
import { buildList, type WkCache, type WkList } from "../wanikani/parse";
import { storyLookup } from "../wanikani/stories";
import {
  createMemoryStoryStore,
  tokenTail,
  type StoredLibrary,
  type StoryStore,
} from "../wanikani/storystore";

/** What the start screen shows about WaniKani. */
export type WkView = {
  hasToken: boolean;
  /** The mode runs use: WaniKani only when there is data for it. */
  mode: WkMode;
  /** Whether the Built-in / WaniKani switch is offered. */
  canSwitch: boolean;
  /** The status text, or null with no token. */
  label: string | null;
  level: number;
  /** Taught kanji due for review now. */
  due: number;
};

export type WkState = {
  /** Fetches (throttled by the client) and updates the view. Never throws. */
  refresh(): Promise<void>;
  view(): WkView;
  /** The list runs are built from, or null in Built-in mode. */
  list(): WkList | null;
  setMode(mode: WkMode): void;
  /** Stores a token and fetches. Never changes the mode. */
  save(token: string): Promise<void>;
  /** Clears token, cache, story library and mode: back to Built-in, progress untouched. */
  remove(): void;
  /** The saved token, for the form to show masked. */
  token(): string | null;
  /** True once per detection of an invalid token. */
  takeInvalid(): boolean;
  /** The study mnemonics by character (WaniKani mode only). */
  mnemonics(): ReadonlyMap<string, Mnemonics> | undefined;
  /**
   * The story library by character (mnemonics and radicals), in either mode;
   * undefined with no token, before it has loaded or fetched, or when it was
   * fetched with a different token.
   */
  stories(): ReadonlyMap<string, Story> | undefined;
};

export function createWkState(deps: {
  store: WkStore;
  makeClient: () => WkClient;
  /** Where the story library lives; memory only when omitted. */
  storyStore?: StoryStore;
  now: () => number;
}): WkState {
  const { store, now } = deps;
  let client = deps.makeClient();
  let cache: WkCache | null = loadWkCache(store);
  let status: WkStatus | null = null;
  let mode = loadMode(store);
  let list: WkList | null = null;
  let invalidPending = false;

  const storyStore = deps.storyStore ?? createMemoryStoryStore();
  let record: StoredLibrary | null = null;
  let lookup: ReadonlyMap<string, Story> | null = null;
  // Bumped when the token changes, so an old fetch cannot store its result.
  let generation = 0;
  let storyAttempt: { tail: string; at: number } | null = null;
  let storyInflight: Promise<void> | null = null;
  const loaded: Promise<void> = storyStore
    .load()
    .then((r) => {
      record = r;
      lookup = null;
    })
    .catch(() => undefined);

  const currentRecord = (): StoredLibrary | null => {
    const token = loadToken(store);
    return record && token && record.tokenTail === tokenTail(token)
      ? record
      : null;
  };

  const syncStories = async (): Promise<void> => {
    await loaded;
    const token = loadToken(store);
    if (!token) return;
    const tail = tokenTail(token);
    const age = record ? now() - record.fetchedAt : 0;
    const fresh =
      record !== null &&
      record.tokenTail === tail &&
      age >= 0 &&
      age <= STORY_MAX_AGE_MS;
    if (fresh) return;
    if (storyInflight) return storyInflight;
    if (
      storyAttempt &&
      storyAttempt.tail === tail &&
      now() - storyAttempt.at < WK_THROTTLE_MS
    ) {
      return;
    }
    const gen = generation;
    const at = now();
    storyAttempt = { tail, at };
    storyInflight = (async () => {
      const r = await client.fetchStories();
      if (r.status !== "ok" || gen !== generation) return;
      record = { library: r.library, tokenTail: tail, fetchedAt: at };
      lookup = null;
      await storyStore.save(record);
    })()
      .catch(() => undefined)
      .finally(() => {
        storyInflight = null;
      });
    return storyInflight;
  };

  const rebuild = () => {
    list = cache ? buildList(cache, KANJI, now()) : null;
  };
  rebuild();

  const apply = (r: { status: WkStatus; cache: WkCache | null }) => {
    const wasInvalid = status === "invalid";
    status = r.status;
    cache = r.cache;
    rebuild();
    if (r.status === "invalid" && !wasInvalid) invalidPending = true;
  };

  const refresh = async () => {
    rebuild();
    apply(await client.refresh());
    await syncStories();
  };

  return {
    refresh,
    view() {
      const hasToken = loadToken(store) !== null;
      const label = !hasToken
        ? null
        : status === "invalid"
          ? "WaniKani token invalid"
          : status === "offline"
            ? "WaniKani offline"
            : list
              ? `WaniKani · level ${list.level} · ${dueCount(list)} due`
              : "WaniKani · loading";
      return {
        hasToken,
        mode: hasToken && list && mode === "wanikani" ? "wanikani" : "builtin",
        canSwitch: hasToken && list !== null,
        label,
        level: list?.level ?? 0,
        due: list ? dueCount(list) : 0,
      };
    },
    list() {
      return this.view().mode === "wanikani" ? list : null;
    },
    setMode(m) {
      mode = m;
      saveMode(store, m);
    },
    async save(token) {
      saveToken(store, token);
      client = deps.makeClient();
      status = null;
      cache = loadWkCache(store);
      invalidPending = false;
      generation++;
      storyAttempt = null;
      await refresh();
    },
    remove() {
      removeToken(store);
      client = deps.makeClient();
      cache = null;
      status = null;
      mode = "builtin";
      invalidPending = false;
      generation++;
      storyAttempt = null;
      record = null;
      lookup = null;
      void storyStore.delete().catch(() => undefined);
      rebuild();
    },
    token: () => loadToken(store),
    takeInvalid() {
      const p = invalidPending;
      invalidPending = false;
      return p;
    },
    stories() {
      const rec = currentRecord();
      if (!rec) return undefined;
      return (lookup ??= storyLookup(rec.library));
    },
    mnemonics() {
      const l = this.list();
      if (!l) return undefined;
      return new Map([...l.extras].map(([c, x]) => [c, x.mnemonics]));
    },
  };
}

export const dueCount = (l: WkList): number =>
  [...l.extras.values()].filter((x) => x.due).length;
