import { clipLoss, crowdWidth, type Span } from "./crowd";
import {
  expectedArmy,
  firepower,
  hazardHp,
  pickTarget,
  type Threat,
} from "./fire";
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
  GATE_OPENING_2,
  GATE_OPENING_3,
  MAX_SPEED_MUL,
  STARTING_ARMY,
  STEER_EASE,
  SQUAD_DEFECT_GAIN,
  STEER_MAX_SPEED,
  VIEW_DISTANCE,
} from "./tuning";
import {
  chargeLine,
  hazardSpan,
  isCharge,
  type Hazard,
  type Track,
} from "./track";
import type { GateRow } from "./types";

/** A moving enemy pack: its current track position and centre. */
export type PackState = { pos: number; x: number };

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
  /** Most recent shattered block and the distance it happened at, for feedback. */
  lastShatter: { index: number; dist: number } | null;
  /** Most recent crate payout (recruits from a shattered block) and the distance it happened at, for feedback. */
  lastCrate: { gain: number; dist: number } | null;
  /** Most recent clipping loss and the distance it happened at, for feedback. */
  lastClip: { loss: number; dist: number } | null;
  /**
   * The squad charge the army is committed to: its row, the squad chosen at the
   * charge line, and the distance of the lock. Active while `row === next`.
   */
  lock: { row: number; choice: number; dist: number } | null;
  /** Most recent answer, for feedback: the opening chosen and the army change it caused (after clipping). */
  lastAnswer: {
    correct: boolean;
    choice: number;
    change: number;
    dist: number;
  } | null;
  status: RunStatus;
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

export function createRunState(rows: GateRow[], track: Track): RunState {
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
    lastShatter: null,
    lastCrate: null,
    lastClip: null,
    lock: null,
    lastAnswer: null,
    status: "running",
  };
}

export type Opening = { left: number; right: number; centre: number };

/** Openings of an n-answer wall, spread evenly with equal solid wall between and at the edges. */
export function gateOpenings(n: number): Opening[] {
  const w = n <= 2 ? GATE_OPENING_2 : GATE_OPENING_3;
  const gap = (1 - n * w) / (n + 1);
  return Array.from({ length: n }, (_, i) => {
    const left = gap + i * (w + gap);
    return { left, right: left + w, centre: left + w / 2 };
  });
}

/** Index of the opening nearest x (openings share a width, so nearest centre). */
export function nearestOpening(n: number, x: number): number {
  let best = 0;
  gateOpenings(n).forEach((o, i, all) => {
    const b = all[best] as Opening;
    if (Math.abs(o.centre - x) < Math.abs(b.centre - x)) best = i;
  });
  return best;
}

/** Solid parts of an n-answer wall: everything that isn't an opening. */
export function wallSolids(n: number): Span[] {
  const o = gateOpenings(n);
  return [...o, { left: 1, right: 1 }].map((r, i) => ({
    left: i === 0 ? 0 : (o[i - 1] as Opening).right,
    right: r.left,
  }));
}

/** Squads stand where a wall's openings would be: one per answer, evenly spread. */
export function squadCentres(n: number): number[] {
  return gateOpenings(n).map((o) => o.centre);
}

/** Is steering locked by a squad charge (between its line and contact)? */
export function isLocked(s: RunState): boolean {
  return s.lock !== null && s.lock.row === s.next;
}

export type SquadView = {
  label: string;
  /** Centre across the track. */
  x: number;
  /** Shown count: the same for every squad. */
  count: number;
  /** The squad the army locked onto. False for every squad before the lock. */
  chosen: boolean;
  /** Only for the chosen squad once locked: it joins (correct) or fights (wrong). */
  outcome: "join" | "fight" | null;
};

export type ChargeView = {
  row: number;
  /** Track position of the squads, and of the charge line before them. */
  pos: number;
  line: number;
  prompt: string;
  /** Steering is locked (line crossed, not yet in contact). */
  locked: boolean;
  /** Contact has happened. */
  resolved: boolean;
  /** Distance at which the lock happened, if it has. */
  lockDist: number | null;
  squads: SquadView[];
};

export type RunView = { charges: ChargeView[] };

/**
 * What the renderer may know about squad charges. No correctness data until
 * the choice is fixed at the charge line, and then only for the chosen squad.
 */
export function viewOf(s: RunState): RunView {
  const charges = s.track.charges.flatMap((q): ChargeView[] => {
    const row = s.rows[q];
    if (!row) return [];
    const lock = s.lock?.row === q ? s.lock : null;
    const chosenIndex = lock
      ? lock.choice
      : q < s.next
        ? (s.lastAnswer?.choice ?? -1)
        : -1;
    // only a committed choice (locked or resolved) gets an outcome
    const committed = lock !== null || q < s.next;
    const squads = squadCentres(row.options.length).map((x, j): SquadView => {
      const chosen = committed && j === chosenIndex;
      return {
        label: row.options[j] ?? "",
        x,
        count: SQUAD_DEFECT_GAIN,
        chosen,
        outcome: chosen ? (j === row.answerIndex ? "join" : "fight") : null,
      };
    });
    return [
      {
        row: q,
        pos: s.track.questions[q] ?? Infinity,
        line: chargeLine(s.track, q),
        prompt: row.prompt,
        locked: lock !== null && q === s.next,
        resolved: q < s.next,
        lockDist: lock?.dist ?? null,
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
 * Fire never reaches past the next unresolved question: its wall, or a
 * charge's line, so nothing beyond it can be hit (or revealed).
 */
export function fireLimit(s: RunState): number {
  return isCharge(s.track, s.next)
    ? chargeLine(s.track, s.next)
    : (s.track.questions[s.next] ?? Infinity);
}

/** Recruits a crate pays out when it shatters. */
export const crateReward = (hp: number): number =>
  Math.round(CRATE_REWARD_K * hp);

/**
 * All fire goes to the nearest shootable threat ahead; damage is capped at its hp.
 * A block (supply crate) pays out once, on the step it shatters: it is never a target again.
 */
function fire(s: RunState, w: number, dt: number): RunState {
  const target = pickTarget(
    threats(s),
    s.nextHazard,
    s.dist,
    { left: s.x - w / 2, right: s.x + w / 2 },
    fireLimit(s),
  );
  if (target === null) return { ...s, target };
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
    lastShatter: shattered ? { index: target, dist: s.dist } : s.lastShatter,
    lastCrate: gain > 0 ? { gain, dist: s.dist } : s.lastCrate,
  };
}

/** Keeps a crowd of width w fully on the track. */
const clampOnTrack = (v: number, w: number): number =>
  Math.min(1 - w / 2, Math.max(w / 2, v));

/** Steering input. Ignored while a squad charge is locked. */
export function setTarget(s: RunState, targetX: number): RunState {
  if (s.status !== "running" || isLocked(s)) return s;
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

export function stepRun(s: RunState, dt: number): RunState {
  if (s.status !== "running") return s;
  let next = { ...s };
  const w = crowdWidth(s.army);
  // a locked charge runs straight at the chosen squad
  const locked = s.lock && isLocked(s) ? s.lock : null;
  const lockedX = locked
    ? squadCentres(s.rows[s.next]?.options.length ?? 2)[locked.choice]
    : undefined;
  next.targetX = clampOnTrack(lockedX ?? s.targetX, w);
  next.x = steerStep(s.x, next.targetX, w, dt);
  next.dist += BASE_SPEED * speedMul(s.dist, s.track) * dt;
  next = movePacks(next, dt);
  next = fire(next, w, dt);
  // resolve everything passed this step, in track order
  for (;;) {
    if (next.status !== "running") return next;
    const hazard = next.track.hazards[next.nextHazard];
    const pos = hazardPos(next, next.nextHazard);
    const rowPos = next.track.questions[next.next] ?? Infinity;
    const linePos =
      isCharge(next.track, next.next) && !isLocked(next)
        ? chargeLine(next.track, next.next)
        : Infinity;
    if (hazard && pos <= Math.min(rowPos, linePos) && pos <= next.dist)
      next = passHazard(next, hazard);
    else if (linePos <= next.dist) next = lockCharge(next);
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

/** Crossing the charge line: the squad nearest the crowd's centre is the answer, and steering locks. */
function lockCharge(s: RunState): RunState {
  const n = s.rows[s.next]?.options.length ?? 2;
  const choice = nearestOpening(n, s.x);
  return { ...s, lock: { row: s.next, choice, dist: s.dist } };
}

/** Contact with the chosen squad: no wall, so no clipping; the charge scores. */
function resolveCharge(s: RunState): RunState {
  const row = s.rows[s.next];
  if (!row) return { ...s, status: "finished" };
  const choice =
    s.lock?.row === s.next
      ? s.lock.choice
      : nearestOpening(row.options.length, s.x);
  const correct = choice === row.answerIndex;
  const scored = correct
    ? applyCorrectCharge(s.army, s.streak, BASE_REWARD[row.type])
    : applyWrongCharge(s.army);
  const nextIndex = s.next + 1;
  const status =
    scored.army <= 0
      ? "dead"
      : nextIndex >= s.rows.length
        ? "finished"
        : "running";
  return {
    ...s,
    army: scored.army,
    streak: scored.streak,
    next: nextIndex,
    results: [...s.results, correct],
    lastAnswer: { correct, choice, change: scored.army - s.army, dist: s.dist },
    status,
  };
}

function resolveRow(s: RunState): RunState {
  if (isCharge(s.track, s.next)) return resolveCharge(s);
  const row = s.rows[s.next];
  if (!row) return { ...s, status: "finished" };
  const n = row.options.length;
  // clipping first, then the answer is scored on what is left
  const clip = clipLoss(s.army, s.x, crowdWidth(s.army), wallSolids(n));
  const remaining = s.army - clip;
  const choice = nearestOpening(n, s.x);
  const correct = choice === row.answerIndex;
  const scored = correct
    ? applyCorrect(remaining, s.streak, BASE_REWARD[row.type])
    : applyWrong(remaining);
  // a crowd clipped to nothing stays dead, but the answer still counts
  const army = remaining > 0 ? scored.army : 0;
  const streak = scored.streak;
  const nextIndex = s.next + 1;
  const status =
    army <= 0 ? "dead" : nextIndex >= s.rows.length ? "finished" : "running";
  return {
    ...s,
    army,
    streak,
    next: nextIndex,
    results: [...s.results, correct],
    lastClip: clip > 0 ? { loss: clip, dist: s.dist } : s.lastClip,
    lastAnswer: { correct, choice, change: army - remaining, dist: s.dist },
    status,
  };
}
