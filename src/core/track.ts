import type { Span } from "./crowd";
import { createRng, randInt, type Rng } from "./rng";
import {
  BLOCK_MAX_W,
  BLOCK_MIN_W,
  CALM_DISTANCE,
  ENEMY_X_MARGIN,
  HAZARD_SPACING,
  HAZARDS_MAX,
  HAZARDS_MIN,
  PACK_GAP_CHANCE,
  PACK_BEAT,
  SAW_CHANCE,
  SAW_MAX_AMP,
  SAW_MIN_AMP,
  SAW_RATE,
  SAW_W,
  SQUAD_QUESTIONS,
  SQUADS_ENABLED,
  VIEW_DISTANCE,
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
/** An enemy pack that starts at track position `pos`, centred on `x`. Its strength and movement live in the sim. */
export type Pack = { kind: "pack"; pos: number; x: number };
export type Solid = Block | Saw;
export type Hazard = Solid | Pack;

/** The solid part of a block or saw when the crowd has travelled `dist`. */
export function hazardSpan(h: Solid, dist: number): Span {
  if (h.kind === "block") return { left: h.left, right: h.right };
  const c = h.mid + h.amp * Math.sin(h.phase + dist * SAW_RATE);
  return { left: c - SAW_W / 2, right: c + SAW_W / 2 };
}

function makePack(rng: Rng, pos: number): Hazard {
  return {
    kind: "pack",
    pos,
    x: ENEMY_X_MARGIN + rng() * (1 - 2 * ENEMY_X_MARGIN),
  };
}

function makeSolid(rng: Rng, pos: number): Hazard {
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
  /** Indexes (0-based) of the questions that are squad charges, ascending. The rest are wall gates. */
  charges: number[];
};

export function isCharge(track: Track, q: number): boolean {
  return track.charges.includes(q);
}

/** Decorrelates the layout from the question content built from the same seed. */
const TRACK_SALT = 0x9e3779b9;

/**
 * Seeded beat layout: the first question VIEW_DISTANCE in (a full reading time),
 * then HAZARDS_MIN–HAZARDS_MAX hazards HAZARD_SPACING apart, then a calm stretch
 * right before each next question. After the second question each gap rolls
 * once (PACK_GAP_CHANCE) for a pack: that gap has PACK_BEAT beats and the last
 * is the pack, so a pack is never right behind a gate; the other beats are
 * blocks and saws. Questions SQUAD_QUESTIONS are squad charges when `squads` is on,
 * laid out exactly like walls.
 */
export function buildTrack(
  seed: number,
  questionCount: number,
  squads = SQUADS_ENABLED,
): Track {
  const rng = createRng(seed ^ TRACK_SALT);
  const charges = squads
    ? SQUAD_QUESTIONS.map((q) => q - 1).filter((q) => q < questionCount)
    : [];
  const questions: number[] = [];
  const hazards: Hazard[] = [];
  let pos = Math.max(VIEW_DISTANCE, CALM_DISTANCE);
  for (let q = 0; q < questionCount; q++) {
    questions.push(pos);
    if (q === questionCount - 1) break;
    const pack = q >= 1 && rng() < PACK_GAP_CHANCE;
    const count = pack
      ? PACK_BEAT
      : HAZARDS_MIN + randInt(rng, HAZARDS_MAX - HAZARDS_MIN + 1);
    for (let j = 0; j < count; j++) {
      pos += HAZARD_SPACING;
      hazards.push(
        pack && j === count - 1 ? makePack(rng, pos) : makeSolid(rng, pos),
      );
    }
    pos += CALM_DISTANCE;
  }
  return { questions, hazards, charges };
}
