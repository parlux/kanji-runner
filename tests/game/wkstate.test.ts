import { describe, expect, it } from "vitest";
import { createWkState, dueCount } from "../../src/game/wkstate";
import { loadMode, saveToken, type WkStore } from "../../src/wanikani/cache";
import type { WkClient, WkFetchResult } from "../../src/wanikani/client";
import { trim, type WkCache } from "../../src/wanikani/parse";
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

function setup(result: WkFetchResult, token = true) {
  const store = fakeStore();
  if (token) saveToken(store, "test-token-0000-1111");
  let next = result;
  const state = createWkState({
    store,
    now: () => Date.now(),
    makeClient: () => ({ refresh: async () => next }) as WkClient,
  });
  return { state, store, set: (r: WkFetchResult) => (next = r) };
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

  it("saving a token fetches and switches to WaniKani", async () => {
    const { state, store } = setup({ status: "ok", cache: CACHE });
    await state.save("test-token-0000-1111");
    const v = state.view();
    expect(v.mode).toBe("wanikani");
    expect(loadMode(store)).toBe("wanikani");
    expect(v.label).toBe(`WaniKani · level ${CACHE.level} · ${v.due} due`);
    const list = state.list();
    if (!list) throw new Error("no list");
    expect(v.due).toBe(dueCount(list));
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
    set({ status: "offline", cache: CACHE });
    await state.refresh();
    expect(state.view().label).toBe("WaniKani offline");
    expect(state.view().mode).toBe("wanikani");
  });

  it("remove returns to built-in and clears everything", async () => {
    const { state, store } = setup({ status: "ok", cache: CACHE });
    await state.save("test-token-0000-1111");
    state.remove();
    expect(state.view()).toMatchObject({ hasToken: false, mode: "builtin" });
    expect(state.token()).toBeNull();
    expect(loadMode(store)).toBe("builtin");
  });

  it("the switch changes the mode and is remembered", async () => {
    const { state, store } = setup({ status: "ok", cache: CACHE });
    await state.save("test-token-0000-1111");
    state.setMode("builtin");
    expect(state.view().mode).toBe("builtin");
    expect(state.list()).toBeNull();
    expect(loadMode(store)).toBe("builtin");
  });
});
