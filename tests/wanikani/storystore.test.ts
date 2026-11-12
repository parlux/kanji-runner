import { describe, expect, it } from "vitest";
import { buildLibrary } from "../../src/wanikani/stories";
import {
  createMemoryStoryStore,
  createStoryStore,
  parseRecord,
  tokenTail,
} from "../../src/wanikani/storystore";
import stories from "./fixtures/stories.json";

const lib = buildLibrary(stories);
if (!lib.ok) throw new Error("fixture");
const rec = { library: lib.value, tokenTail: "0000", fetchedAt: 5 };

describe("story store", () => {
  it("tokenTail keeps the last 4 characters only", () => {
    expect(tokenTail(" abcd-1234-wxyz ")).toBe("wxyz");
  });

  it.each([
    ["memory", () => createMemoryStoryStore()],
    ["no IndexedDB", () => createStoryStore(undefined)],
    [
      "refusing IndexedDB",
      () =>
        createStoryStore({
          open: () => {
            throw new Error("refused");
          },
        } as unknown as IDBFactory),
    ],
  ])("%s: load, save, delete", async (_n, make) => {
    const s = make();
    expect(await s.load()).toBeNull();
    await s.save(rec);
    expect(await s.load()).toEqual(rec);
    await s.delete();
    expect(await s.load()).toBeNull();
  });

  it("parseRecord rejects wrong shapes", () => {
    expect(parseRecord(rec)).toEqual(rec);
    expect(parseRecord(null)).toBeNull();
    expect(parseRecord({ ...rec, fetchedAt: "x" })).toBeNull();
    expect(parseRecord({ ...rec, tokenTail: 1 })).toBeNull();
    expect(
      parseRecord({ ...rec, library: { version: 2, kanji: {} } }),
    ).toBeNull();
  });
});
