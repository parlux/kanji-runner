import { createRng, randInt } from "./rng";
import {
  BLOCK_MAX_W,
  BLOCK_MIN_W,
  CALM_DISTANCE,
  HAZARD_SPACING,
} from "./tuning";

/** A static solid at track position `pos`, spanning [left, right]. */
export type Block = { kind: "block"; pos: number; left: number; right: number };
export type Hazard = Block;

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
      const width = BLOCK_MIN_W + rng() * (BLOCK_MAX_W - BLOCK_MIN_W);
      const left = rng() * (1 - width);
      hazards.push({ kind: "block", pos, left, right: left + width });
    }
    pos += CALM_DISTANCE;
  }
  return { questions, hazards };
}
