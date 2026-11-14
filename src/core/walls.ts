import { clipLoss, crowdWidth } from "./crowd";
import { firepower } from "./fire";
import {
  gateOpenings,
  growOpening,
  nearestOpening,
  wallSolids,
  type Opening,
} from "./gates";
import { placeReask } from "./reask-hook";
import {
  applyCorrect,
  applyCorrectCharge,
  applyWrong,
  applyWrongCharge,
} from "./scoring";
import type { RunState } from "./state";
import { isCharge } from "./track";
import { BASE_REWARD, FIRE_RANGE, GATE_GROW_PER_DAMAGE } from "./tuning";

/** Row q's wall openings as they are now. */
export function rowOpenings(s: RunState, q: number): Opening[] {
  return s.gates[q] ?? gateOpenings(s.rows[q]?.options.length ?? 2);
}

/**
 * With nothing else to shoot, fire goes to the next wall once it is within
 * FIRE_RANGE: the opening nearest the crowd's centre grows (see growOpening).
 * Only where the crowd is matters, never which answer is right.
 */
export function shootGate(s: RunState, dt: number): RunState {
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
 * Contact with a wall, or a charge (a wall with a squad in each opening):
 * the wall clips, the opening nearest the crowd's centre is the answer, and
 * a charge scores as a charge.
 */
export function resolveRow(s: RunState): RunState {
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
    bestStreak: Math.max(s.bestStreak, streak),
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
