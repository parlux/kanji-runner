import { createRunState, stepRun, type RunState } from "../../src/core/sim";
import { gateOpenings, type Opening } from "../../src/core/gates";
import { kanaRun } from "./kana-run";
import {
  buildTrack,
  type Block,
  type Pack,
  type Saw,
} from "../../src/core/track";
import { ENEMY_HP, HORDE_DEFAULTS, ROWS_PER_RUN } from "../../src/core/tuning";

export const DT = 1 / 60;

/** Steps until the next row resolves; returns the new state. */
export function runToNextRow(s: RunState): RunState {
  const target = s.next + 1;
  while (s.next < target && s.status === "running") s = stepRun(s, DT);
  return s;
}

/** Places the crowd (and its target) at the centre of opening i of the next row. */
export function goToOpening(s: RunState, i: number): RunState {
  const n = s.rows[s.next]?.options.length ?? 2;
  const x = gateOpenings(n)[i]?.centre ?? 0.5;
  return { ...s, x, targetX: x };
}

/** Indexes an openings array without undefined. */
export const at = (o: Opening[], i: number): Opening => o[i] as Opening;

/** A seeded run of wall gates (squad charges are in squad.test.ts). Hazards are off unless asked for, so row tests stay about rows. */
export function fresh(seed = 1, hazards = false): RunState {
  const track = buildTrack(seed, ROWS_PER_RUN, false);
  return createRunState(
    kanaRun(seed),
    hazards ? track : { ...track, hazards: [] },
  );
}

/** Track position of row i. */
export const rowPos = (s: RunState, i: number): number =>
  s.track.questions[i] as number;

export const wide = (pos: number): Block => ({
  kind: "block",
  pos,
  left: 0,
  right: 1,
});
/**
 * One far-off question, the given hazards, and chosen hit points; packs get
 * one enemy per ENEMY_HP unless `heads` says otherwise.
 */
export function range(
  hazards: (Block | Saw | Pack)[],
  hp: number[],
  army = 20,
  heads = hp.map((h) => Math.round(h / ENEMY_HP)),
): RunState {
  const s = createRunState(kanaRun(1), {
    questions: [100],
    hazards,
    charges: [],
  });
  // the head starts at the given place (createRunState starts it at the crowd's front)
  const packs = hazards.map((h) =>
    h.kind === "pack" ? { pos: h.pos, x: h.x } : null,
  );
  return { ...s, hp, heads, army, packs };
}
export const pack = (pos: number, x = 0.5): Pack => ({ kind: "pack", pos, x });
/** Packs narrower than the track, so they can miss the crowd. */
export const NARROW = { ...HORDE_DEFAULTS, packWidth: 0.1 };
export const stepFor = (s: RunState, secs: number): RunState => {
  for (let t = 0; t < Math.round(secs / DT); t++) s = stepRun(s, DT);
  return s;
};
