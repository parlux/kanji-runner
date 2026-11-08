import { describe, expect, it } from "vitest";
import type { SessionLog } from "../../src/core/session";
import { defaultProgress } from "../../src/core/srs";
import {
  loadSessionLog,
  saveSessionLog,
  SESSION_KEY,
} from "../../src/storage/session";
import {
  loadProgress,
  saveProgress,
  STORAGE_KEY,
  type KeyValueStore,
} from "../../src/storage/storage";

function fakeStore(initial?: string): KeyValueStore & {
  data: Map<string, string>;
} {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set(SESSION_KEY, initial);
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  };
}

const log: SessionLog = {
  startedAt: 1000,
  lastRunAt: 5000,
  runs: 2,
  items: [
    { prompt: "水", type: "meaning", state: "missing" },
    { prompt: "あ", type: "kana", state: "fixed" },
  ],
  fixedThisRun: ["あ:kana"],
};

describe("session log storage", () => {
  it("round trips", () => {
    const store = fakeStore();
    expect(saveSessionLog(store, log)).toBe(true);
    expect(loadSessionLog(store)).toEqual(log);
  });

  it("is null when missing", () => {
    expect(loadSessionLog(fakeStore())).toBeNull();
  });

  it("is null for corrupt or wrong-shaped data", () => {
    const bad = [
      "{not json",
      "null",
      "[]",
      "42",
      JSON.stringify({ ...log, runs: -1 }),
      JSON.stringify({ ...log, runs: 1.5 }),
      JSON.stringify({ ...log, startedAt: "x" }),
      JSON.stringify({ ...log, lastRunAt: null }),
      JSON.stringify({ ...log, items: {} }),
      JSON.stringify({ ...log, fixedThisRun: "a" }),
      JSON.stringify({ startedAt: 1 }),
    ];
    for (const text of bad) expect(loadSessionLog(fakeStore(text))).toBeNull();
  });

  it("drops bad items and keys but keeps the log", () => {
    const text = JSON.stringify({
      ...log,
      items: [
        log.items[0],
        { prompt: 1, type: "kana", state: "fixed" },
        { prompt: "x", type: "nope", state: "fixed" },
        { prompt: "x", type: "kana", state: "gone" },
        null,
        log.items[1],
      ],
      fixedThisRun: ["あ:kana", 7],
    });
    expect(loadSessionLog(fakeStore(text))).toEqual(log);
  });

  it("never throws when storage does", () => {
    const boom: KeyValueStore = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("full");
      },
    };
    expect(loadSessionLog(boom)).toBeNull();
    expect(saveSessionLog(boom, log)).toBe(false);
  });

  it("uses its own key and leaves Progress storage alone", () => {
    const store = fakeStore();
    saveProgress(store, defaultProgress());
    const before = store.data.get(STORAGE_KEY);
    saveSessionLog(store, log);
    expect(SESSION_KEY).not.toBe(STORAGE_KEY);
    expect(store.data.get(STORAGE_KEY)).toBe(before);
    expect(loadProgress(store)).toEqual(defaultProgress());
  });
});
