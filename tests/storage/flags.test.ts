import { describe, expect, it } from "vitest";
import {
  addFlag,
  FLAGS_KEY,
  loadFlags,
  NOTE_MAX,
  removeFlags,
  type StoryFlag,
} from "../../src/storage/flags";
import type { KeyValueStore } from "../../src/storage/storage";

const mem = (): KeyValueStore & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  };
};
const flag = (kanji: string, at = 1): StoryFlag => ({
  kanji,
  level: "Kanji 5",
  note: "",
  at,
  build: "1.0",
});

describe("flag queue", () => {
  it("saves and loads in order", () => {
    const s = mem();
    addFlag(s, flag("日"));
    addFlag(s, flag("月", 2));
    expect(loadFlags(s).map((f) => f.kanji)).toEqual(["日", "月"]);
  });
  it("trims and cuts the note", () => {
    const s = mem();
    addFlag(s, { ...flag("日"), note: ` ${"x".repeat(300)} ` });
    expect(loadFlags(s)[0]?.note).toHaveLength(NOTE_MAX);
  });
  it("ignores bad JSON, wrong shapes and bad entries", () => {
    const s = mem();
    expect(loadFlags(s)).toEqual([]);
    s.data.set(FLAGS_KEY, "{nope");
    expect(loadFlags(s)).toEqual([]);
    s.data.set(FLAGS_KEY, '{"a":1}');
    expect(loadFlags(s)).toEqual([]);
    s.data.set(FLAGS_KEY, JSON.stringify([flag("日"), { kanji: 1 }, null]));
    expect(loadFlags(s)).toEqual([flag("日")]);
  });
  it("removes only the sent flags", () => {
    const s = mem();
    addFlag(s, flag("日"));
    addFlag(s, flag("月", 2));
    removeFlags(s, [flag("日")]);
    expect(loadFlags(s).map((f) => f.kanji)).toEqual(["月"]);
  });
  it("never throws on a broken store", () => {
    const bad: KeyValueStore = {
      getItem: () => {
        throw new Error("x");
      },
      setItem: () => {
        throw new Error("x");
      },
    };
    expect(loadFlags(bad)).toEqual([]);
    expect(() => addFlag(bad, flag("日"))).not.toThrow();
    expect(() => removeFlags(bad, [flag("日")])).not.toThrow();
  });
});
