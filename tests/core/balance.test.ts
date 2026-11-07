import { describe, expect, it } from "vitest";
import {
  createRunState,
  gateOpenings,
  hazardPos,
  setTarget,
  stepRun,
  type RunState,
} from "../../src/core/sim";
import { buildKanaRun } from "../../src/core/run";
import { KANA } from "../../src/core/kana";
import { buildTrack, hazardSpan } from "../../src/core/track";
import { ROWS_PER_RUN } from "../../src/core/tuning";

const DT = 1 / 60;

/**
 * Perfect steering: dodges blocks and saws through the widest gap, stays on
 * each enemy pack to shoot it, and goes through the chosen opening at each wall.
 * `wrong(q)` says whether question q is answered wrongly.
 */
function botRun(seed: number, wrong: (q: number) => boolean): RunState {
  let s = createRunState(
    buildKanaRun(seed, KANA),
    buildTrack(seed, ROWS_PER_RUN),
  );
  while (s.status === "running") {
    const h = s.track.hazards[s.nextHazard];
    const rowAt = s.track.questions[s.next] ?? Infinity;
    if (h && hazardPos(s, s.nextHazard) < rowAt) {
      if (h.kind === "pack") s = setTarget(s, s.packs[s.nextHazard]?.x ?? 0.5);
      else {
        const { left, right } = hazardSpan(h, h.pos);
        s = setTarget(s, left > 1 - right ? left / 2 : (1 + right) / 2);
      }
    } else {
      const row = s.rows[s.next];
      const n = row?.options.length ?? 2;
      const answer = row?.answerIndex ?? 0;
      const pick = wrong(s.next) ? (answer + 1) % n : answer;
      s = setTarget(s, gateOpenings(n)[pick]?.centre ?? 0.5);
    }
    s = stepRun(s, DT);
  }
  return s;
}

/** Died before answering the last question. */
const diedEarly = (s: RunState): boolean =>
  s.status === "dead" && s.results.length < s.rows.length;

const SEEDS = Array.from({ length: 200 }, (_, seed) => seed);

describe("balance bot (perfect steering)", () => {
  it("100% accuracy never dies before the last question", () => {
    const dead = SEEDS.filter((seed) => diedEarly(botRun(seed, () => false)));
    expect(dead).toEqual([]);
  }, 60_000);

  it("50% accuracy dies before the last question in at least half the runs", () => {
    const dead = SEEDS.filter((seed) =>
      diedEarly(botRun(seed, (q) => q % 2 === 1)),
    );
    expect(dead.length).toBeGreaterThanOrEqual(SEEDS.length / 2);
  }, 60_000);
});
