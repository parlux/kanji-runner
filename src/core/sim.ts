import { clipLoss, crowdWidth, type Span } from "./crowd";
import { blockHp, expectedArmy, firepower, pickTarget } from "./fire";
import { applyCorrect, applyWrong } from "./scoring";
import {
  BASE_REWARD,
  BASE_SPEED,
  GATE_OPENING_2,
  GATE_OPENING_3,
  MAX_SPEED_MUL,
  STARTING_ARMY,
  STEER_EASE,
  STEER_MAX_SPEED,
  VIEW_DISTANCE,
} from "./tuning";
import { hazardSpan, type Hazard, type Track } from "./track";
import type { GateRow } from "./types";

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
  /** Hazard being fired at this step, if any. */
  target: number | null;
  /** Most recent shattered block and the distance it happened at, for feedback. */
  lastShatter: { index: number; dist: number } | null;
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
    hp: blockHp(track, expectedArmy(rows)),
    damage: track.hazards.map(() => 0),
    target: null,
    lastShatter: null,
    lastClip: null,
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

export function isShattered(s: RunState, i: number): boolean {
  const hp = s.hp[i] ?? 0;
  return hp > 0 && (s.damage[i] ?? 0) >= hp;
}

/** All fire goes to the nearest shootable block ahead; damage is capped at its hp. */
function fire(s: RunState, w: number, dt: number): RunState {
  const target = pickTarget(
    s.track.hazards,
    s.nextHazard,
    s.dist,
    { left: s.x - w / 2, right: s.x + w / 2 },
    (i) => (s.hp[i] ?? 0) > 0 && !isShattered(s, i),
  );
  if (target === null) return { ...s, target };
  const hp = s.hp[target] ?? 0;
  const damage = [...s.damage];
  damage[target] = Math.min(hp, (damage[target] ?? 0) + firepower(s.army) * dt);
  const shattered = damage[target] >= hp;
  return {
    ...s,
    damage,
    target,
    lastShatter: shattered ? { index: target, dist: s.dist } : s.lastShatter,
  };
}

/** Keeps a crowd of width w fully on the track. */
const clampOnTrack = (v: number, w: number): number =>
  Math.min(1 - w / 2, Math.max(w / 2, v));

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

export function stepRun(s: RunState, dt: number): RunState {
  if (s.status !== "running") return s;
  let next = { ...s };
  const w = crowdWidth(s.army);
  next.targetX = clampOnTrack(s.targetX, w);
  next.x = steerStep(s.x, next.targetX, w, dt);
  next.dist += BASE_SPEED * speedMul(s.dist, s.track) * dt;
  next = fire(next, w, dt);
  // resolve everything passed this step, in track order
  for (;;) {
    if (next.status !== "running") return next;
    const hazard = next.track.hazards[next.nextHazard];
    const rowPos = next.track.questions[next.next] ?? Infinity;
    if (hazard && hazard.pos <= rowPos && hazard.pos <= next.dist)
      next = passHazard(next, hazard);
    else if (rowPos <= next.dist) next = resolveRow(next);
    else return next;
  }
}

/** Clipping only: hazards never touch the streak or results. Shattered blocks don't clip. */
function passHazard(s: RunState, h: Hazard): RunState {
  const clip = isShattered(s, s.nextHazard)
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

function resolveRow(s: RunState): RunState {
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
