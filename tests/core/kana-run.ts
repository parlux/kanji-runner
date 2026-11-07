import { KANA } from "../../src/core/kana";
import { KANJI } from "../../src/core/kanji";
import { buildRun } from "../../src/core/run";
import { defaultProgress } from "../../src/core/srs";
import type { GateRow, Progress } from "../../src/core/types";

/** Every kana known at box 0: an even, repeat-free kana run, as a sim fixture. */
const progress: Progress = { ...defaultProgress(), unlockedLevel: 1 };
for (const k of KANA)
  progress.items[`${k.char}:kana`] = {
    box: 0,
    seen: 1,
    correct: 0,
    wrong: 0,
    lastSeen: 1,
  };

export const kanaRun = (seed: number): GateRow[] =>
  buildRun(seed, progress, KANA, KANJI);
