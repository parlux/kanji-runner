import { describe, expect, it } from "vitest";
import {
  clipFile,
  formatIndex,
  moraKana,
  pick,
} from "../../scripts/voice/build";

const q = (...phrases: string[][]) => ({
  speedScale: 1,
  accent_phrases: phrases.map((moras) => ({
    moras: moras.map((text) => ({ text })),
    pause_mora: null,
  })),
});

describe("voice build helpers (SPEC-sound-effects §3)", () => {
  it("reads a query's moras in hiragana", () => {
    expect(moraKana(q(["マ", "イ", "ト", "シ"]))).toBe("まいとし");
    expect(moraKana(q(["キョ", "オ"], ["ア"]))).toBe("きょおあ");
  });

  it("names a clip by 8 hex digits of its key", () => {
    expect(clipFile("毎年|まいとし")).toMatch(/^[0-9a-f]{8}\.m4a$/);
    expect(clipFile("毎年|まいとし")).toBe(clipFile("毎年|まいとし"));
    expect(clipFile("あ|あ")).not.toBe(clipFile("い|い"));
  });

  it("writes the index sorted, one key per line", () => {
    expect(formatIndex({ "い|い": ["b.m4a", 2], "あ|あ": ["a.m4a", 1] })).toBe(
      '{\n  "あ|あ": ["a.m4a", 1],\n  "い|い": ["b.m4a", 2]\n}\n',
    );
    expect(formatIndex({})).toBe("{}\n");
  });

  it("picks lines by full key or by text", () => {
    const all = [
      { text: "日本", reading: "にほん" },
      { text: "あ", reading: "あ" },
      { text: "テレビ", reading: "テレビ" },
    ];
    expect(pick(all, ["日本", "テレビ|テレビ"])).toEqual([all[0], all[2]]);
  });
});
