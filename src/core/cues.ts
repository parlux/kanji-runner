import { bossWon } from "./boss";
import { isShattered } from "./shooting";
import type { RunState } from "./state";
import { CLASH_APPROACH_SECONDS, CLASH_SECONDS, SHOT_CUE_MS } from "./tuning";

/** Something worth a sound, derived from two states one step apart. */
export type Cue =
  | { kind: "gate-right"; row: number }
  | { kind: "gate-wrong"; row: number }
  | { kind: "shot" }
  | { kind: "hazard-broken" }
  | { kind: "pack-wiped" }
  | { kind: "boss-clash" }
  | { kind: "boss-won" }
  | { kind: "boss-lost" };

/**
 * What happened between two run states one step apart: a gate per newly
 * resolved row (with its index), a shot while any fire is going out, a block
 * shattered (crate or wall), a pack wiped out. Pure; a shot is reported on
 * every firing step (see `limitShots`).
 */
export function cues(prev: RunState, next: RunState): Cue[] {
  const out: Cue[] = [];
  for (let row = prev.results.length; row < next.results.length; row++)
    out.push({ kind: next.results[row] ? "gate-right" : "gate-wrong", row });
  if (next.targets.length > 0 || next.gateTarget !== null)
    out.push({ kind: "shot" });
  next.track.hazards.forEach((h, i) => {
    if (h.kind === "saw" || isShattered(prev, i) || !isShattered(next, i))
      return;
    out.push({ kind: h.kind === "pack" ? "pack-wiped" : "hazard-broken" });
  });
  return out;
}

/**
 * Rate-limits shot cues: `wait` is the milliseconds until the next one is
 * allowed (0 at the start); pass the step's `dtMs` and carry the returned
 * `wait` to the next step. Other cues pass untouched.
 */
export function limitShots(
  list: readonly Cue[],
  dtMs: number,
  wait: number,
): { cues: Cue[]; wait: number } {
  let left = Math.max(0, wait - dtMs);
  const out: Cue[] = [];
  for (const c of list) {
    if (c.kind === "shot") {
      if (left > 0) continue;
      left = SHOT_CUE_MS;
    }
    out.push(c);
  }
  return { cues: out, wait: left };
}

/** The boss clash as the scene holds it: seconds in, the army and the boss. */
export type ClashFrame = { t: number; army: number; boss: number };

/**
 * Cues of the boss clash between two frames (`null` outside it): the sides
 * meet when the approach ends; the result sounds when the clash is done.
 */
export function bossCues(
  prev: ClashFrame | null,
  next: ClashFrame | null,
): Cue[] {
  if (!next) return [];
  const from = prev ? prev.t : -1;
  const out: Cue[] = [];
  if (from < CLASH_APPROACH_SECONDS && next.t >= CLASH_APPROACH_SECONDS)
    out.push({ kind: "boss-clash" });
  const end = CLASH_APPROACH_SECONDS + CLASH_SECONDS;
  if (from < end && next.t >= end)
    out.push({
      kind: bossWon(next.army, next.boss) ? "boss-won" : "boss-lost",
    });
  return out;
}
