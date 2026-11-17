import { describe, expect, it } from "vitest";
import {
  aozoraLines,
  coverageTable,
  kanjiOf,
  measure,
  wkKnown,
} from "../../scripts/coverage";

describe("coverage measures (SPEC-useful-order)", () => {
  it("counts kanji tokens, not 々, 〇 or kana", () => {
    expect(kanjiOf("人々が〇番線で駅へ")).toEqual(["人", "番", "線", "駅"]);
  });

  it("gives kanji coverage by token and readable lines", () => {
    const lines = ["出口", "出入口", "ラーメン", "東口"];
    const m = measure(lines, new Set(["出", "口"]));
    // 7 kanji tokens, 5 known (入 and 東 unknown).
    expect(m.coverage).toBeCloseTo(5 / 7);
    // Of the three lines with kanji only 出口 is fully known.
    expect(m.lines).toBeCloseTo(1 / 3);
  });

  it("counts a text without kanji as fully readable", () => {
    expect(measure(["ラーメン"], new Set())).toEqual({ coverage: 1, lines: 1 });
  });
});

describe("Aozora Bunko text", () => {
  const file = [
    "ごん狐",
    "新美南吉",
    "",
    "-------------------------------------------------------",
    "【テキスト中に現れる記号について】",
    "《》：ルビ",
    "-------------------------------------------------------",
    "",
    "　或《ある》秋《あき》のことでした。ごんは｜小川《おがわ》へ出ました。",
    "［＃８字下げ］二［＃「二」は中見出し］",
    "　※［＃「特のへん＋廴＋聿」、第3水準1-87-71］陀多と云う男。",
    "",
    "底本：「新美南吉童話集」岩波文庫",
    "入力：someone",
  ].join("\r\n");

  it("drops header, notes and footer, strips ruby and markup, splits sentences", () => {
    expect(aozoraLines(file)).toEqual([
      "或秋のことでした。",
      "ごんは小川へ出ました。",
      "二",
      "陀多と云う男。",
    ]);
  });
});

describe("WaniKani at equal kanji count", () => {
  const levels = { "2": ["口", "目", "耳"], "1": ["一", "二"], "10": ["駅"] };

  it("cumulates levels in numeric order until the count is reached", () => {
    expect([...wkKnown(levels, 1)]).toEqual(["一", "二"]);
    expect([...wkKnown(levels, 3)]).toEqual(["一", "二", "口", "目", "耳"]);
    expect(wkKnown(levels, 6).size).toBe(6);
    expect(wkKnown(levels, 100).size).toBe(6);
  });
});

describe("coverage table", () => {
  it("has a row per text and order, and a travel average", () => {
    const all = new Set(["出", "口"]);
    const table = coverageTable(
      [
        { name: "menu", lines: ["出口"] },
        { name: "stories", lines: ["入口"] },
      ],
      [
        { name: "a", known: () => all },
        { name: "b", known: () => new Set() },
      ],
    );
    const rows = table.split("\n");
    expect(rows[1]).toMatch(/^text\s+order\s+Kanji 1\s+Kanji 3/);
    expect(rows[2]).toMatch(/^menu\s+a\s+100 \/100/);
    expect(rows[3]).toMatch(/^menu\s+b\s+0 \/ {2}0/);
    expect(rows[4]).toMatch(/^stories\s+a\s+50 \/ {2}0/);
    expect(rows[6]).toMatch(/^travel avg\s+a\s+100/);
    expect(rows[7]).toMatch(/^travel avg\s+b\s+0/);
  });
});
