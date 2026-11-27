import { describe, expect, it } from "vitest";
import { sliceLevels } from "../../scripts/levels";

const many = (n: number, from = 0x4e00) =>
  Array.from({ length: n }, (_, i) => String.fromCharCode(from + i));

describe("sliceLevels (SPEC-overall-progress §2)", () => {
  it("takes 14 items plus a loanword per level, then 15", () => {
    const kanji = many(14 + 14 + 15 + 3);
    const s = sliceLevels(kanji, [], 2);
    const count = (l: number) => s.kanji.filter((x) => x === l).length;
    expect([count(2), count(3), count(4), count(5)]).toEqual([14, 14, 15, 3]);
    expect(Math.max(...s.kanji)).toBe(5);
  });

  it("puts a kanji's words right after it, spilling into the next level", () => {
    const kanji = ["一", "二"];
    const words = Array.from({ length: 16 }, (_, i) => `一${"あ".repeat(i)}`);
    const s = sliceLevels(kanji, words, 0);
    expect(s.kanji).toEqual([2, 3]);
    expect(s.words.slice(0, 14)).toEqual(Array(14).fill(2));
    expect(s.words.slice(14)).toEqual([3, 3]);
  });

  it("files a word under its last-taught kanji, in order, ignoring 々", () => {
    const kanji = many(14);
    const [a, b] = [kanji[0] ?? "", kanji[13] ?? ""];
    // a and its two words push b into level 3; b + a files under b, not a
    const s = sliceLevels(kanji, [b + a, a + "々", a], 1);
    expect(s.kanji[0]).toBe(2);
    expect(s.kanji[13]).toBe(3);
    expect(s.words).toEqual([3, 2, 2]);
  });

  it("gives line order: words grouped by last kanji, given order kept", () => {
    const s = sliceLevels(["一", "二"], ["二一", "一つ", "二つ", "一人"], 0);
    expect(s.wordOrder).toEqual([1, 3, 0, 2]);
  });

  it("switches to 15 a level once loanword slots run out", () => {
    const s = sliceLevels(many(14 + 15 + 15), [], 1);
    const count = (l: number) => s.kanji.filter((x) => x === l).length;
    expect([count(2), count(3), count(4)]).toEqual([14, 15, 15]);
  });

  it("rejects a word with none of the kanji", () => {
    expect(() => sliceLevels(["一"], ["二つ"], 0)).toThrow(/二つ/);
  });
});
