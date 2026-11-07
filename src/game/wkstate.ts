import { KANJI } from "../core/kanji";
import type { Mnemonics } from "../core/study";
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
import type { WkClient, WkStatus } from "../wanikani/client";
import { buildList, type WkCache, type WkList } from "../wanikani/parse";

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
  /** Stores a token and starts using WaniKani as soon as its first fetch works. */
  save(token: string): Promise<void>;
  /** Clears token, cache and mode: back to Built-in, progress untouched. */
  remove(): void;
  /** The saved token, for the form to show masked. */
  token(): string | null;
  /** True once per detection of an invalid token. */
  takeInvalid(): boolean;
  /** The study mnemonics by character (WaniKani mode only). */
  mnemonics(): ReadonlyMap<string, Mnemonics> | undefined;
};

export function createWkState(deps: {
  store: WkStore;
  makeClient: () => WkClient;
  now: () => number;
}): WkState {
  const { store, now } = deps;
  let client = deps.makeClient();
  let cache: WkCache | null = loadWkCache(store);
  let status: WkStatus | null = null;
  let mode = loadMode(store);
  let list: WkList | null = null;
  let invalidPending = false;
  let switchOnOk = false;

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
    if (r.status === "ok" && switchOnOk) {
      switchOnOk = false;
      mode = "wanikani";
      saveMode(store, mode);
    }
  };

  const refresh = async () => {
    rebuild();
    apply(await client.refresh());
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
      switchOnOk = true;
      await refresh();
    },
    remove() {
      removeToken(store);
      client = deps.makeClient();
      cache = null;
      status = null;
      mode = "builtin";
      invalidPending = false;
      switchOnOk = false;
      rebuild();
    },
    token: () => loadToken(store),
    takeInvalid() {
      const p = invalidPending;
      invalidPending = false;
      return p;
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
