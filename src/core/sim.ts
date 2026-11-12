import { clipLoss, crowdWidth, type Span } from "./crowd";
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
  hazardHp,
  pickTarget,
  type Threat,
} from "./fire";
import {
  isTrigger,
  pickTarget as pickReaskTarget,
  REASK_OPTIONS,
  reaskRow,
  type ReaskConfig,
  type ReaskLink,
} from "./reask";
import { createRng } from "./rng";
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
  ENEMY_DAMAGE,
  ENEMY_HP,
  ENEMY_SPEED,
  ENEMY_STEER_SPEED,
  FIRE_RANGE,
  GATE_GROW_PER_DAMAGE,
  MAX_SPEED_MUL,
  REASK_MAX,
  STARTING_ARMY,
  STEER_EASE,
  SQUAD_DEFECT_GAIN,
  STEER_MAX_SPEED,
  VIEW_DISTANCE,
} from "./tuning";
import { hazardSpan, isCharge, type Hazard, type Track } from "./track";
import type { GateRow } from "./types";

/** A moving enemy pack: its current track position and centre. */
export type PackState = { pos: number; x: number };

export { gateOpenings, nearestOpening, wallSolids, type Opening };

/**
 * Re-asks in this run (WaniKani mode): the config it was built with, the
 * entry each row asks now, and the links placed so far. Fits `ReaskRecord`.
 */
export type ReaskState = ReaskConfig & {
  links: readonly ReaskLink[];
  /** The rows as built at the start, before any re-ask. */
  planned: readonly GateRow[];
};

/**
 * The run's rows as built at the start. The boss is sized from these, so a
 * re-ask (which may change a row's gate type) never changes it.
 */
export function plannedRows(s: RunState): readonly GateRow[] {
  return s.reask?.planned ?? s.rows;
}

export type RunStatus = "running" | "finished" | "dead";

export type RunState = {
  rows: GateRow[];
  /** Where the questions and hazards are. */
  track: Track;
  /** Distance the army has travelled. */
  dist: number;
  /** Index of the next unresolved row. */
  next: number;
  /** Index of the next hazard not yet passed. */
  nextHazard: number;
  /** Crowd centre, 0 (left edge) to 1 (right edge). */
  x: number;
  /** Where steering input wants the crowd to be. */
  targetX: number;
  army: number;
  streak: number;
  /** Per resolved row: was it answered correctly. */
  results: boolean[];
  /** Hit points per hazard (0 = can't be shot). */
  hp: number[];
  /** Damage dealt so far per hazard; a block is shattered once this reaches its hp. */
  damage: number[];
  /** Per hazard: where its enemy pack is now (null for blocks and saws). */
  packs: (PackState | null)[];
  /** Hazard being fired at this step, if any. */
  target: number | null;
  /** Per row: its wall's openings as they are now (shooting one grows it). */
  gates: Opening[][];
  /** Opening of the next row's wall being shot (grown) this step, if any. */
  gateTarget: number | null;
  /** Most recent shattered block and the distance it happened at, for feedback. */
  lastShatter: { index: number; dist: number } | null;
  /** Most recent crate payout (recruits from a shattered block) and the distance it happened at, for feedback. */
  lastCrate: { gain: number; dist: number } | null;
  /** Most recent clipping loss and the distance it happened at, for feedback. */
  lastClip: { loss: number; dist: number } | null;
  /** Most recent answer, for feedback: the opening chosen and the army change it caused (after clipping). */
  lastAnswer: {
    correct: boolean;
    choice: number;
    change: number;
    dist: number;
  } | null;
  status: RunStatus;
  /** Re-asks, when the run has them on; else null. */
  reask: ReaskState | null;
};

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
 */
export function createRunState(
  rows: GateRow[],
  track: Track,
  reask: ReaskConfig | null = null,
): RunState {
  return {
    rows,
    track,
    dist: 0,
    next: 0,
    nextHazard: 0,
    x: 0.5,
    targetX: 0.5,
    army: STARTING_ARMY,
    streak: 0,
    results: [],
    hp: hazardHp(track, expectedArmy(rows, track.charges)),
    damage: track.hazards.map(() => 0),
    packs: track.hazards.map((h) =>
      h.kind === "pack" ? { pos: h.pos, x: h.x } : null,
    ),
    target: null,
    gates: rows.map((r) => gateOpenings(r.options.length)),
    gateTarget: null,
    lastShatter: null,
    lastCrate: null,
    lastClip: null,
    lastAnswer: null,
    status: "running",
    reask: reask && { ...reask, links: [], planned: rows },
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

/** Enemies left in pack i (0 once it is shot to nothing). */
export function packSurvivors(s: RunState, i: number): number {
  const left = ((s.hp[i] ?? 0) - (s.damage[i] ?? 0)) / ENEMY_HP;
  return Math.max(0, Math.ceil(left - 1e-9));
}

/** Pack i's span: its centre ± half the width of a crowd its size. */
export function packSpan(s: RunState, i: number): Span {
  const x = s.packs[i]?.x ?? 0.5;
  const w = crowdWidth(packSurvivors(s, i));
  return { left: x - w / 2, right: x + w / 2 };
}

/** Where hazard i is now: packs move, everything else stays put. */
export function hazardPos(s: RunState, i: number): number {
  return s.packs[i]?.pos ?? s.track.hazards[i]?.pos ?? Infinity;
}

/** Visible packs run at the army and drift towards the crowd centre. */
function movePacks(s: RunState, dt: number): RunState {
  const packs = s.packs.map((p, i) => {
    if (!p || i < s.nextHazard || p.pos - s.dist > VIEW_DISTANCE) return p;
    const drift = Math.max(
      -ENEMY_STEER_SPEED * dt,
      Math.min(ENEMY_STEER_SPEED * dt, s.x - p.x),
    );
    const w = crowdWidth(packSurvivors(s, i));
    return {
      pos: p.pos - ENEMY_SPEED * dt,
      x: clampOnTrack(p.x + drift, w),
    };
  });
  return { ...s, packs };
}

/** What can be shot now: intact blocks and packs with enemies left. */
function threats(s: RunState): (Threat | null)[] {
  return s.track.hazards.map((h, i) => {
    if ((s.hp[i] ?? 0) <= 0 || isShattered(s, i)) return null;
    if (h.kind === "block")
      return { pos: h.pos, span: { left: h.left, right: h.right } };
    if (h.kind === "pack")
      return { pos: hazardPos(s, i), span: packSpan(s, i) };
    return null;
  });
}

/**
 * Fire never reaches past the next unresolved question's wall (a charge's
 * too), so nothing beyond it can be hit (or revealed).
 */
export function fireLimit(s: RunState): number {
  return s.track.questions[s.next] ?? Infinity;
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
 * All fire goes to the nearest shootable threat ahead; damage is capped at its hp.
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
  damage[target] = Math.min(hp, (damage[target] ?? 0) + firepower(s.army) * dt);
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

/** Keeps a crowd of width w fully on the track. */
const clampOnTrack = (v: number, w: number): number =>
  Math.min(1 - w / 2, Math.max(w / 2, v));

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
  next = movePacks(next, dt);
  next = fire(next, w, dt);
  // resolve everything passed this step, in track order
  for (;;) {
    if (next.status !== "running") return next;
    const hazard = next.track.hazards[next.nextHazard];
    const pos = hazardPos(next, next.nextHazard);
    const rowPos = next.track.questions[next.next] ?? Infinity;
    if (hazard && pos <= rowPos && pos <= next.dist)
      next = passHazard(next, hazard);
    else if (rowPos <= next.dist) next = resolveRow(next);
    else return next;
  }
}

/** Soldiers lost when pack i reaches the crowd: one per survivor if their spans overlap. */
function contactLoss(s: RunState, i: number): number {
  const w = crowdWidth(s.army);
  const p = packSpan(s, i);
  const overlap =
    Math.min(s.x + w / 2, p.right) - Math.max(s.x - w / 2, p.left) > 0;
  return overlap ? Math.min(s.army, ENEMY_DAMAGE * packSurvivors(s, i)) : 0;
}

/**
 * Losses only: hazards never touch the streak or results. Shattered blocks
 * don't clip, and a pack is gone after contact, hit or miss.
 */
function passHazard(s: RunState, h: Hazard): RunState {
  const i = s.nextHazard;
  const clip =
    h.kind === "pack"
      ? contactLoss(s, i)
      : isShattered(s, i)
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

/** Decorrelates a re-ask row's rng from the run's and the target pick's. */
const REASK_ROW_SALT = 0x27d4eb2f;

/**
 * After row `q` resolves: if it is a trigger and fewer than `REASK_MAX`
 * re-asks are placed, `pickTarget`'s row (if any) becomes a re-ask of `q`,
 * with new openings for `REASK_OPTIONS` answers. Nothing else changes.
 */
function placeReask(s: RunState, q: number, correct: boolean): RunState {
  const r = s.reask;
  if (!r || r.links.length >= REASK_MAX) return s;
  const reasks = s.rows.map((_, i) => r.links.some((l) => l.row === i));
  if (!isTrigger(correct, r.startBoxes[q] ?? 0, reasks[q] ?? false)) return s;
  const keys = r.entries.map((e) => e.key);
  const target = pickReaskTarget(r.seed, q, {
    keys,
    reasks,
    charges: s.track.charges,
  });
  const entry = r.entries[q];
  const first = s.rows[q];
  if (target === null || !entry || !first) return s;
  const rng = createRng(
    (r.seed ^
      REASK_ROW_SALT ^
      Math.imul(q + 1, 0x9e3779b1) ^
      Math.imul(target + 1, 0x85ebca77)) >>>
      0,
  );
  const rows = [...s.rows];
  rows[target] = reaskRow(rng, entry, first, r.pool);
  const gates = [...s.gates];
  gates[target] = gateOpenings(REASK_OPTIONS);
  const entries = [...r.entries];
  entries[target] = entry;
  const startBoxes = [...r.startBoxes];
  startBoxes[target] = r.startBoxes[q] ?? 0;
  return {
    ...s,
    rows,
    gates,
    reask: {
      ...r,
      entries,
      startBoxes,
      links: [...r.links, { row: target, of: q }],
    },
  };
}
