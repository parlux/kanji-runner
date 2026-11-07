import { describe, expect, it } from "vitest";
import { crowdWidth } from "../../src/core/crowd";
import { firepower } from "../../src/core/fire";
import {
  createRunState,
  gateOpenings,
  hazardPos,
  setTarget,
  speedMul,
  stepRun,
  type RunState,
} from "../../src/core/sim";
import { buildKanaRun } from "../../src/core/run";
import { KANA } from "../../src/core/kana";
import { buildTrack, hazardSpan } from "../../src/core/track";
import { BASE_SPEED, FIRE_RANGE, ROWS_PER_RUN } from "../../src/core/tuning";

/** Safety margin: only go for a crate if the fire left would break it this many times over. */
const CRATE_MARGIN = 1.25;

/** Can the army break crate i before reaching it, if it lines up now? */
function canBreak(s: RunState, i: number): boolean {
  const left = (s.hp[i] ?? 0) - (s.damage[i] ?? 0);
  if (left <= 0) return true;
  const ahead = hazardPos(s, i) - s.dist;
  const secs =
    Math.min(ahead, FIRE_RANGE) / (BASE_SPEED * speedMul(s.dist, s.track));
  return firepower(s.army) * secs >= CRATE_MARGIN * left;
}

const DT = 1 / 60;

/**
 * Perfect steering: shoots a crate when it can break it in time (else dodges),
 * dodges saws through the widest gap, stays on each enemy pack to shoot it,
 * and goes through the chosen opening at each wall.
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
      else if (h.kind === "block" && canBreak(s, s.nextHazard)) {
        // overlap the crate fully so all fire reaches it
        const w = crowdWidth(s.army);
        const mid = (h.left + h.right) / 2;
        s = setTarget(
          s,
          Math.min(h.right - w / 2, Math.max(h.left + w / 2, mid)),
        );
      } else {
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
