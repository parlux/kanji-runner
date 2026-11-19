import { describe, expect, it } from "vitest";
import type { KanjiItem } from "../../src/core/types";
import {
  buildIdf,
  ignoreFor,
  levelReport,
  namesReport,
  romaji,
  similarity,
  SUSPECT,
} from "../../scripts/stories/overlap";
import type { WkDigest } from "../../scripts/stories/wk";

// All text here is made up for the tests; none of it is WaniKani's.
const KANJI: KanjiItem = {
  char: "休",
  level: 2,
  grade: 1,
  freq: null,
  glosses: ["rest"],
  on: "きゅう",
  kun: { base: "やす", okurigana: "む" },
  readings: ["きゅう", "やすむ"],
  components: ["亻", "木"],
};
const THEIRS =
  "A <radical>walker</radical> wanders through the forest until his legs give out. He finds a <radical>plank</radical> leaning against a mossy boulder, props himself up and decides to <kanji>rest</kanji> there until the owls start hooting.";
const EDITED =
  "A walker wanders through the woods until his feet give out. He finds a plank leaning on a mossy rock, props himself up and decides to rest there until the owls begin hooting.";
const SCENE =
  "The hiker's legs quit deep in the forest. Leaning on a mossy boulder, he dozes off while owls hoot above. Time to rest.";
const UNRELATED =
  "A tired <part>person</part> hugs a <part>tree</part> like a giant pillow and starts snoring. The tree doesn't mind: it was planning a day off too. Both of them <kanji>rest</kanji> until the moon comes up.";
const BOUND =
  "A person and a tree, a walker and a plank: rest, kyuu, yasumu, <reading>きゅう</reading>.";
const CORPUS = [
  THEIRS,
  "A big person stands by a tree and looks at the moon.",
  "The car drives down the road to the city.",
  "A mouth opens wide and a person eats rice.",
  "The sun rises over a tree and the day begins.",
];
const idf = buildIdf(CORPUS);
const ignore = ignoreFor(KANJI, ["person", "tree", "Walker", "Plank"]);
const score = (t: string) => similarity(t, THEIRS, ignore, idf).score;

describe("overlap scoring (SPEC-own-stories)", () => {
  it("scores a copy high and marks it", () => {
    expect(score(THEIRS)).toBeCloseTo(1);
    expect(score(EDITED)).toBeGreaterThan(0.5);
  });

  it("flags the same scene in new words", () => {
    const s = similarity(SCENE, THEIRS, ignore, idf);
    expect(s.score).toBeGreaterThanOrEqual(SUSPECT);
    expect(s.words).toContain("mossy");
  });

  it("scores an unrelated story low", () => {
    expect(score(UNRELATED)).toBeLessThan(0.1);
  });

  it("ignores glosses, readings, part names and radical names", () => {
    expect(score(BOUND)).toBe(0);
  });

  it("romanises readings for the ignore list", () => {
    expect(
      ["しょう", "きゅう", "じゃ", "がっこう", "ちゅう"].map(romaji),
    ).toEqual(["shou", "kyuu", "ja", "gakkou", "chuu"]);
    expect(ignore.has("kyu")).toBe(true);
    expect(ignore.has("yasumu")).toBe(true);
  });
});

describe("overlap reports", () => {
  const wk: WkDigest = {
    kanji: {
      休: { meaning: THEIRS, reading: null, radicals: ["Walker", "Plank"] },
    },
    radicals: ["Plank", "Walker"],
  };

  it("lists entries highest first with suspects marked", () => {
    const report = levelReport(
      2,
      [KANJI],
      { 休: { meaning: EDITED, on: "no counterpart" } },
      wk,
      { 亻: { name: "person" } },
    );
    const lines = report.split("\n");
    expect(lines[0]).toBe(
      `overlap kanji-01.json: 1 entries compared, 1 suspect (score >= ${SUSPECT})`,
    );
    expect(lines[1]).toMatch(/^0\.\d\d SUSPECT 休 meaning/);
  });

  it("lists names shared with radical names", () => {
    expect(
      namesReport(
        { 木: { name: "plank" }, 亻: { name: "person" } },
        { きゅう: { keyword: "Walker" } },
        wk,
      ).split("\n"),
    ).toEqual([
      "names shared with WaniKani radicals (listed, not failed): 2",
      'part 木 "plank"',
      'sound きゅう "Walker"',
    ]);
  });
});
