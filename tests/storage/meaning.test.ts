import { describe, expect, it } from "vitest";
import { meaningProgress } from "../../src/core/progression";
import type { SessionLog } from "../../src/core/session";
import { defaultProgress } from "../../src/core/srs";
import {
  loadMeaningMode,
  MEANING_MODE_KEY,
  saveMeaningMode,
} from "../../src/storage/meaning";
import {
  loadMeaningSessionLog,
  MEANING_SESSION_KEY,
  saveMeaningSessionLog,
  SESSION_KEY,
} from "../../src/storage/session";
import {
  loadMeaningProgress,
  MEANING_STORAGE_KEY,
  saveMeaningProgress,
  STORAGE_KEY,
  type KeyValueStore,
} from "../../src/storage/storage";

/** A store that records every key read or written. */
function spyStore() {
  const data = new Map<string, string>();
  const reads: string[] = [];
  const writes: string[] = [];
  const store: KeyValueStore = {
    getItem: (k) => (reads.push(k), data.get(k) ?? null),
    setItem: (k, v) => (writes.push(k), void data.set(k, v)),
  };
  return { store, data, reads, writes };
}

const log: SessionLog = {
  startedAt: 1,
  lastRunAt: 2,
  runs: 1,
  items: [{ prompt: "水", type: "meaning", state: "missing" }],
  fixedThisRun: [],
};

describe("meaning-mode storage", () => {
  it("uses distinct keys", () => {
    const keys = [
      STORAGE_KEY,
      SESSION_KEY,
      MEANING_MODE_KEY,
      MEANING_STORAGE_KEY,
      MEANING_SESSION_KEY,
    ];
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("starts fresh at level 2 and round trips progress", () => {
    const { store } = spyStore();
    expect(loadMeaningProgress(store)).toEqual(meaningProgress());
    const p = { ...meaningProgress(), unlockedLevel: 5 };
    expect(saveMeaningProgress(store, p)).toBe(true);
    expect(loadMeaningProgress(store)).toEqual(p);
  });

  it("falls back to fresh meaning progress on corrupt data", () => {
    const { store, data } = spyStore();
    data.set(MEANING_STORAGE_KEY, "{nope");
    expect(loadMeaningProgress(store).unlockedLevel).toBe(2);
  });

  it("round trips the session log and the flag", () => {
    const { store } = spyStore();
    expect(loadMeaningSessionLog(store)).toBeNull();
    expect(saveMeaningSessionLog(store, log)).toBe(true);
    expect(loadMeaningSessionLog(store)).toEqual(log);
    expect(loadMeaningMode(store)).toBe(false);
    saveMeaningMode(store, true);
    expect(loadMeaningMode(store)).toBe(true);
    saveMeaningMode(store, false);
    expect(loadMeaningMode(store)).toBe(false);
  });

  it("never reads or writes the owner's save or session log", () => {
    const { store, data, reads, writes } = spyStore();
    data.set(STORAGE_KEY, JSON.stringify(defaultProgress()));
    data.set(SESSION_KEY, JSON.stringify(log));
    const before = [...data.entries()];
    loadMeaningProgress(store);
    saveMeaningProgress(store, meaningProgress());
    loadMeaningSessionLog(store);
    saveMeaningSessionLog(store, log);
    loadMeaningMode(store);
    saveMeaningMode(store, true);
    for (const k of [...reads, ...writes])
      expect([STORAGE_KEY, SESSION_KEY]).not.toContain(k);
    expect(before.every(([k, v]) => data.get(k) === v)).toBe(true);
  });
});
