import { packCount } from "../../src/core/fire";
import {
  createRunState,
  enemiesWon,
  nudgeTarget,
  packSurvivors,
  stepRun,
  type RunState,
} from "../../src/core/sim";
import type { Track } from "../../src/core/track";
import {
  CHEER_SECONDS,
  CROWD_DEPTH_MAX,
  FIRE_PER_SOLDIER,
  HORDE_DEFAULTS,
  type HordeTuning,
} from "../../src/core/tuning";

/** A one-pack wave for the horde and kill-effect tests: the army and where the pack stands. */
export type WaveSpec = { army: number; x: number };

/** The tests' waves: a held line (60 vs a pack for 60), a weak army (20), an outmatched one (8). */
export const WAVES = {
  held: { army: 60, x: 0.5 },
  weak: { army: 20, x: 0.55 },
  outmatched: { army: 8, x: 0.5 },
} as const satisfies Record<string, WaveSpec>;

/** The army the pack is sized for. */
const EXPECTED = 60;
/** How far ahead (track units) the crowd's front stands when the wave starts. */
const AHEAD = 7;
const PACK_POS = 100;
/** The track's only question, never reached. */
const FAR = 1e5;
/** Seconds the wave runs on after the pack is gone. */
const AFTER_SECONDS = 1;

const tuning: HordeTuning = {
  hordeK: HORDE_DEFAULTS.packMax / EXPECTED,
  packMax: HORDE_DEFAULTS.packMax,
  killSeconds: HORDE_DEFAULTS.killSeconds,
  packWidth: HORDE_DEFAULTS.packWidth,
  hordeScale: HORDE_DEFAULTS.hordeScale,
};

/** The run a wave plays: no questions or walls, one default pack sized for an army of 60, the crowd waiting. */
function waveRun(w: WaveSpec): RunState {
  const track: Track = {
    questions: [FAR],
    hazards: [{ kind: "pack", pos: PACK_POS, x: w.x }],
    charges: [],
  };
  const s = createRunState([], track, null, tuning);
  return {
    ...s,
    army: w.army,
    hp: [tuning.killSeconds * FIRE_PER_SOLDIER * EXPECTED],
    heads: [packCount(EXPECTED, tuning)],
    dist: PACK_POS - CROWD_DEPTH_MAX / 2 - AHEAD,
  };
}

export type Wave = {
  run: RunState;
  /** Seconds played. */
  t: number;
  /** When the pack was gone (shot out, streamed in, or the army dead), else null. */
  gone: number | null;
  /** The wave has played out: the pack gone for AFTER_SECONDS (CHEER_SECONDS when the enemies won). */
  over: boolean;
};

export const startWave = (w: WaveSpec): Wave => ({
  run: waveRun(w),
  t: 0,
  gone: null,
  over: false,
});

/** Seconds the enemies have cheered (they wiped the army out), -1 when they haven't. */
export const cheerOf = (g: Wave): number =>
  !g.over && g.gone !== null && enemiesWon(g.run) ? g.t - g.gone : -1;

/** One fixed step, steering `dx` track units. */
export function stepWave(g: Wave, dt: number, dx = 0): Wave {
  if (g.over) return g;
  const run = stepRun(dx ? nudgeTarget(g.run, dx) : g.run, dt, 1);
  const t = g.t + dt;
  const gone =
    g.gone ??
    (run.nextHazard >= 1 ||
    packSurvivors(run, 0) <= 0 ||
    run.status !== "running"
      ? t
      : null);
  const over =
    gone !== null &&
    t - gone >= (enemiesWon(run) ? CHEER_SECONDS : AFTER_SECONDS);
  return { run, t, gone, over };
}
