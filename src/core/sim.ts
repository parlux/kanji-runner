import { clipLoss, crowdWidth } from "./crowd";
import {
  gateOpenings,
  growOpening,
  nearestOpening,
  wallSolids,
  type Opening,
} from "./gates";
import {
  expectedArmy,
  firepower,
  hazardHeads,
  hazardHp,
  pickTarget,
  type Threat,
} from "./fire";
import {
  hazardPos,
  meleeStep,
  movePacks,
  packAwake,
  packFireShare,
  packSpan,
  packStreaming,
  settleMelee,
  wakePacks,
} from "./horde";
import type { ReaskConfig } from "./reask";
import { placeReask } from "./reask-hook";
import {
  applyCorrect,
  applyCorrectCharge,
  applyWrong,
  applyWrongCharge,
} from "./scoring";
import {
  BASE_REWARD,
  BASE_SPEED,
  CRATE_REWARD_K,
  CROWD_DEPTH_MAX,
  FIRE_RANGE,
  GATE_GROW_PER_DAMAGE,
  MAX_SPEED_MUL,
  PACK_WAKE,
  STARTING_ARMY,
  STEER_EASE,
  SQUAD_DEFECT_GAIN,
  STEER_MAX_SPEED,
  VIEW_DISTANCE,
  HORDE_DEFAULTS,
  type HordeTuning,
} from "./tuning";
import { hazardSpan, isCharge, type Hazard, type Track } from "./track";
import type { GateRow } from "./types";
import { clampOnTrack, fireLimit, type RunState } from "./state";

export type { RunState } from "./state";

export { gateOpenings, nearestOpening, wallSolids, type Opening };

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

/** Row q's wall openings as they are now. */
export function rowOpenings(s: RunState, q: number): Opening[] {
  return s.gates[q] ?? gateOpenings(s.rows[q]?.options.length ?? 2);
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

export function isShattered(s: RunState, i: number): boolean {
  const hp = s.hp[i] ?? 0;
  return hp > 0 && (s.damage[i] ?? 0) >= hp;
}

/** What can be shot now: intact blocks and packs with enemies left. */
function threats(s: RunState): (Threat | null)[] {
  return s.track.hazards.map((h, i) => {
    if ((s.hp[i] ?? 0) <= 0 || isShattered(s, i)) return null;
    if (h.kind === "block")
      return { pos: h.pos, span: { left: h.left, right: h.right } };
    if (h.kind === "pack")
      return {
        pos: hazardPos(s, i),
        span: packSpan(s, i),
        range: PACK_WAKE,
      };
    return null;
  });
}

/** Recruits a crate pays out when it shatters. */
export const crateReward = (hp: number): number =>
  Math.round(CRATE_REWARD_K * hp);

/**
 * With nothing else to shoot, fire goes to the next wall once it is within
 * FIRE_RANGE: the opening nearest the crowd's centre grows (see growOpening).
 * Only where the crowd is matters, never which answer is right.
 */
function shootGate(s: RunState, dt: number): RunState {
  const q = s.next;
  const ahead = (s.track.questions[q] ?? Infinity) - s.dist;
  if (!s.rows[q] || ahead < 0 || ahead > FIRE_RANGE)
    return { ...s, gateTarget: null };
  const openings = rowOpenings(s, q);
  const i = nearestOpening(openings, s.x);
  const gates = [...s.gates];
  gates[q] = growOpening(
    openings,
    i,
    firepower(s.army) * dt * GATE_GROW_PER_DAMAGE,
  );
  return { ...s, gates, gateTarget: i };
}

/**
 * All fire goes to the nearest shootable threat ahead whose span overlaps
 * the army's (a pack takes only its share: packFireShare); damage is capped at its hp.
 * A block (supply crate) pays out once, on the step it shatters: it is never a target again.
 * With no threat to shoot, the next wall's opening takes the fire.
 */
function fire(s: RunState, w: number, dt: number): RunState {
  const target = pickTarget(
    threats(s),
    s.nextHazard,
    s.dist,
    { left: s.x - w / 2, right: s.x + w / 2 },
    fireLimit(s),
  );
  if (target === null) return shootGate({ ...s, target }, dt);
  const hp = s.hp[target] ?? 0;
  const damage = [...s.damage];
  // straight ahead: a pack takes the share of the fire its span faces
  const share =
    s.track.hazards[target]?.kind === "pack" ? packFireShare(s, target) : 1;
  damage[target] = Math.min(
    hp,
    (damage[target] ?? 0) + firepower(s.army) * dt * share,
  );
  const shattered = damage[target] >= hp;
  const gain =
    shattered && s.track.hazards[target]?.kind === "block"
      ? crateReward(hp)
      : 0;
  return {
    ...s,
    army: s.army + gain,
    damage,
    target,
    gateTarget: null,
    lastShatter: shattered ? { index: target, dist: s.dist } : s.lastShatter,
    lastCrate: gain > 0 ? { gain, dist: s.dist } : s.lastCrate,
  };
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

/**
 * Contact with a wall, or a charge (a wall with a squad in each opening):
 * the wall clips, the opening nearest the crowd's centre is the answer, and
 * a charge scores as a charge.
 */
function resolveRow(s: RunState): RunState {
  const row = s.rows[s.next];
  if (!row) return { ...s, status: "finished" };
  const openings = rowOpenings(s, s.next);
  const charge = isCharge(s.track, s.next);
  // clipping first, then the answer is scored on what is left
  const clip = clipLoss(s.army, s.x, crowdWidth(s.army), wallSolids(openings));
  const remaining = s.army - clip;
  const choice = nearestOpening(openings, s.x);
  const correct = choice === row.answerIndex;
  const base = BASE_REWARD[row.type];
  const scored = correct
    ? (charge ? applyCorrectCharge : applyCorrect)(remaining, s.streak, base)
    : (charge ? applyWrongCharge : applyWrong)(remaining);
  // a crowd clipped to nothing stays dead, but the answer still counts
  const army = remaining > 0 ? scored.army : 0;
  const streak = scored.streak;
  const nextIndex = s.next + 1;
  const status =
    army <= 0 ? "dead" : nextIndex >= s.rows.length ? "finished" : "running";
  const resolved: RunState = {
    ...s,
    army,
    streak,
    bestStreak: Math.max(s.bestStreak, streak),
    next: nextIndex,
    results: [...s.results, correct],
    lastClip: clip > 0 ? { loss: clip, dist: s.dist } : s.lastClip,
    lastAnswer: { correct, choice, change: army - remaining, dist: s.dist },
    status,
  };
  return status === "running"
    ? placeReask(resolved, s.next, correct)
    : resolved;
}
