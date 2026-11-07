import { describe, expect, it } from "vitest";
import { KANA } from "../../src/core/kana";
import { KANJI } from "../../src/core/kanji";
import { place } from "../../src/core/progression";
import { buildRun } from "../../src/core/run";
import { defaultProgress, itemKey } from "../../src/core/srs";
import type { Progress } from "../../src/core/types";

/**
 * Built-in runs captured before the mode-aware pool (Task W4): the same seed
 * and progress must keep giving the same run, option for option.
 */
function mixed(): Progress {
  const p = place(defaultProgress(), 3, KANA, KANJI);
  KANJI.filter((k) => k.level === 4).forEach((k, i) => {
    p.items[itemKey(k.char, "meaning")] = {
      box: i % 6,
      seen: i,
      correct: 0,
      wrong: 0,
      lastSeen: 1,
    };
  });
  return { ...p, unlockedLevel: 4 };
}

const STATES: [string, Progress][] = [
  ["fresh", defaultProgress()],
  ["placed at Kanji 1", place(defaultProgress(), 2, KANA, KANJI)],
  ["mixed boxes at Kanji 3", mixed()],
];

describe("buildRun golden (Built-in)", () => {
  for (const [name, progress] of STATES)
    it(`same seed, same run: ${name}`, () => {
      const runs = [1, 42, 999].map((seed) =>
        buildRun(seed, progress, KANA, KANJI).map(
          (r) =>
            `${r.type} ${r.prompt} [${r.options.join(" / ")}] ${r.answerIndex}`,
        ),
      );
      expect(runs).toMatchSnapshot();
    });
});
