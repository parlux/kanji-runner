import { clipLoss, crowdWidth } from "./crowd";
import { gateOpenings, type Opening } from "./gates";
import { expectedArmy, hazardHeads, hazardHp } from "./fire";
import {
  hazardPos,
  meleeStep,
  movePacks,
  packAwake,
  packStreaming,
  settleMelee,
  wakePacks,
} from "./horde";
import type { ReaskConfig } from "./reask";
import { fire, isShattered } from "./shooting";
import {
  BASE_SPEED,
  CROWD_DEPTH_MAX,
  MAX_SPEED_MUL,
  STARTING_ARMY,
  STEER_EASE,
  SQUAD_DEFECT_GAIN,
  STEER_MAX_SPEED,
  VIEW_DISTANCE,
  HORDE_DEFAULTS,
  type HordeTuning,
} from "./tuning";
import { hazardSpan, type Hazard, type Track } from "./track";
import type { GateRow } from "./types";
import { clampOnTrack, type RunState } from "./state";
import { resolveRow, rowOpenings } from "./walls";

export type { RunState } from "./state";

/**
 * The run's rows as built at the start. The boss is sized from these, so a
 * re-ask (which may change a row's gate type) never changes it.
 */
export function plannedRows(s: RunState): readonly GateRow[] {
  return s.reask?.planned ?? s.rows;
}

/**
 * Where an army that died stopped: the gate it died at (1-based, the number of
 * answered gates) out of the run's planned gates. For "gate 9 of 14".
 */
export function gateReached(s: RunState): { gate: number; of: number } {
  return { gate: s.results.length, of: plannedRows(s).length };
}

/** 1.0× until the first row is reached, then linear to MAX_SPEED_MUL by the time the last row appears. */
export function speedMul(dist: number, track: Track): number {
  const q = track.questions;
  const start = q[0] ?? 0;
  const end = (q.at(-1) ?? 0) - VIEW_DISTANCE;
  if (end <= start) return 1;
  const t = Math.min(1, Math.max(0, (dist - start) / (end - start)));
  return 1 + (MAX_SPEED_MUL - 1) * t;
}

/**
 * A run at the start. With a `ReaskConfig` (rows and config from `reaskRun`),
 * triggers place re-asks ahead; the track and hit points stay as built here.
 * `horde` sets the packs (HORDE_DEFAULTS when absent).
 */
export function createRunState(
  rows: GateRow[],
  track: Track,
  reask: ReaskConfig | null = null,
  horde: HordeTuning = HORDE_DEFAULTS,
): RunState {
  const expected = expectedArmy(rows, track.charges);
  const s: RunState = {
    rows,
    track,
    dist: 0,
    next: 0,
    nextHazard: 0,
    x: 0.5,
    targetX: 0.5,
    army: STARTING_ARMY,
    streak: 0,
    bestStreak: 0,
    results: [],
    hp: hazardHp(track, expected, horde),
    heads: hazardHeads(track, expected, horde),
    damage: track.hazards.map(() => 0),
    arrived: track.hazards.map(() => 0),
    front: track.hazards.map(() => 0),
    missed: track.hazards.map(() => 0),
    meleeLoss: track.hazards.map(() => 0),
    woke: track.hazards.map(() => false),
    // the head starts at the crowd's front (crowdFront)
    packs: track.hazards.map((h) => {
      if (h.kind !== "pack") return null;
      // its stream starts as its crowd: its mouth, where it stands
      const w = Math.min(1, Math.max(0, horde.packWidth));
      const c = clampOnTrack(h.x, w);
      return {
        pos: h.pos - CROWD_DEPTH_MAX / 2,
        x: h.x,
        streamX: c,
        aimX: c,
        streamW: w,
      };
    }),
    target: null,
    gates: rows.map((r) => gateOpenings(r.options.length)),
    gateTarget: null,
    lastShatter: null,
    lastCrate: null,
    lastClip: null,
    lastAnswer: null,
    status: "running",
    reask: reask && { ...reask, links: [], planned: rows },
    horde,
  };
  // a pack already charging at the start (none in a real run: packs come
  // after a wall) keeps the numbers it was built with
  return {
    ...s,
    woke: track.hazards.map((h, i) => h.kind !== "pack" || packAwake(s, i)),
  };
}

/** Squads stand in a wall's openings: one per answer, at each opening's centre. */
export function squadCentres(openings: readonly Opening[]): number[] {
  return openings.map((o) => o.centre);
}

export type SquadView = {
  label: string;
  /** Centre across the track. */
  x: number;
  /** Shown count: the same for every squad. */
  count: number;
  /** The squad the army ran into. False for every squad before contact. */
  chosen: boolean;
  /** Only for the chosen squad after contact: it joins (correct) or fights back (wrong). */
  outcome: "join" | "fight" | null;
};

export type ChargeView = {
  row: number;
  /** Track position of the wall the squads stand in. */
  pos: number;
  prompt: string;
  /** Contact has happened. */
  resolved: boolean;
  /** Distance at which contact happened, for the most recent answer only (else null). */
  contactDist: number | null;
  squads: SquadView[];
};

export type RunView = { charges: ChargeView[] };

/**
 * What the renderer may know about squad charges. No correctness data until
 * contact, and then only for the squad the army ran into, while that charge
 * is the most recent answer.
 */
export function viewOf(s: RunState): RunView {
  const charges = s.track.charges.flatMap((q): ChargeView[] => {
    const row = s.rows[q];
    if (!row) return [];
    const answer = q === s.next - 1 ? s.lastAnswer : null;
    const squads = squadCentres(rowOpenings(s, q)).map((x, j): SquadView => {
      const chosen = answer?.choice === j;
      return {
        label: row.options[j] ?? "",
        x,
        count: SQUAD_DEFECT_GAIN,
        chosen,
        outcome:
          answer?.choice === j ? (answer.correct ? "join" : "fight") : null,
      };
    });
    return [
      {
        row: q,
        pos: s.track.questions[q] ?? Infinity,
        prompt: row.prompt,
        resolved: q < s.next,
        contactDist: answer?.dist ?? null,
        squads,
      },
    ];
  });
  return { charges };
}

/** Steering input. */
export function setTarget(s: RunState, targetX: number): RunState {
  if (s.status !== "running") return s;
  return { ...s, targetX: clampOnTrack(targetX, crowdWidth(s.army)) };
}

export function nudgeTarget(s: RunState, dx: number): RunState {
  return setTarget(s, s.targetX + dx);
}

/** Eased move towards the target, never faster than STEER_MAX_SPEED. */
function steerStep(x: number, targetX: number, w: number, dt: number): number {
  const v = Math.max(
    -STEER_MAX_SPEED,
    Math.min(STEER_MAX_SPEED, (targetX - x) / STEER_EASE),
  );
  const dx = v * dt;
  // never overshoot the target
  const step = Math.abs(dx) > Math.abs(targetX - x) ? targetX - x : dx;
  return clampOnTrack(x + step, w);
}

/** `pace` scales the forward scroll only (a speed preset's multiplier). */
export function stepRun(s: RunState, dt: number, pace = 1): RunState {
  if (s.status !== "running") return s;
  let next = { ...s };
  const w = crowdWidth(s.army);
  next.targetX = clampOnTrack(s.targetX, w);
  next.x = steerStep(s.x, next.targetX, w, dt);
  next.dist += BASE_SPEED * pace * speedMul(s.dist, s.track) * dt;
  next = wakePacks(next);
  next = movePacks(next, dt);
  next = meleeStep(next, dt);
  next = fire(next, w, dt);
  // resolve everything passed this step, in track order
  for (;;) {
    if (next.status !== "running") return next;
    const hazard = next.track.hazards[next.nextHazard];
    const pos = hazardPos(next, next.nextHazard);
    const rowPos = next.track.questions[next.next] ?? Infinity;
    // a melee reaching the next wall or hazard is fought out first (track order)
    if (
      hazard?.kind === "pack" &&
      packStreaming(next, next.nextHazard) &&
      Math.min(rowPos, nextObstacle(next)) <= next.dist
    )
      next = settleMelee(next, next.nextHazard);
    // a pack streaming in (or in melee) holds the hazards behind it until it is dead
    if (
      hazard &&
      pos <= rowPos &&
      pos <= next.dist &&
      !(hazard.kind === "pack" && packStreaming(next, next.nextHazard))
    )
      next = passHazard(next, hazard);
    else if (rowPos <= next.dist) next = resolveRow(next);
    else return next;
  }
}

/** Track position of the first block or saw after the next hazard (packs behind a melee queue behind it). */
function nextObstacle(s: RunState): number {
  for (let j = s.nextHazard + 1; j < s.track.hazards.length; j++) {
    const h = s.track.hazards[j];
    if (h && h.kind !== "pack") return h.pos;
  }
  return Infinity;
}

/**
 * Losses only: hazards never touch the streak or results. Shattered blocks
 * don't clip. A pack is passed once it is dead (its losses came in its
 * melee; see meleeStep).
 */
function passHazard(s: RunState, h: Hazard): RunState {
  const i = s.nextHazard;
  if (h.kind === "pack") return { ...s, nextHazard: i + 1 };
  const clip = isShattered(s, i)
    ? 0
    : clipLoss(s.army, s.x, crowdWidth(s.army), [hazardSpan(h, s.dist)]);
  const army = s.army - clip;
  return {
    ...s,
    army,
    nextHazard: s.nextHazard + 1,
    lastClip: clip > 0 ? { loss: clip, dist: s.dist } : s.lastClip,
    status: army <= 0 ? "dead" : s.status,
  };
}
