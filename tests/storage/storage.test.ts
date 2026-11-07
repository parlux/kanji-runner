import { describe, expect, it } from "vitest";
import { defaultProgress, recordRun } from "../../src/core/srs";
import {
  loadProgress,
  migrate,
  saveProgress,
  STORAGE_KEY,
  type KeyValueStore,
} from "../../src/storage/storage";

function fakeStore(
  initial?: string,
): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set(STORAGE_KEY, initial);
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  };
}

const played = recordRun(
  { ...defaultProgress(), unlockedLevel: 3 },
  [
    {
      type: "kana",
      prompt: "あ",
      options: ["a", "i"],
      answerIndex: 0,
      answer: "a",
    },
  ],
  [true],
  true,
  1234,
);

describe("storage", () => {
  it("returns defaults when nothing is stored", () => {
    expect(loadProgress(fakeStore())).toEqual(defaultProgress());
  });

  it("round-trips progress under kanji-runner:v1", () => {
    const store = fakeStore();
    expect(saveProgress(store, played)).toBe(true);
    expect([...store.data.keys()]).toEqual(["kanji-runner:v1"]);
    expect(loadProgress(store)).toEqual(played);
  });

  it("resets to defaults on corrupt data without throwing", () => {
    for (const bad of [
      "{not json",
      "null",
      "[]",
      '"text"',
      "42",
      '{"version":1}',
      '{"version":99,"unlockedLevel":0,"items":{},"stats":{"runs":0,"wins":0,"losses":0}}',
      '{"version":1,"unlockedLevel":-1,"items":{},"stats":{"runs":0,"wins":0,"losses":0}}',
      '{"version":1,"unlockedLevel":0,"items":[],"stats":{"runs":0,"wins":0,"losses":0}}',
    ]) {
      expect(loadProgress(fakeStore(bad))).toEqual(defaultProgress());
    }
  });

  it("drops single bad item records and keeps the rest", () => {
    const raw = JSON.parse(JSON.stringify(played));
    raw.items["い:kana"] = {
      box: 9,
      seen: 1,
      correct: 1,
      wrong: 0,
      lastSeen: 1,
    };
    raw.items["う:kana"] = "junk";
    expect(migrate(raw)).toEqual(played);
  });

  it("survives a store that throws", () => {
    const broken: KeyValueStore = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("full");
      },
    };
    expect(loadProgress(broken)).toEqual(defaultProgress());
    expect(saveProgress(broken, played)).toBe(false);
  });
});
