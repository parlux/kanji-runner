import { describe, expect, it } from "vitest";
import { createWkState, dueCount } from "../../src/game/wkstate";
import { loadMode, saveToken, type WkStore } from "../../src/wanikani/cache";
import type { WkClient, WkFetchResult } from "../../src/wanikani/client";
import { trim, type WkCache } from "../../src/wanikani/parse";
import { buildLibrary } from "../../src/wanikani/stories";
import {
  createMemoryStoryStore,
  tokenTail,
} from "../../src/wanikani/storystore";
import { STORY_MAX_AGE_MS } from "../../src/core/tuning";
import { WK_THROTTLE_MS, type StoriesResult } from "../../src/wanikani/client";
import storiesFixture from "../wanikani/fixtures/stories.json";
import assignments from "../wanikani/fixtures/assignments.json";
import subjects from "../wanikani/fixtures/subjects.json";
import user from "../wanikani/fixtures/user.json";

function fakeStore(): WkStore {
  const data = new Map<string, string>();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const built = trim(user, subjects, assignments);
if (!built.ok) throw new Error("fixture");
const CACHE: WkCache = built.value;

const lib = buildLibrary(storiesFixture);
if (!lib.ok) throw new Error("fixture");
const LIBRARY = lib.value;
const TOKEN = "test-token-0000-1111";

function setup(result: WkFetchResult, token = true) {
  const store = fakeStore();
  if (token) saveToken(store, TOKEN);
  const storyStore = createMemoryStoryStore();
  let next = result;
  let storiesNext: StoriesResult = { status: "ok", library: LIBRARY };
  let t = 1_000_000;
  const storyCalls = { n: 0 };
  const state = createWkState({
    store,
    storyStore,
    now: () => t,
    makeClient: () =>
      ({
        refresh: async () => next,
        fetchStories: async () => {
          storyCalls.n++;
          return storiesNext;
        },
      }) as WkClient,
  });
  return {
    state,
    store,
    storyStore,
    storyCalls,
    set: (r: WkFetchResult) => (next = r),
    setStories: (r: StoriesResult) => (storiesNext = r),
    advance: (ms: number) => (t += ms),
    time: () => t,
  };
}

describe("wk state", () => {
  it("is built-in with no token", async () => {
    const { state } = setup({ status: "none", cache: null }, false);
    await state.refresh();
    expect(state.view()).toMatchObject({
      hasToken: false,
      mode: "builtin",
      canSwitch: false,
      label: null,
    });
    expect(state.list()).toBeNull();
  });

  it("saving a token fetches but keeps Built-in mode", async () => {
    const { state, store } = setup({ status: "ok", cache: CACHE });
    await state.save(TOKEN);
    const v = state.view();
    expect(v.mode).toBe("builtin");
    expect(v.canSwitch).toBe(true);
    expect(loadMode(store)).toBe("builtin");
    expect(v.label).toBe(`WaniKani · level ${CACHE.level} · ${v.due} due`);
    const list = state.list();
    expect(list).toBeNull();
    state.setMode("wanikani");
    const wl = state.list();
    if (!wl) throw new Error("no list");
    expect(v.due).toBe(dueCount(wl));
  });

  it("plays built-in until data arrives, even in WaniKani mode", async () => {
    const { state } = setup({ status: "offline", cache: null });
    state.setMode("wanikani");
    await state.refresh();
    expect(state.view()).toMatchObject({
      mode: "builtin",
      canSwitch: false,
      label: "WaniKani offline",
    });
    expect(state.list()).toBeNull();
  });

  it("invalid keeps the cache and asks for the form once", async () => {
    const { state, set } = setup({ status: "ok", cache: CACHE });
    await state.save("test-token-0000-1111");
    state.setMode("wanikani");
    set({ status: "invalid", cache: CACHE });
    await state.refresh();
    expect(state.view().label).toBe("WaniKani token invalid");
    expect(state.list()).not.toBeNull();
    expect(state.takeInvalid()).toBe(true);
    await state.refresh();
    expect(state.takeInvalid()).toBe(false);
  });

  it("offline label with a cache", async () => {
    const { state, set } = setup({ status: "ok", cache: CACHE });
    await state.save("test-token-0000-1111");
    state.setMode("wanikani");
    set({ status: "offline", cache: CACHE });
    await state.refresh();
    expect(state.view().label).toBe("WaniKani offline");
    expect(state.view().mode).toBe("wanikani");
  });

  it("remove returns to built-in and clears everything", async () => {
    const { state, store } = setup({ status: "ok", cache: CACHE });
    await state.save("test-token-0000-1111");
    state.setMode("wanikani");
    state.remove();
    expect(state.view()).toMatchObject({ hasToken: false, mode: "builtin" });
    expect(state.token()).toBeNull();
    expect(loadMode(store)).toBe("builtin");
  });

  it("the switch changes the mode and is remembered", async () => {
    const { state, store } = setup({ status: "ok", cache: CACHE });
    await state.save("test-token-0000-1111");
    expect(state.view().mode).toBe("builtin");
    state.setMode("wanikani");
    expect(state.view().mode).toBe("wanikani");
    expect(state.list()).not.toBeNull();
    expect(loadMode(store)).toBe("wanikani");
    state.setMode("builtin");
    expect(state.view().mode).toBe("builtin");
    expect(state.list()).toBeNull();
    expect(loadMode(store)).toBe("builtin");
  });

  describe("story library", () => {
    const OK: WkFetchResult = { status: "ok", cache: CACHE };

    it("fetches when missing, stores it and looks up by character", async () => {
      const t = setup(OK);
      expect(t.state.stories()).toBeUndefined();
      await t.state.refresh();
      expect(t.storyCalls.n).toBe(1);
      expect(t.state.stories()?.get("休")?.radicals?.length).toBeGreaterThan(0);
      expect(t.state.stories()?.get("無")).toBeUndefined();
      const rec = await t.storyStore.load();
      expect(rec?.tokenTail).toBe(tokenTail(TOKEN));
      expect(rec?.fetchedAt).toBe(t.time());
      expect(JSON.stringify(rec)).not.toContain(TOKEN);
    });

    it("does not fetch with no token", async () => {
      const t = setup({ status: "none", cache: null }, false);
      await t.state.refresh();
      expect(t.storyCalls.n).toBe(0);
      expect(t.state.stories()).toBeUndefined();
    });

    it("does not fetch again while fresh, and loads a stored library at start", async () => {
      const t = setup(OK);
      await t.state.refresh();
      t.advance(STORY_MAX_AGE_MS - 1);
      await t.state.refresh();
      expect(t.storyCalls.n).toBe(1);
      const again = createWkState({
        store: t.store,
        storyStore: t.storyStore,
        now: () => t.time(),
        makeClient: () =>
          ({
            refresh: async () => OK,
            fetchStories: async () => {
              t.storyCalls.n++;
              return { status: "offline" } as StoriesResult;
            },
          }) as WkClient,
      });
      await again.refresh();
      expect(t.storyCalls.n).toBe(1);
      expect(again.stories()?.has("休")).toBe(true);
    });

    it("fetches when older than 7 days", async () => {
      const t = setup(OK);
      await t.state.refresh();
      t.advance(STORY_MAX_AGE_MS + 1);
      await t.state.refresh();
      expect(t.storyCalls.n).toBe(2);
      expect((await t.storyStore.load())?.fetchedAt).toBe(t.time());
    });

    it("fetches when the token changed, and hides the old library meanwhile", async () => {
      const t = setup(OK);
      await t.state.refresh();
      saveToken(t.store, "another-token-9999");
      expect(t.state.stories()).toBeUndefined();
      await t.state.refresh();
      expect(t.storyCalls.n).toBe(2);
      expect(t.state.stories()).toBeDefined();
      expect((await t.storyStore.load())?.tokenTail).toBe("9999");
    });

    it("a failed fetch keeps play going and retries after the throttle", async () => {
      const t = setup(OK);
      t.setStories({ status: "offline" });
      await t.state.refresh();
      expect(t.state.stories()).toBeUndefined();
      expect(t.state.view().label).not.toBe("WaniKani offline");
      await t.state.refresh();
      expect(t.storyCalls.n).toBe(1);
      t.advance(WK_THROTTLE_MS);
      t.setStories({ status: "ok", library: LIBRARY });
      await t.state.refresh();
      expect(t.storyCalls.n).toBe(2);
      expect(t.state.stories()).toBeDefined();
    });

    it("a throwing stories fetch does not break refresh", async () => {
      const t = setup(OK);
      const state = createWkState({
        store: t.store,
        now: () => 0,
        makeClient: () =>
          ({
            refresh: async () => OK,
            fetchStories: async () => {
              throw new Error("boom");
            },
          }) as unknown as WkClient,
      });
      await state.refresh();
      expect(state.view().label).toContain("level");
    });

    it("remove deletes the library, and a late fetch does not bring it back", async () => {
      const t = setup(OK);
      await t.state.refresh();
      t.state.remove();
      expect(t.state.stories()).toBeUndefined();
      await Promise.resolve();
      expect(await t.storyStore.load()).toBeNull();
      await t.state.refresh();
      expect(t.storyCalls.n).toBe(1);
    });

    it("saving a token fetches the library without switching mode", async () => {
      const t = setup(OK, false);
      await t.state.save(TOKEN);
      expect(t.storyCalls.n).toBe(1);
      expect(t.state.view().mode).toBe("builtin");
      expect(t.state.stories()).toBeDefined();
    });

    it("saving a token leaves the run list unset, so a seed plays the same Built-in run", async () => {
      const t = setup(OK, false);
      expect(t.state.list()).toBeNull();
      await t.state.save(TOKEN);
      // main.ts runs on session.wk = wk.list(): null means the Built-in kanji
      expect(t.state.list()).toBeNull();
    });
  });
});
