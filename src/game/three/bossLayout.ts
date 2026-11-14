import { bossSize, bossWon, clashAt } from "../../core/boss";
import { plannedRows, speedMul, type RunState } from "../../core/sim";
import { type Track } from "../../core/track";
import type { GateRow } from "../../core/types";
import {
  BASE_SPEED,
  CLASH_APPROACH_SECONDS,
  CLASH_HOLD_SECONDS,
  CLASH_SECONDS,
} from "../../core/tuning";
import { shapeDistance } from "./world";
import { FIGURE_TOP } from "./wallLayout";

/**
 * The giant boss: one enemy figure this many times a soldier's size (fixed,
 * whatever its HP), standing on the track's centre past the last question.
 */
export const BOSS_SCALE = 5.5;
/** The boss's height (world units): the top of its head. */
export const BOSS_TOP = FIGURE_TOP * BOSS_SCALE;
/** Track distance from the army's firing stop to the boss. */
export const BOSS_RANGE = 1.1;
/** The boss is drawn from this far ahead: haze reaches its top just beyond the shape horizon (it is taller than FOG_TOP_H). */
export const bossShown = (): number => shapeDistance() + 1;

/** Where the army stops to fire and where the boss stands (track distances). */
export type BossPlace = { stop: number; boss: number };

/**
 * The firing stop is past the last question by the distance the army covers
 * in CLASH_APPROACH_SECONDS at the run's final speed (`pace` is the speed
 * preset); the boss stands BOSS_RANGE beyond it.
 */
export function bossPlace(track: Track, pace = 1): BossPlace {
  const last = track.questions.at(-1) ?? 0;
  const speed = BASE_SPEED * pace * speedMul(last, track);
  const stop = last + speed * CLASH_APPROACH_SECONDS;
  return { stop, boss: stop + BOSS_RANGE };
}

/**
 * Where the army is drawn `t` seconds into the boss scene: running on at the
 * final speed from where the run ended (`runDist`), until the firing stop.
 */
export function bossArmyDist(
  runDist: number,
  track: Track,
  pace: number,
  t: number,
): number {
  const { stop } = bossPlace(track, pace);
  const last = track.questions.at(-1) ?? 0;
  const speed = BASE_SPEED * pace * speedMul(last, track);
  return Math.min(Math.max(runDist, stop), runDist + speed * Math.max(0, t));
}

/** How the fight ends in 3D: Victory topples the boss, Defeated stomps it forward, a Tie leaves it standing. */
type BossEnding = "topple" | "stomp" | "stand";

/** What is shown `t` seconds into the boss scene. */
export type BossFight = {
  /** Soldiers and boss HP left, per `clashAt`. */
  army: number;
  hp: number;
  /** Both sides are shooting. */
  firing: boolean;
  /** Set once the clash is over, with how far (0..1) into CLASH_HOLD_SECONDS. */
  ending: { kind: BossEnding; u: number } | null;
};

/**
 * The gunfight `t` seconds into the boss scene, for an army of `army`
 * against a boss of `hp`: nobody fires during the approach, then each
 * soldier lost takes 1 HP per `clashAt`; the ending plays over the hold.
 */
export function bossFightAt(army: number, hp: number, t: number): BossFight {
  const c = clashAt(army, hp, t - CLASH_APPROACH_SECONDS);
  const kind: BossEnding = bossWon(army, hp)
    ? "topple"
    : army === hp
      ? "stand"
      : "stomp";
  const after = t - CLASH_APPROACH_SECONDS - CLASH_SECONDS;
  return {
    army: c.army,
    hp: c.boss,
    firing: t >= CLASH_APPROACH_SECONDS && !c.done,
    ending: c.done
      ? { kind, u: Math.min(1, Math.max(0, after / CLASH_HOLD_SECONDS)) }
      : null,
  };
}

let hpMemo: { rows: readonly GateRow[]; seed: number; hp: number } | null =
  null;

/** The boss's HP for this run: its size, as the boss scene will have it (computed once per run). */
export function bossHp(run: RunState, seed: number): number {
  const rows = plannedRows(run);
  if (hpMemo?.rows !== rows || hpMemo.seed !== seed)
    hpMemo = { rows, seed, hp: bossSize(rows, run.track.charges, seed) };
  return hpMemo.hp;
}

/** What the overlay needs of the boss: its head top (track distance, height), HP, and where the army is drawn. */
export type BossView = {
  dist: number;
  height: number;
  hp: number;
  size: number;
  /** The army's drawn track distance (it runs on past the run's end to the firing stop). */
  armyDist: number;
  /** Opacity of its HP (fades as it topples). */
  alpha: number;
};
