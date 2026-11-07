import { describe, expect, it } from "vitest";
import {
  loadMode,
  loadToken,
  loadWkCache,
  removeToken,
  saveMode,
  saveToken,
  saveWkCache,
  WK_CACHE_KEY,
  type WkStore,
} from "../../src/wanikani/cache";
import { trim } from "../../src/wanikani/parse";
import assignments from "./fixtures/assignments.json";
import subjects from "./fixtures/subjects.json";
import user from "./fixtures/user.json";

function fakeStore(): WkStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const brokenStore: WkStore = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("full");
  },
  removeItem: () => {
    throw new Error("blocked");
  },
};

const r = trim(user, subjects, assignments);
if (!r.ok) throw new Error(r.error);
const cache = r.value;

describe("wanikani cache store", () => {
  it("round-trips the token (trimmed) and the cache", () => {
    const s = fakeStore();
    expect(loadToken(s)).toBeNull();
    expect(saveToken(s, "  abc  ")).toBe(true);
    expect(loadToken(s)).toBe("abc");
    expect(saveWkCache(s, cache)).toBe(true);
    expect(loadWkCache(s)).toEqual(cache);
  });

  it("treats a corrupt or wrong-version cache as missing", () => {
    const s = fakeStore();
    s.data.set(WK_CACHE_KEY, "{nope");
    expect(loadWkCache(s)).toBeNull();
    s.data.set(WK_CACHE_KEY, JSON.stringify({ version: 9, level: 1 }));
    expect(loadWkCache(s)).toBeNull();
  });

  it("mode defaults to built-in and needs a token", () => {
    const s = fakeStore();
    expect(loadMode(s)).toBe("builtin");
    saveMode(s, "wanikani");
    expect(loadMode(s)).toBe("builtin");
    saveToken(s, "abc");
    expect(loadMode(s)).toBe("wanikani");
  });

  it("removeToken clears token, cache and mode", () => {
    const s = fakeStore();
    saveToken(s, "abc");
    saveWkCache(s, cache);
    saveMode(s, "wanikani");
    removeToken(s);
    expect(s.data.size).toBe(0);
    expect(loadMode(s)).toBe("builtin");
  });

  it("never throws when storage is broken", () => {
    expect(loadToken(brokenStore)).toBeNull();
    expect(saveToken(brokenStore, "abc")).toBe(false);
    expect(loadWkCache(brokenStore)).toBeNull();
    expect(saveWkCache(brokenStore, cache)).toBe(false);
    expect(loadMode(brokenStore)).toBe("builtin");
    expect(saveMode(brokenStore, "wanikani")).toBe(false);
    expect(() => removeToken(brokenStore)).not.toThrow();
  });
});
