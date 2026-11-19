import { describe, expect, it } from "vitest";
import { digest, envValue } from "../../scripts/stories/wk";
import type { StoryLibrary } from "../../src/wanikani/stories";

describe("stories:wk helpers (SPEC-own-stories)", () => {
  it("reads one key from a dotenv file", () => {
    const env = 'A=1\n# WANIKANI_TOKEN=no\nexport WANIKANI_TOKEN="abc"\nB=2';
    expect(envValue(env, "WANIKANI_TOKEN")).toBe("abc");
    expect(envValue("WANIKANI_TOKEN=", "WANIKANI_TOKEN")).toBeNull();
    expect(envValue("", "WANIKANI_TOKEN")).toBeNull();
  });

  it("digests a library to mnemonics and radical names", () => {
    const lib: StoryLibrary = {
      version: 3,
      kanji: {
        休: {
          meaning: "made-up meaning",
          radicals: [
            { char: "亻", name: "Walker", image: null },
            { char: "木", name: "Plank", image: null },
          ],
          primaryReadings: [],
          vocab: [],
          compounds: [],
        },
        木: {
          reading: "made-up reading",
          radicals: [{ char: "木", name: "Plank", image: null }],
          primaryReadings: [],
          vocab: [],
          compounds: [],
        },
      },
    };
    expect(digest(lib)).toEqual({
      kanji: {
        休: {
          meaning: "made-up meaning",
          reading: null,
          radicals: ["Walker", "Plank"],
        },
        木: { meaning: null, reading: "made-up reading", radicals: ["Plank"] },
      },
      radicals: ["Plank", "Walker"],
    });
  });
});
