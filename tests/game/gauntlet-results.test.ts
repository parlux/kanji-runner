import { describe, expect, it } from "vitest";
import {
  rateWave,
  startGauntlet,
  stepGauntlet,
  type Gauntlet,
} from "../../src/game/sandbox/gauntlet";
import { GAUNTLET } from "../../src/game/sandbox/presets";
import {
  buildResults,
  parseResults,
  resultsText,
  shortDevice,
} from "../../src/game/sandbox/results";

const PIXEL =
  "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36";
const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

function played(): Gauntlet {
  let g = startGauntlet(GAUNTLET.slice(0, 2));
  while (g.phase !== "done") {
    while (g.phase !== "rate") g = stepGauntlet(g, 1 / 60);
    g = rateWave(g, g.index === 0 ? "right" : "many");
  }
  return g;
}

describe("gauntlet results", () => {
  it("shortens a user agent to the device and browser", () => {
    expect(shortDevice(PIXEL)).toBe("Android 14; Pixel 7 · Chrome 143");
    expect(shortDevice(IPHONE)).toBe(
      "iPhone; CPU iPhone OS 17_5 like Mac OS X · Safari 17",
    );
    expect(shortDevice("")).toBe("");
  });

  it("the payload: version, time, device and one entry per wave", () => {
    const g = played();
    const r = buildResults(
      g.log,
      "abc123 · 2026-11-14 10:00 UTC",
      new Date(Date.UTC(2026, 10, 14, 10, 30)),
      PIXEL,
    );
    expect(r).toMatchObject({
      version: "abc123 · 2026-11-14 10:00 UTC",
      createdAt: "2026-11-14T10:30:00.000Z",
      device: "Android 14; Pixel 7 · Chrome 143",
    });
    expect(r.waves).toHaveLength(2);
    const w = r.waves[0];
    expect(Object.keys(w ?? {}).sort()).toEqual(
      [
        "died",
        "enemies",
        "fps",
        "killSeconds",
        "lost",
        "preset",
        "rating",
        "reached",
        "wave",
      ].sort(),
    );
    expect(w?.preset).toEqual(GAUNTLET[0]);
    expect(r.waves.map((x) => x.rating)).toEqual(["right", "many"]);
    // it survives the trip through jsonb
    expect(parseResults(JSON.parse(JSON.stringify(r)))).toEqual(r);
  });

  it("the shared text has a header and a line per wave with the rating and measurements", () => {
    const g = played();
    const text = resultsText(
      buildResults(
        g.log,
        "abc",
        new Date(Date.UTC(2026, 10, 14, 10, 30)),
        PIXEL,
      ),
    );
    const lines = text.split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe(
      "Horde gauntlet 2026-11-14 10:30 UTC · build abc · Android 14; Pixel 7 · Chrome 143",
    );
    expect(lines[1]).toMatch(
      /^1\. Felt right \| army 60 \(pack for 60\), 200 enemies, kill 3\.5s/,
    );
    expect(lines[1]).toMatch(
      /measured: kill 3\.\d+s, 200 enemies, reached \d+, lost 0, \d+ fps \| defaults$/,
    );
    expect(lines[2]).toMatch(/^2\. Too many \| /);
  });

  it("parseResults rejects what isn't a gauntlet run", () => {
    expect(parseResults(null)).toBeNull();
    expect(parseResults({ waves: [] })).toBeNull();
    expect(
      parseResults({ version: "a", createdAt: "b", device: "c", waves: [{}] }),
    ).toBeNull();
    expect(
      parseResults({ version: "a", createdAt: "b", device: "c", waves: [] }),
    ).toEqual({ version: "a", createdAt: "b", device: "c", waves: [] });
  });
});
