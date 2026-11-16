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
  it("keeps kanji with stories, radicals or vocabulary; hidden and empty are out", () => {
    expect(Object.keys(lib.kanji).sort()).toEqual(
      ["休", "明", "口", "十"].sort(),
    );
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
      primaryReadings: ["めい"],
      vocab: [
        { word: "明るい", readings: ["あかるい"], story: "Fake vocab story C" },
      ],
      compounds: [],
    });
    expect(lib.kanji["口"]).toEqual({
      meaning: "Only meaning",
      radicals: [],
      primaryReadings: ["くち"],
      vocab: [],
      compounds: [],
    });
    expect(lib.kanji["休"]?.reading).toBe("Fake reading story");
  });

  it("keeps primary readings only, hiragana only", () => {
    expect(lib.kanji["休"]?.primaryReadings).toEqual(["きゅう"]);
  });

  it("keeps only single-kanji vocabulary with a story, in id order", () => {
    expect(lib.kanji["休"]?.vocab).toEqual([
      { word: "休", readings: ["きゅう", "やす"], story: "Fake vocab story A" },
      { word: "休む", readings: ["やすむ"], story: "Fake vocab story B" },
    ]);
  });

  it("keeps a kanji that has only vocabulary", () => {
    expect(lib.kanji["十"]).toEqual({
      radicals: [],
      primaryReadings: [],
      vocab: [
        { word: "十", readings: ["じゅう"], story: "orphan kanji vocab" },
      ],
      compounds: [],
    });
  });

  it("is version 3", () => {
    expect(lib.version).toBe(3);
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

type V = {
  id: number;
  level?: number;
  word: string;
  readings: string[];
  story?: string | null;
  hidden?: boolean;
};

/** One synthetic kanji 龘 (readings: `on`, kun) plus vocabulary entries. */
function pick(
  vocab: V[],
  opts: { on?: string[]; reading?: string; primary?: string[] } = {},
) {
  const { on = ["か"], reading, primary = [] } = opts;
  const r = (x: string, type: string, p = false) => ({
    reading: x,
    type,
    primary: p,
  });
  const res = buildLibrary([
    {
      data: [
        {
          id: 1,
          object: "kanji",
          data: {
            characters: "龘",
            meaning_mnemonic: "m",
            hidden_at: null,
            reading_mnemonic: reading ?? null,
            readings: [
              ...on.map((o) => r(o, "onyomi", primary.includes(o))),
              r("ぞる", "kunyomi", primary.includes("ぞる")),
            ],
          },
        },
        ...vocab.map((v) => ({
          id: v.id,
          object: "vocabulary",
          data: {
            level: v.level ?? 1,
            characters: v.word,
            hidden_at: v.hidden ? "2026-01-01T00:00:00Z" : null,
            reading_mnemonic: v.story === undefined ? "かの story" : v.story,
            readings: v.readings.map((x) => r(x, "onyomi")),
          },
        })),
      ],
    },
  ]);
  if (!res.ok) throw new Error(res.error);
  return res.value.kanji["龘"]?.compounds;
}

describe("compound pick", () => {
  const w = (word: string, rd: string, o: Partial<V> = {}): V => ({
    id: 10,
    word,
    readings: [rd],
    ...o,
  });

  it("applies the position rule: first, last, middle", () => {
    expect(pick([w("龘x", "かい")])?.[0]?.wordReading).toBe("かい");
    expect(pick([w("龘x", "いか")])).toEqual([]);
    expect(pick([w("x龘", "いか")])?.[0]?.word).toBe("x龘");
    expect(pick([w("x龘", "かい")])).toEqual([]);
    expect(pick([w("x龘y", "いかろ")])?.[0]?.word).toBe("x龘y");
    expect(pick([w("x龘y", "いろ")])).toEqual([]);
  });

  it("skips a sound change", () => {
    expect(pick([w("龘x", "かっ")])?.[0]?.wordReading).toBe("かっ");
    expect(pick([w("龘x", "がっ")], { on: ["かく"] })).toEqual([]);
  });

  it("skips a boilerplate story with no kana for the reading", () => {
    expect(
      pick([w("龘x", "かい", { story: "you know these readings" })]),
    ).toEqual([]);
  });

  it("accepts katakana and tagged mentions, or the word reading", () => {
    expect(
      pick([w("龘x", "かい", { story: "the <reading>カ</reading> man" })]),
    ).toHaveLength(1);
    expect(
      pick([w("龘x", "かば", { story: "say <reading>カバ</reading>" })], {
        on: ["か"],
      }),
    ).toHaveLength(1);
    expect(pick([w("龘x", "かば", { story: "say カバ" })])).toHaveLength(1);
  });

  it("takes the lowest level, then the lowest id", () => {
    const got = pick([
      w("龘a", "かい", { id: 5, level: 3 }),
      w("龘b", "かろ", { id: 9, level: 2 }),
      w("龘c", "かね", { id: 7, level: 2 }),
    ]);
    expect(got).toEqual([
      { reading: "か", word: "龘c", wordReading: "かね", story: "かの story" },
    ]);
  });

  it("skips hidden, mnemonic-less and single-kanji words", () => {
    expect(
      pick([
        w("龘a", "かい", { hidden: true }),
        w("龘b", "かろ", { story: null }),
        w("龘", "か"),
        w("龘る", "かる"),
      ]),
    ).toEqual([]);
  });

  it("skips an on'yomi the kanji story or a bare-kanji word covers", () => {
    const c = w("龘x", "かい");
    expect(pick([c], { reading: "so <reading>x</reading> (か)" })).toEqual([]);
    expect(pick([c], { primary: ["か"] })).toEqual([]);
    expect(pick([c, w("龘", "か", { id: 2 })])).toEqual([]);
  });

  it("covers a reading the story misses even when others are covered", () => {
    expect(
      pick([w("龘x", "かい")], { on: ["き", "か"], primary: ["き"] }),
    ).toHaveLength(1);
  });

  it("never picks for a kun'yomi", () => {
    expect(pick([w("龘x", "ぞるい")], { on: [] })).toEqual([]);
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
      { version: 1, kanji: {} },
      { version: 2, kanji: {} },
      {
        version: 3,
        kanji: { 休: { radicals: [], primaryReadings: [], vocab: [] } },
      },
      {
        version: 3,
        kanji: {
          休: {
            radicals: [],
            primaryReadings: [],
            vocab: [],
            compounds: [{ reading: "か", word: "龘休", wordReading: "かく" }],
          },
        },
      },
      { version: 3 },
      { version: 3, kanji: { 休: { radicals: [], vocab: [] } } },
      { version: 3, kanji: { 休: { radicals: [], primaryReadings: [] } } },
      {
        version: 3,
        kanji: {
          休: {
            radicals: [],
            primaryReadings: [],
            vocab: [{ word: "休", readings: [1], story: "s" }],
          },
        },
      },
      { version: 3, kanji: { 休: { radicals: "x" } } },
      { version: 3, kanji: { 休: { meaning: 3, radicals: [] } } },
      {
        version: 3,
        kanji: { 休: { radicals: [{ char: 1, name: "a", image: null }] } },
      },
      { version: 3, kanji: { 休: { radicals: [{ char: null, name: "a" }] } } },
    ]) {
      expect(parseLibrary(bad).ok).toBe(false);
    }
  });
});

describe("storyLookup", () => {
  it("maps characters to stories", () => {
    expect(storyLookup(lib).get("口")?.meaning).toBe("Only meaning");
  });

  it("passes primary readings and vocabulary on", () => {
    const s = storyLookup(lib).get("休");
    expect(s?.primaryReadings).toEqual(["きゅう"]);
    expect(s?.vocab?.map((v) => v.word)).toEqual(["休", "休む"]);
  });

  it("passes compounds on", () => {
    const l = buildLibrary([
      {
        data: [
          {
            id: 1,
            object: "kanji",
            data: {
              characters: "龘",
              meaning_mnemonic: "m",
              hidden_at: null,
              readings: [{ reading: "か", type: "onyomi", primary: false }],
            },
          },
          {
            id: 2,
            object: "vocabulary",
            data: {
              level: 1,
              characters: "龘x",
              hidden_at: null,
              reading_mnemonic: "かの",
              readings: [{ reading: "かい", type: "onyomi", primary: true }],
            },
          },
        ],
      },
    ]);
    if (!l.ok) throw new Error(l.error);
    expect(storyLookup(l.value).get("龘")?.compounds?.[0]?.word).toBe("龘x");
  });
});
