import { describe, expect, it } from "vitest";
import {
  buildLibrary,
  parseLibrary,
  storyLevel,
  storyLookup,
} from "../../src/wanikani/stories";
import pages from "./fixtures/stories.json";

const built = buildLibrary(pages);
if (!built.ok) throw new Error(built.error);
const lib = built.value;

describe("buildLibrary", () => {
  it("keeps kanji with stories or radicals; hidden, empty and vocabulary are out", () => {
    expect(Object.keys(lib.kanji).sort()).toEqual(["休", "明", "口"].sort());
  });

  it("resolves radicals in WaniKani's order, dropping hidden radicals", () => {
    expect(lib.kanji["休"]?.radicals.map((r) => r.name)).toEqual([
      "squig",
      "zorb",
    ]);
  });

  it("uses the primary meaning and the SVG URL only for a radical without characters", () => {
    expect(lib.kanji["休"]?.radicals).toEqual([
      { char: null, name: "squig", image: "https://example.invalid/img/2.svg" },
      { char: "龘龘", name: "zorb", image: null },
    ]);
  });

  it("keeps a kanji with radicals only, or stories only", () => {
    expect(lib.kanji["明"]).toEqual({
      radicals: [{ char: "龘龘", name: "zorb", image: null }],
    });
    expect(lib.kanji["口"]).toEqual({ meaning: "Only meaning", radicals: [] });
    expect(lib.kanji["休"]?.reading).toBe("Fake reading story");
  });

  it("round-trips through JSON and parseLibrary", () => {
    expect(parseLibrary(JSON.parse(JSON.stringify(lib)))).toEqual({
      ok: true,
      value: lib,
    });
  });

  it("gives an error result for bad pages, never a throw", () => {
    for (const bad of [
      null,
      {},
      [{}],
      [{ data: [null] }],
      [{ data: [{ id: "a", data: {} }] }],
      [{ data: [{ id: 1, object: "kanji", data: {} }] }],
    ]) {
      expect(buildLibrary(bad).ok).toBe(false);
    }
  });
});

describe("storyLevel", () => {
  it("prefers max_level_granted, falls back to level", () => {
    const u = (data: object) => ({ data });
    expect(
      storyLevel(u({ level: 3, subscription: { max_level_granted: 60 } })),
    ).toEqual({ ok: true, value: 60 });
    expect(storyLevel(u({ level: 3, subscription: {} }))).toEqual({
      ok: true,
      value: 3,
    });
    expect(storyLevel(u({ level: 3 }))).toEqual({ ok: true, value: 3 });
    expect(storyLevel(u({})).ok).toBe(false);
    expect(storyLevel(null).ok).toBe(false);
  });
});

describe("parseLibrary", () => {
  it("rejects wrong version or shape", () => {
    for (const bad of [
      null,
      [],
      { version: 2, kanji: {} },
      { version: 1 },
      { version: 1, kanji: { 休: { radicals: "x" } } },
      { version: 1, kanji: { 休: { meaning: 3, radicals: [] } } },
      {
        version: 1,
        kanji: { 休: { radicals: [{ char: 1, name: "a", image: null }] } },
      },
      { version: 1, kanji: { 休: { radicals: [{ char: null, name: "a" }] } } },
    ]) {
      expect(parseLibrary(bad).ok).toBe(false);
    }
  });
});

describe("storyLookup", () => {
  it("maps characters to stories", () => {
    expect(storyLookup(lib).get("口")?.meaning).toBe("Only meaning");
  });
});
