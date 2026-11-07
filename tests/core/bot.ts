import { bossSize, bossWon } from "../../src/core/boss";
import { crowdWidth } from "../../src/core/crowd";
import { firepower } from "../../src/core/fire";
import { createRng } from "../../src/core/rng";
import {
  createRunState,
  hazardPos,
  rowOpenings,
  setTarget,
  speedMul,
  stepRun,
  type RunState,
} from "../../src/core/sim";
import { buildTrack, hazardSpan } from "../../src/core/track";
import { BASE_SPEED, FIRE_RANGE, ROWS_PER_RUN } from "../../src/core/tuning";
import { kanaRun } from "./kana-run";

/** Safety margin: only go for a crate if the fire left would break it this many times over. */
const CRATE_MARGIN = 1.25;
/** With s = 0, aim misses by up to this much (track widths) on every beat. */
export const AIM_SPREAD = 0.3;

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

export type BotOptions = {
  /** Whether question q is answered wrongly. */
  wrong: (q: number) => boolean;
  /** Steering skill: 1 aims dead on; lower adds a seeded aim offset of up to (1 − skill) × AIM_SPREAD per beat. */
  skill?: number;
  squads?: boolean;
};

/**
 * Shoots a crate when it can break it in time (else dodges), dodges saws
 * through the widest gap, stays on each enemy pack to shoot it, and goes
 * through the chosen opening at each wall (a charge is a wall with a squad in
 * each opening). Below skill 1, every beat (hazard or wall) gets its own aim
 * offset, kept inside the chosen opening at walls so it never changes the answer.
 */
export function botRun(seed: number, opts: BotOptions): RunState {
  const { wrong, skill = 1, squads } = opts;
  const aimRng = createRng(seed * 7919 + 17);
  const spread = (1 - skill) * AIM_SPREAD;
  let beat = -1;
  let offset = 0;
  let s = createRunState(kanaRun(seed), buildTrack(seed, ROWS_PER_RUN, squads));
  while (s.status === "running") {
    if (s.nextHazard + s.next !== beat) {
      beat = s.nextHazard + s.next;
      offset = spread * (2 * aimRng() - 1);
    }
    const h = s.track.hazards[s.nextHazard];
    const rowAt = s.track.questions[s.next] ?? Infinity;
    let aim: number;
    if (h && hazardPos(s, s.nextHazard) < rowAt) {
      if (h.kind === "pack") aim = s.packs[s.nextHazard]?.x ?? 0.5;
      else if (h.kind === "block" && canBreak(s, s.nextHazard)) {
        // overlap the crate fully so all fire reaches it
        const w = crowdWidth(s.army);
        const mid = (h.left + h.right) / 2;
        aim = Math.min(h.right - w / 2, Math.max(h.left + w / 2, mid));
      } else {
        const { left, right } = hazardSpan(h, h.pos);
        aim = left > 1 - right ? left / 2 : (1 + right) / 2;
      }
      aim += offset;
    } else {
      const row = s.rows[s.next];
      const n = row?.options.length ?? 2;
      const answer = row?.answerIndex ?? 0;
      const pick = wrong(s.next) ? (answer + 1) % n : answer;
      // its opening as it is now: lined up, the bot shoots it wider
      const o = rowOpenings(s, s.next)[pick];
      const half = o ? (o.right - o.left) / 2 - 0.01 : 0;
      aim = (o?.centre ?? 0.5) + Math.max(-half, Math.min(half, offset));
    }
    s = setTarget(s, aim);
    s = stepRun(s, DT);
  }
  return s;
}

/** Wrong answers at random with accuracy p, seeded per run. */
export function accuracy(seed: number, p: number): (q: number) => boolean {
  const rng = createRng(seed * 104729 + 3);
  const misses = Array.from({ length: ROWS_PER_RUN }, () => rng() >= p);
  return (q) => misses[q] ?? false;
}

export type BossRun = { run: RunState; boss: number; won: boolean };

/** A bot run through to the boss: a dead army never reaches it. */
export function botBossRun(seed: number, p: number, skill = 1): BossRun {
  const run = botRun(seed, { wrong: accuracy(seed, p), skill });
  const boss = bossSize(run.rows, run.track.charges, seed);
  return {
    run,
    boss,
    won: run.status === "finished" && bossWon(run.army, boss),
  };
}
