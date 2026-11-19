import { describe, expect, it } from "vitest";
import { KANJI } from "../../src/core/kanji";
import type { KanjiItem } from "../../src/core/types";
import {
  loadDictionary,
  validate,
  type Dictionary,
} from "../../scripts/stories/check";
import {
  fileLevel,
  parseLevels,
  storyFile,
} from "../../scripts/stories/levels";
import {
  levelInput,
  partsInput,
  soundsInput,
} from "../../scripts/stories/prep";

describe("committed dictionary (SPEC-own-stories)", () => {
  it("passes the validator", () => {
    const { dict, errors } = loadDictionary();
    expect(errors).toEqual([]);
    expect(validate(dict, KANJI).errors).toEqual([]);
  });
});

describe("level helpers", () => {
  it("names files by the level the player sees", () => {
    expect(storyFile(2)).toBe("kanji-01.json");
    expect(storyFile(73)).toBe("kanji-72.json");
    expect(fileLevel("kanji-01.json")).toBe(2);
    expect(fileLevel("kanji-1.json")).toBeNull();
  });

  it("parses N and A-B within range", () => {
    expect(parseLevels("2-4", 73)).toEqual([2, 3, 4]);
    expect(parseLevels("5", 73)).toEqual([5]);
    expect(() => parseLevels("1-3", 73)).toThrow();
    expect(() => parseLevels("4-2", 73)).toThrow();
    expect(() => parseLevels("x", 73)).toThrow();
  });
});

// Made-up fixtures: two kanji in game level 2, one in level 3.
const item = (
  char: string,
  level: number,
  gloss: string,
  on: string | null,
  kun: KanjiItem["kun"],
  components: string[] = [],
): KanjiItem => ({
  char,
  level,
  grade: 1,
  freq: null,
  glosses: [gloss],
  on,
  kun,
  readings: [],
  components,
});
const FIX: KanjiItem[] = [
  item("木", 2, "tree", "もく", { base: "き", okurigana: "" }),
  item("休", 2, "rest", "きゅう", { base: "やす", okurigana: "む" }, [
    "亻",
    "木",
  ]),
  item("円", 3, "yen", "えん", null),
];
const PAD = " The scene stays with you for a long time after.";
const meaning = (s: string) => s + PAD.repeat(3);
const reading = (s: string) => s + PAD.repeat(2);
const good = (): Dictionary => ({
  parts: { 亻: { name: "person" }, 木: { name: "tree" } },
  sounds: { きゅう: { keyword: "cue" } },
  stories: {
    "kanji-01.json": {
      level: "Kanji 1",
      kanji: {
        木: {
          meaning: meaning(
            "A <part>tree</part> is just a <kanji>tree</kanji>.",
          ),
          on: reading("A tree grows a <reading>もく</reading> mock trunk."),
          kun: reading("A key, <reading>き</reading>, hangs on the tree."),
        },
        休: {
          meaning: meaning(
            "A <part>person</part> hugs a <part>tree</part> to <kanji>rest</kanji>.",
          ),
          on: reading(
            "A pool <em>cue</em> scratches a back: <reading>キュウ</reading>.",
          ),
          kun: reading(
            "<reading>やすむ</reading>: <ja>休む</ja> is to take a break.",
          ),
        },
      },
    },
  },
});
type Entry = Record<string, string>;
const entry = (d: Dictionary, c: string) =>
  (d.stories["kanji-01.json"] as { kanji: Record<string, Entry> }).kanji[
    c
  ] as Entry;
const errorsOf = (d: Dictionary, levels?: number[]) =>
  validate(d, FIX, levels).errors;

describe("validator rules", () => {
  it("passes a good dictionary and an empty one", () => {
    expect(validate(good(), FIX)).toEqual({ errors: [], warnings: [] });
    expect(
      validate({ parts: {}, sounds: {}, stories: {} }, FIX).errors,
    ).toEqual([]);
  });

  it("checks the file shape and name against the level", () => {
    const d = good();
    d.stories["kanji-01.json"] = { level: "Kanji 2", kanji: {}, extra: 1 };
    d.stories["kanji-99.json"] = { level: "Kanji 98", kanji: {} };
    d.stories["notes.json"] = {};
    const e = errorsOf(d).join("\n");
    expect(e).toMatch(/kanji-01.json: level should be "Kanji 1"/);
    expect(e).toMatch(/unexpected key "extra"/);
    expect(e).toMatch(/kanji-99.json: not a kanji level file/);
    expect(e).toMatch(/notes.json: not a kanji level file/);
    d.stories["kanji-01.json"] = [];
    expect(errorsOf(d).join()).toMatch(/needs \{ "level", "kanji" \}/);
  });

  it("needs every kanji of the level and no others", () => {
    const d = good();
    const k = (d.stories["kanji-01.json"] as { kanji: Record<string, unknown> })
      .kanji;
    k["円"] = k["木"];
    delete k["木"];
    const e = errorsOf(d).join("\n");
    expect(e).toMatch(/木 missing/);
    expect(e).toMatch(/円: not a kanji of Kanji 1/);
  });

  it("requires asked-for level files", () => {
    expect(errorsOf(good(), [2, 3])).toEqual([
      "stories/kanji-02.json: missing",
    ]);
  });

  it("has on/kun exactly when the main reading exists", () => {
    const d = good();
    delete entry(d, "木").kun;
    d.stories["kanji-02.json"] = {
      level: "Kanji 2",
      kanji: {
        円: {
          meaning: meaning("A coin is a <kanji>yen</kanji>."),
          on: reading("<reading>えん</reading> rhymes with end."),
          kun: reading("<reading>えん</reading> again."),
        },
      },
    };
    const e = errorsOf(d).join("\n");
    expect(e).toMatch(/木: kun missing/);
    expect(e).toMatch(/円: has kun, but the kanji has no main kun/);
  });

  it("checks <reading> against the main reading (kun: okurigana optional, katakana ok)", () => {
    const d = good();
    entry(d, "木").on = reading("No reading tag here at all, just words.");
    entry(d, "休").on = reading("<reading>く</reading> is wrong.");
    entry(d, "休").kun = reading("<reading>やすみ</reading> is wrong too.");
    const e = errorsOf(d).join("\n");
    expect(e).toMatch(/木 on: no <reading>/);
    expect(e).toMatch(/休 on: <reading>く<\/reading> is not きゅう/);
    expect(e).toMatch(/休 kun: <reading>やすみ<\/reading> is not やす/);
    const ok = good();
    entry(ok, "休").kun = reading("<reading>やす</reading> is fine.");
    expect(errorsOf(ok)).toEqual([]);
  });

  it("allows only the five tags, balanced, no stray brackets", () => {
    const d = good();
    entry(d, "木").meaning = meaning(
      "A <part>tree</part> <b>bold</b> <kanji>tree</kanji>.",
    );
    entry(d, "木").on = reading("<reading>もく</reading> <em>oops</ja>.");
    entry(d, "木").kun = reading('<reading class="x">き</reading> 1 < 2.');
    entry(d, "休").kun = reading("<reading>やす</reading> <em>open.");
    const e = errorsOf(d).join("\n");
    expect(e).toMatch(/木 meaning: bad tag <b>/);
    expect(e).toMatch(/木 on: unbalanced <\/ja>/);
    expect(e).toMatch(/木 kun: bad tag <reading class="x">/);
    expect(e).toMatch(/木 kun: stray < or >/);
    expect(e).toMatch(/休 kun: unclosed <em>/);
  });

  it("keeps plain-text lengths in band", () => {
    const d = good();
    entry(d, "木").meaning = "A <part>tree</part> <kanji>tree</kanji>.";
    entry(d, "木").on = reading("<reading>もく</reading>" + "x".repeat(450));
    const e = errorsOf(d).join("\n");
    expect(e).toMatch(/木 meaning: 12 characters, outside 120-600/);
    expect(e).toMatch(/木 on: \d+ characters, outside 60-450/);
  });

  it("needs a <kanji> meaning word in the meaning story", () => {
    const d = good();
    entry(d, "木").meaning = meaning("A <part>tree</part> is a tree.");
    expect(errorsOf(d).join()).toMatch(/木 meaning: no <kanji>/);
  });

  it("needs every <part> name in parts.json; a missing component is a warning", () => {
    const d = good();
    entry(d, "休").meaning = meaning(
      "A <part>Person</part> naps by a <part>bush</part>: <kanji>rest</kanji>.",
    );
    const r = validate(d, FIX);
    expect(r.errors.join()).toMatch(
      /休 meaning: part "bush" not in parts.json/,
    );
    expect(r.warnings).toEqual([
      'stories/kanji-01.json 休 meaning: part 木 "tree" not named',
    ]);
  });

  it("checks parts.json: names present, short, unique, every component once non-empty", () => {
    const d = good();
    d.parts = {
      亻: { name: "Tree" },
      木: { name: "tree" },
      口: { name: "a very long name" },
      日: {},
    };
    const e = errorsOf(d).join("\n");
    expect(e).toMatch(/parts.json 木: "tree" also names 亻/);
    expect(e).toMatch(/口: "a very long name" is over 3 words/);
    expect(e).toMatch(/parts.json 日: needs a "name"/);
    d.parts = { 亻: { name: "person" } };
    expect(errorsOf(d).join()).toMatch(/no name for component 木/);
    d.parts = [];
    expect(errorsOf(d).join()).toMatch(/parts.json: not an object/);
  });

  it("checks sounds.json: hiragana keys with a keyword", () => {
    const d = good();
    d.sounds = { キュウ: { keyword: "cue" }, もく: { note: "x" } };
    const e = errorsOf(d).join("\n");
    expect(e).toMatch(/"キュウ": key must be hiragana/);
    expect(e).toMatch(/もく: needs a "keyword"/);
  });
});

describe("prep inputs", () => {
  const words = [
    { word: "円", reading: "えん", glosses: ["yen"], level: 3 },
    { word: "休む", reading: "やすむ", glosses: ["to rest"], level: 2 },
  ];
  const parts = { 木: { name: "tree" } };
  const sounds = { きゅう: { keyword: "cue" } };

  it("gives the writer every field per kanji", () => {
    const input = levelInput(2, FIX, words, parts, sounds);
    expect(input).toMatchObject({
      level: "Kanji 1",
      gameLevel: 2,
      output: "dictionary/stories/kanji-01.json",
    });
    expect(input.kanji[1]).toEqual({
      char: "休",
      glosses: ["rest"],
      on: "きゅう",
      kun: "やす(む)",
      readings: [],
      components: [
        { part: "亻", name: null },
        { part: "木", name: "tree" },
      ],
      onSound: "cue",
      words: [{ word: "休む", reading: "やすむ", gloss: "to rest" }],
      earlier: [{ char: "木", gloss: "tree", level: "Kanji 1" }],
    });
  });

  it("lists parts and sounds with their users", () => {
    const p = partsInput(FIX, parts, new Map([["木", "tree"]]));
    expect(p[1]).toEqual({
      part: "木",
      name: "tree",
      uses: 1,
      examples: [{ char: "休", gloss: "rest" }],
      kanji: { gloss: "tree", level: "Kanji 1" },
      kanjidic: "tree",
    });
    expect(soundsInput(FIX, sounds)[1]).toEqual({
      sound: "きゅう",
      keyword: "cue",
      count: 1,
      examples: [{ char: "休", gloss: "rest" }],
    });
  });
});
