import { applyCorrect, applyWrong } from "./scoring";
import {
  BASE_REWARD,
  BASE_SPEED,
  GATE_OPENING_2,
  GATE_OPENING_3,
  MAX_SPEED_MUL,
  ROW_SPACING,
  STARTING_ARMY,
  STEER_EASE,
  STEER_MAX_SPEED,
  VIEW_DISTANCE,
} from "./tuning";
import type { GateRow } from "./types";

export type RunStatus = "running" | "finished" | "dead";

export type RunState = {
  rows: GateRow[];
  /** Distance the army has travelled. */
  dist: number;
  /** Index of the next unresolved row. */
  next: number;
  /** Crowd centre, 0 (left edge) to 1 (right edge). */
  x: number;
  /** Where steering input wants the crowd to be. */
  targetX: number;
  army: number;
  streak: number;
  /** Per resolved row: was it answered correctly. */
  results: boolean[];
  status: RunStatus;
};

/** Track position of row i. The first row starts at the edge of view. */
export function rowPosition(i: number): number {
  return VIEW_DISTANCE + i * ROW_SPACING;
}

/** 1.0× until the first row is reached, then linear to MAX_SPEED_MUL by the time the last row appears. */
export function speedMul(dist: number, rowCount: number): number {
  const start = rowPosition(0);
  const end = rowPosition(rowCount - 1) - VIEW_DISTANCE;
  if (end <= start) return 1;
  const t = Math.min(1, Math.max(0, (dist - start) / (end - start)));
  return 1 + (MAX_SPEED_MUL - 1) * t;
}

export function createRunState(rows: GateRow[]): RunState {
  return {
    rows,
    dist: 0,
    next: 0,
    x: 0.5,
    targetX: 0.5,
    army: STARTING_ARMY,
    streak: 0,
    results: [],
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

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

export function setTarget(s: RunState, targetX: number): RunState {
  if (s.status !== "running") return s;
  return { ...s, targetX: clamp01(targetX) };
}

export function nudgeTarget(s: RunState, dx: number): RunState {
  return setTarget(s, s.targetX + dx);
}

/** Eased move towards the target, never faster than STEER_MAX_SPEED. */
function steerStep(x: number, targetX: number, dt: number): number {
  const v = Math.max(
    -STEER_MAX_SPEED,
    Math.min(STEER_MAX_SPEED, (targetX - x) / STEER_EASE),
  );
  const dx = v * dt;
  // never overshoot the target
  const step = Math.abs(dx) > Math.abs(targetX - x) ? targetX - x : dx;
  return clamp01(x + step);
}

export function stepRun(s: RunState, dt: number): RunState {
  if (s.status !== "running") return s;
  let next = { ...s };
  next.x = steerStep(s.x, s.targetX, dt);
  next.dist += BASE_SPEED * speedMul(s.dist, s.rows.length) * dt;
  while (next.status === "running" && next.dist >= rowPosition(next.next)) {
    next = resolveRow(next);
  }
  return next;
}

function resolveRow(s: RunState): RunState {
  const row = s.rows[s.next];
  if (!row) return { ...s, status: "finished" };
  const correct = nearestOpening(row.options.length, s.x) === row.answerIndex;
  const { army, streak } = correct
    ? applyCorrect(s.army, s.streak, BASE_REWARD[row.type])
    : applyWrong(s.army);
  const nextIndex = s.next + 1;
  const status =
    army <= 0 ? "dead" : nextIndex >= s.rows.length ? "finished" : "running";
  return {
    ...s,
    army,
    streak,
    next: nextIndex,
    results: [...s.results, correct],
    status,
  };
}
