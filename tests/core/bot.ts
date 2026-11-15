import { bossSize, bossWon } from "../../src/core/boss";
import { crowdWidth } from "../../src/core/crowd";
import { firepower, splitFire } from "../../src/core/fire";
import { createRng } from "../../src/core/rng";
import {
  createRunState,
  setTarget,
  speedMul,
  stepRun,
  type RunState,
} from "../../src/core/sim";
import { clampOnTrack } from "../../src/core/state";
import { rowOpenings } from "../../src/core/walls";
import { hazardPos, streamSpan } from "../../src/core/horde";
import type { ReaskConfig } from "../../src/core/reask";
import { buildTrack, hazardSpan } from "../../src/core/track";
import type { GateRow } from "../../src/core/types";
import { BASE_SPEED, FIRE_RANGE, ROWS_PER_RUN } from "../../src/core/tuning";
import { kanaRun } from "./kana-run";

/** Safety margin: only go for a crate if the fire left would break it this many times over. */
const CRATE_MARGIN = 1.25;
/** With s = 0, aim misses by up to this much (track widths) on every beat. */
const AIM_SPREAD = 0.3;

/**
 * Where the bot lines up on crate i: centred on it (kept on the track), off
 * by this beat's aim offset (as the steering will be).
 */
export function crateAim(s: RunState, i: number, offset: number): number {
  const h = s.track.hazards[i];
  if (h?.kind !== "block") return s.x;
  const w = crowdWidth(s.army);
  return clampOnTrack((h.left + h.right) / 2 + offset, w);
}

/**
 * Can the army break crate i before reaching it, lined up at `aim`? Only the
 * share of fire the crate would get there counts: the lanes it covers, as
 * splitFire (the crate is the nearest threat, so nothing blocks it).
 */
export function canBreak(s: RunState, i: number, aim: number): boolean {
  const h = s.track.hazards[i];
  const left = (s.hp[i] ?? 0) - (s.damage[i] ?? 0);
  if (h?.kind !== "block" || left <= 0) return true;
  const ahead = hazardPos(s, i) - s.dist;
  const secs =
    Math.min(ahead, FIRE_RANGE) / (BASE_SPEED * speedMul(s.dist, s.track));
  const w = crowdWidth(s.army);
  const crate = { pos: h.pos, span: { left: h.left, right: h.right } };
  const { shares } = splitFire(
    [crate],
    0,
    h.pos - Math.min(ahead, FIRE_RANGE),
    { left: aim - w / 2, right: aim + w / 2 },
  );
  const share = shares[0]?.share ?? 0;
  return firepower(s.army) * share * secs >= CRATE_MARGIN * left;
}

const DT = 1 / 60;

export type BotOptions = {
  /** Whether question q is answered wrongly. */
  wrong: (q: number) => boolean;
  /** Steering skill: 1 aims dead on; lower adds a seeded aim offset of up to (1 − skill) × AIM_SPREAD per beat. */
  skill?: number;
  squads?: boolean;
  /** The run's rows (and re-ask config) for a seed; a kana run by default. */
  build?: (seed: number) => { rows: GateRow[]; reask?: ReaskConfig | null };
};

/**
 * Shoots a crate when it can break it in time with the lanes it covers
 * where it lines up (else dodges), dodges saws through the widest gap, stays on each enemy pack's stream to shoot it, and goes
 * through the chosen opening at each wall (a charge is a wall with a squad in
 * each opening). Below skill 1, every beat (hazard or wall) gets its own aim
 * offset, kept inside the chosen opening at walls so it never changes the answer.
 */
export function botRun(seed: number, opts: BotOptions): RunState {
  const { wrong, skill = 1, squads, build } = opts;
  const aimRng = createRng(seed * 7919 + 17);
  const spread = (1 - skill) * AIM_SPREAD;
  let beat = -1;
  let offset = 0;
  const built = build?.(seed) ?? { rows: kanaRun(seed) };
  let s = createRunState(
    built.rows,
    buildTrack(seed, ROWS_PER_RUN, squads),
    built.reask ?? null,
  );
  while (s.status === "running") {
    if (s.nextHazard + s.next !== beat) {
      beat = s.nextHazard + s.next;
      offset = spread * (2 * aimRng() - 1);
    }
    const h = s.track.hazards[s.nextHazard];
    const rowAt = s.track.questions[s.next] ?? Infinity;
    let aim: number;
    if (h && hazardPos(s, s.nextHazard) < rowAt) {
      if (h.kind === "pack") {
        // stay on its stream to shoot it (it tracks the army, late)
        const sp = streamSpan(s, s.nextHazard);
        aim = (sp.left + sp.right) / 2 + offset;
      } else if (
        h.kind === "block" &&
        canBreak(s, s.nextHazard, crateAim(s, s.nextHazard, offset))
      ) {
        // line up on it (sloppily below skill 1): it breaks with the lanes covered
        aim = crateAim(s, s.nextHazard, offset);
      } else {
        const { left, right } = hazardSpan(h, h.pos);
        aim = left > 1 - right ? left / 2 : (1 + right) / 2;
        aim += offset;
      }
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
function accuracy(seed: number, p: number): (q: number) => boolean {
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
