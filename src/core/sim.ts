import { applyCorrect, applyWrong } from "./scoring";
import {
  BASE_REWARD,
  BASE_SPEED,
  MAX_SPEED_MUL,
  ROW_SPACING,
  STARTING_ARMY,
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
  /** Lane index within the next row's options. */
  lane: number;
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
    lane: 0,
    army: STARTING_ARMY,
    streak: 0,
    results: [],
    status: "running",
  };
}

function laneCount(s: RunState, row: number): number {
  return s.rows[row]?.options.length ?? 1;
}

export function steer(s: RunState, dir: -1 | 1): RunState {
  if (s.status !== "running") return s;
  const lane = Math.min(laneCount(s, s.next) - 1, Math.max(0, s.lane + dir));
  return lane === s.lane ? s : { ...s, lane };
}

export function stepRun(s: RunState, dt: number): RunState {
  if (s.status !== "running") return s;
  let next = { ...s };
  next.dist += BASE_SPEED * speedMul(s.dist, s.rows.length) * dt;
  while (next.status === "running" && next.dist >= rowPosition(next.next)) {
    next = resolveRow(next);
  }
  return next;
}

function resolveRow(s: RunState): RunState {
  const row = s.rows[s.next];
  if (!row) return { ...s, status: "finished" };
  const correct = s.lane === row.answerIndex;
  const { army, streak } = correct
    ? applyCorrect(s.army, s.streak, BASE_REWARD[row.type])
    : applyWrong(s.army);
  const nextIndex = s.next + 1;
  const from = laneCount(s, s.next);
  const to = laneCount(s, nextIndex);
  // keep the army on the same side of the track when the lane count changes
  const lane = from === to ? s.lane : Math.floor(((s.lane + 0.5) / from) * to);
  const status =
    army <= 0 ? "dead" : nextIndex >= s.rows.length ? "finished" : "running";
  return {
    ...s,
    army,
    streak,
    lane,
    next: nextIndex,
    results: [...s.results, correct],
    status,
  };
}
