import { describe, expect, it } from "vitest";
import {
  formatFlags,
  parseEnv,
  parseResolve,
  storyFileOfLevel,
  storyText,
  tableMissing,
} from "../../scripts/stories/flags";

describe("stories:flags helpers", () => {
  it("parses dotenv text", () => {
    expect(parseEnv('# c\nA=1\nexport B="two"\n\nbad')).toEqual({
      A: "1",
      B: "two",
    });
  });
  it("parses --resolve", () => {
    expect(parseResolve(["--resolve", "3, 5,8"])).toEqual([3, 5, 8]);
    expect(parseResolve([])).toBeNull();
    expect(() => parseResolve(["--resolve", "x"])).toThrow();
    expect(() => parseResolve(["--resolve"])).toThrow();
  });
  it("maps a level name to its story file", () => {
    expect(storyFileOfLevel("Kanji 5")).toBe("kanji-05.json");
    expect(storyFileOfLevel("Kana")).toBeNull();
  });
  it("prints our story without tags", () => {
    expect(storyText({ meaning: "A <part>axe</part> falls." })).toBe(
      "  meaning: A axe falls.",
    );
    expect(storyText(undefined)).toContain("no story");
  });
  it("formats flags, empty and unexpected", () => {
    expect(formatFlags([], () => "")).toBe("No unresolved story flags.");
    expect(formatFlags({}, () => "")).toContain("Unexpected");
    const out = formatFlags(
      [
        {
          id: 4,
          kanji: "折",
          level: "Kanji 5",
          note: "",
          created_at: "2026-11-20T01:00:00Z",
        },
      ],
      () => "  meaning: x",
    );
    expect(out).toBe(
      "#4 折 (Kanji 5) 2026-11-20\n  note: (none)\n  meaning: x",
    );
  });
  it("detects a missing table", () => {
    expect(tableMissing(404, "")).toBe(true);
    expect(tableMissing(400, '{"code":"PGRST205"}')).toBe(true);
    expect(tableMissing(500, "boom")).toBe(false);
  });
});
