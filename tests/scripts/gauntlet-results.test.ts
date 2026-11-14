import { describe, expect, it } from "vitest";
import {
  formatRows,
  parseCount,
  parseEnv,
  readConfig,
  runTable,
} from "../../scripts/gauntlet-results";
import { GAUNTLET, type WavePreset } from "../../src/game/sandbox/presets";
import type { GauntletResults } from "../../src/game/sandbox/results";

const run: GauntletResults = {
  version: "abc",
  createdAt: "2026-11-14T10:30:00.000Z",
  device: "Android 14; Pixel 7 · Chrome 143",
  waves: [
    {
      wave: 1,
      preset: GAUNTLET[0] as WavePreset,
      killSeconds: 2.48,
      reached: 0,
      lost: 0,
      enemies: 200,
      fps: 58,
      died: false,
      answers: { pace: "right", melee: "fair" },
      note: "felt good",
    },
    {
      wave: 2,
      preset: GAUNTLET.at(-1) as WavePreset,
      killSeconds: null,
      reached: 200,
      lost: 20,
      enemies: 200,
      fps: 41,
      died: true,
      answers: null,
      note: "",
      rating: "fast",
    },
  ],
};

describe("gauntlet-results script", () => {
  it("parses a dotenv file", () => {
    const env = parseEnv(
      [
        "# comment",
        "",
        "VITE_SUPABASE_URL=https://x.supabase.co",
        'SUPABASE_SERVICE_ROLE_KEY="secret=with=equals"',
        "export OTHER='q'",
        "garbage",
      ].join("\n"),
    );
    expect(env).toEqual({
      VITE_SUPABASE_URL: "https://x.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "secret=with=equals",
      OTHER: "q",
    });
  });

  it("says what is missing, never the key", () => {
    const none = readConfig({}, false);
    expect("error" in none && none.error).toMatch(
      /Missing VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in \.env\.local \(not found\)/,
    );
    const noKey = readConfig({ VITE_SUPABASE_URL: "https://x/" }, true);
    expect("error" in noKey && noKey.error).toMatch(
      /^Missing SUPABASE_SERVICE_ROLE_KEY in \.env\.local\.\nAdd SUPABASE_SERVICE_ROLE_KEY=/,
    );
    const blank = readConfig(
      { VITE_SUPABASE_URL: "https://x/", SUPABASE_SERVICE_ROLE_KEY: "" },
      true,
    );
    expect("error" in blank).toBe(true);
    expect(
      readConfig(
        { VITE_SUPABASE_URL: "https://x/", SUPABASE_SERVICE_ROLE_KEY: "k" },
        true,
      ),
    ).toEqual({ url: "https://x", key: "k" });
    const missingUrl = readConfig(
      { SUPABASE_SERVICE_ROLE_KEY: "s3cret" },
      true,
    );
    expect(JSON.stringify(missingUrl)).not.toContain("s3cret");
  });

  it("reads the count argument", () => {
    expect(parseCount(undefined)).toBe(3);
    expect(parseCount("5")).toBe(5);
    expect(parseCount("0")).toBe(3);
    expect(parseCount("x")).toBe(3);
  });

  it("prints a run as a table per wave", () => {
    const lines = runTable(run).split("\n");
    expect(lines[0]).toBe(
      "2026-11-14 10:30 UTC · build abc · Android 14; Pixel 7 · Chrome 143",
    );
    expect(lines[1]).toMatch(/^#\s+army\s+for\s+enem\s+kill/);
    expect(lines[2]).toMatch(
      /^1\s+60\s+60\s+200\s+3\.5s\s+0\.8\s+1\s+1\s+\| 2\.48s\s+200\s+0\s+0\s+58\s+baseline: army 60, its pack, held line$/,
    );
    // the answers and the note under each wave
    expect(lines[3]).toBe(
      "   Pace: Right, Melee (only if reached): Tense and fair",
    );
    expect(lines[4]).toBe("   note: felt good");
    expect(lines[5]).toMatch(
      /^2\s+8\s+60\s+.*\| reached\s+200\s+200\s+20 died\s+41/,
    );
    // an older run's rating
    expect(lines[6]).toBe("   Too fast");
    // columns line up
    expect(lines[2]?.indexOf("|")).toBe(lines[5]?.indexOf("|"));
  });

  it("formats the REST reply: rows, none, or junk", () => {
    expect(formatRows([])).toBe("No gauntlet runs saved yet.");
    expect(formatRows({ message: "x" })).toBe(
      "Unexpected reply from Supabase.",
    );
    const text = formatRows([{ created_at: "t", data: run }, { data: 1 }]);
    expect(text).toContain("build abc");
    expect(text).toContain("(a row that isn't a gauntlet run)");
  });
});
