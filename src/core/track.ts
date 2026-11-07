import type { Span } from "./crowd";
import { createRng, randInt, type Rng } from "./rng";
import {
  BLOCK_MAX_W,
  BLOCK_MIN_W,
  CALM_DISTANCE,
  HAZARD_SPACING,
  SAW_CHANCE,
  SAW_MAX_AMP,
  SAW_MIN_AMP,
  SAW_RATE,
  SAW_W,
} from "./tuning";

/** A static solid at track position `pos`, spanning [left, right]. */
export type Block = { kind: "block"; pos: number; left: number; right: number };
/** A SAW_W-wide solid whose centre sweeps as mid + amp·sin(phase + dist·SAW_RATE). */
export type Saw = {
  kind: "saw";
  pos: number;
  mid: number;
  amp: number;
  phase: number;
};
export type Hazard = Block | Saw;

/** The solid part of a hazard when the crowd has travelled `dist`. */
export function hazardSpan(h: Hazard, dist: number): Span {
  if (h.kind === "block") return { left: h.left, right: h.right };
  const c = h.mid + h.amp * Math.sin(h.phase + dist * SAW_RATE);
  return { left: c - SAW_W / 2, right: c + SAW_W / 2 };
}

function makeHazard(rng: Rng, pos: number): Hazard {
  if (rng() < SAW_CHANCE) {
    const amp = SAW_MIN_AMP + rng() * (SAW_MAX_AMP - SAW_MIN_AMP);
    // keep the whole sweep on the track
    const lo = SAW_W / 2 + amp;
    const mid = lo + rng() * (1 - 2 * lo);
    return { kind: "saw", pos, mid, amp, phase: rng() * 2 * Math.PI };
  }
  const width = BLOCK_MIN_W + rng() * (BLOCK_MAX_W - BLOCK_MIN_W);
  const left = rng() * (1 - width);
  return { kind: "block", pos, left, right: left + width };
}

export type Track = {
  /** Track position of each question, ascending. */
  questions: number[];
  /** Hazards between questions, ascending by position. */
  hazards: Hazard[];
};

/** Decorrelates the layout from the question content built from the same seed. */
const TRACK_SALT = 0x9e3779b9;

/**
 * Seeded beat layout: the first question after a calm stretch, then 1–2 hazards
 * HAZARD_SPACING apart, then a calm stretch before each next question.
 */
export function buildTrack(seed: number, questionCount: number): Track {
  const rng = createRng(seed ^ TRACK_SALT);
  const questions: number[] = [];
  const hazards: Hazard[] = [];
  let pos = CALM_DISTANCE;
  for (let q = 0; q < questionCount; q++) {
    questions.push(pos);
    if (q === questionCount - 1) break;
    const count = 1 + randInt(rng, 2);
    for (let j = 0; j < count; j++) {
      pos += HAZARD_SPACING;
      hazards.push(makeHazard(rng, pos));
    }
    pos += CALM_DISTANCE;
  }
  return { questions, hazards };
}
