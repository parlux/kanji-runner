import { describe, expect, it } from "vitest";
import { LEGACY_KEYS, removeLegacyKeys } from "../../src/storage/legacy";
import { STORAGE_KEY } from "../../src/storage/storage";
import { SPEED_KEY } from "../../src/storage/speed";

const memory = (init: Record<string, string>) => {
  const data = new Map(Object.entries(init));
  return { data, removeItem: (k: string) => data.delete(k) };
};

describe("legacy dev-tool keys", () => {
  it("removes the saved camera, gear and horde values and nothing else", () => {
    const store = memory({
      "kanji-runner:camera": '{"pitch":20}',
      "kanji-runner:camera-gear": "1",
      "kanji-runner:horde": '{"count":2000}',
      [STORAGE_KEY]: "{}",
      [SPEED_KEY]: "fast",
    });
    removeLegacyKeys(store);
    expect([...store.data.keys()].sort()).toEqual(
      [STORAGE_KEY, SPEED_KEY].sort(),
    );
    expect(LEGACY_KEYS).toHaveLength(3);
  });

  it("ignores a store that throws", () => {
    expect(() =>
      removeLegacyKeys({
        removeItem: () => {
          throw new Error("blocked");
        },
      }),
    ).not.toThrow();
  });
});
