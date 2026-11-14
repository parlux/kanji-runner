import { packCount } from "../../core/fire";
import {
  createRunState,
  enemiesWon,
  nudgeTarget,
  packSurvivors,
  stepRun,
  type RunState,
} from "../../core/sim";
import type { Track } from "../../core/track";
import {
  CHEER_SECONDS,
  CROWD_DEPTH_MAX,
  FIRE_PER_SOLDIER,
  type HordeTuning,
} from "../../core/tuning";
import type { WavePreset } from "./presets";

/**
 * The card after each wave (owner, round 1: "give me specific questions"):
 * five questions of three choices each, any left blank, plus a note.
 */
export const QUESTIONS = [
  {
    id: "pace",
    label: "Pace",
    choices: [
      { id: "fast", label: "Too fast" },
      { id: "right", label: "Right" },
      { id: "slow", label: "Too slow" },
    ],
  },
  {
    id: "movement",
    label: "Movement",
    choices: [
      { id: "manic", label: "Too manic" },
      { id: "right", label: "Right" },
      { id: "sluggish", label: "Too sluggish" },
    ],
  },
  {
    id: "converging",
    label: "Converging",
    choices: [
      { id: "snapped", label: "Snapped" },
      { id: "natural", label: "Natural" },
      { id: "slow", label: "Too slow" },
    ],
  },
  {
    id: "size",
    label: "Size for my army",
    choices: [
      { id: "small", label: "Too small" },
      { id: "right", label: "Right" },
      { id: "big", label: "Too big" },
    ],
  },
  {
    id: "melee",
    label: "Melee (only if reached)",
    choices: [
      { id: "unfair", label: "Unfair" },
      { id: "fair", label: "Tense and fair" },
      { id: "none", label: "No threat" },
    ],
  },
] as const;
export type Question = (typeof QUESTIONS)[number];
export type QuestionId = Question["id"];
/** A wave's answers: a choice id per question answered (blank ones absent). */
export type Answers = {
  [Q in Question as Q["id"]]?: Q["choices"][number]["id"];
};

/** Seconds the "Wave N" label shows over the waiting crowd before the wave starts. */
export const INTRO_SECONDS = 2;
/** Seconds the wave runs on after the pack is gone (its last deaths play out; CHEER_SECONDS when the enemies won). */
export const AFTER_SECONDS = 1;

/** Seconds the enemies have cheered (they wiped the army out in a melee), −1 when they haven't. */
export function cheerOf(g: Gauntlet): number {
  const { gone, t } = g.measure;
  return g.phase === "play" && gone !== null && enemiesWon(g.run)
    ? t - gone
    : -1;
}
/** How far ahead (track units) the crowd's front stands while the label shows: in view, short of waking. */
export const INTRO_AHEAD = 7;
/** Where the pack stands when the run is built: far enough that it is not awake yet. */
const PACK_POS = 100;
/** The track's only question, never reached: keeps the boss and walls out of sight. */
const FAR = 1e5;

/** What one wave measured, and the owner's answers and note. */
export type WaveLog = {
  wave: number;
  preset: WavePreset;
  /** First hit to the pack gone (s); null when it all reached you, the army died, or it was never hit. */
  killSeconds: number | null;
  /** Enemies that reached the army. */
  reached: number;
  /** Soldiers lost. */
  lost: number;
  /** The pack's head count once it woke (after adapting to the army). */
  enemies: number;
  /** Average frames per second while the wave ran. */
  fps: number;
  /** The army died. */
  died: boolean;
  /** Null until the card is done. */
  answers: Answers | null;
  note: string;
  /** Round 1's one-tap verdict (older saved runs only). */
  rating?: string | null;
};

/** A wave's running measurements. */
export type Measure = {
  /** Seconds since the wave started. */
  t: number;
  firstHit: number | null;
  gone: number | null;
  lost: number;
  frames: number;
  frameSeconds: number;
};

export type Gauntlet = {
  presets: readonly WavePreset[];
  /** Index of the current wave. */
  index: number;
  phase: "intro" | "play" | "rate" | "done";
  /** Seconds into the phase. */
  t: number;
  run: RunState;
  measure: Measure;
  log: WaveLog[];
};

/** The horde tuning a preset's run is built with: its pack gets exactly `enemies` heads, the cap. */
export function presetTuning(p: WavePreset): HordeTuning {
  return {
    hordeK: p.enemies / p.expected,
    packMax: p.enemies,
    killSeconds: p.killSeconds,
    packWidth: p.packWidth,
    hordeScale: p.hordeScale,
    packAdapt: p.packAdapt,
  };
}

/**
 * The run a wave plays: no questions or walls, one pack sized for the
 * preset's expected army (as the game sizes it), the army at the preset's
 * size, the crowd waiting INTRO_AHEAD ahead. It wakes (and adapts to the
 * army) on the first step.
 */
export function waveRun(p: WavePreset): RunState {
  const horde = presetTuning(p);
  const track: Track = {
    questions: [FAR],
    hazards: [{ kind: "pack", pos: PACK_POS, x: p.x }],
    charges: [],
  };
  const s = createRunState([], track, null, horde);
  return {
    ...s,
    army: p.army,
    hp: [p.killSeconds * FIRE_PER_SOLDIER * p.expected],
    heads: [packCount(p.expected, horde)],
    dist: PACK_POS - CROWD_DEPTH_MAX / 2 - (p.ahead ?? INTRO_AHEAD),
  };
}

const freshMeasure = (): Measure => ({
  t: 0,
  firstHit: null,
  gone: null,
  lost: 0,
  frames: 0,
  frameSeconds: 0,
});

/** The gauntlet at wave 1's label. */
export function startGauntlet(presets: readonly WavePreset[]): Gauntlet {
  const first = presets[0];
  if (!first) throw new Error("empty gauntlet");
  return {
    presets,
    index: 0,
    phase: "intro",
    t: 0,
    run: waveRun(first),
    measure: freshMeasure(),
    log: [],
  };
}

/** Whether the wave's pack is gone: shot out, streamed in, or the army is dead. */
export const packGone = (run: RunState): boolean =>
  run.nextHazard >= 1 || packSurvivors(run, 0) <= 0 || run.status !== "running";

/** The measurements after one play step from `prev` to `next`. */
export function measureStep(
  m: Measure,
  prev: RunState,
  next: RunState,
  dt: number,
): Measure {
  const t = m.t + dt;
  return {
    ...m,
    t,
    firstHit: m.firstHit ?? (next.target === 0 ? t : null),
    gone: m.gone ?? (packGone(next) ? t : null),
    lost: m.lost + Math.max(0, prev.army - next.army),
  };
}

/** The wave's log entry from its measurements and the run at its end. */
export function waveLog(
  wave: number,
  preset: WavePreset,
  m: Measure,
  run: RunState,
): WaveLog {
  const reached = Math.round(run.arrived[0] ?? 0);
  const heads = run.heads[0] ?? 0;
  // the fire finished it: some were shot, none are left, the army stands
  const shotOut =
    reached < heads && packSurvivors(run, 0) <= 0 && run.status !== "dead";
  return {
    wave,
    preset,
    killSeconds:
      m.firstHit !== null && m.gone !== null && shotOut
        ? round2(m.gone - m.firstHit)
        : null,
    reached,
    lost: m.lost,
    enemies: heads,
    fps: m.frameSeconds > 0 ? Math.round(m.frames / m.frameSeconds) : 0,
    died: run.status === "dead",
    answers: null,
    note: "",
  };
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * One fixed step: the label counts down; the wave plays (steering `dx`
 * track units, `pace` the speed preset) and is measured until the pack has
 * been gone AFTER_SECONDS (CHEER_SECONDS when the enemies won: they
 * cheer), then waits for the card.
 */
export function stepGauntlet(
  g: Gauntlet,
  dt: number,
  dx = 0,
  pace = 1,
): Gauntlet {
  if (g.phase === "intro") {
    const t = g.t + dt;
    return t >= INTRO_SECONDS ? { ...g, phase: "play", t: 0 } : { ...g, t };
  }
  if (g.phase !== "play") return g;
  const prev = g.run;
  const run = stepRun(dx ? nudgeTarget(prev, dx) : prev, dt, pace);
  const measure = measureStep(g.measure, prev, run, dt);
  const t = g.t + dt;
  const preset = g.presets[g.index];
  if (
    measure.gone !== null &&
    measure.t - measure.gone >=
      (enemiesWon(run) ? CHEER_SECONDS : AFTER_SECONDS) &&
    preset
  )
    return {
      ...g,
      run,
      measure,
      t,
      phase: "rate",
      log: [...g.log, waveLog(g.index + 1, preset, measure, run)],
    };
  return { ...g, run, measure, t };
}

/** A drawn frame `seconds` after the last one: counted towards the wave's fps while it plays. */
export function countFrame(g: Gauntlet, seconds: number): Gauntlet {
  if (g.phase !== "play" || !(seconds > 0)) return g;
  const m = g.measure;
  return {
    ...g,
    measure: {
      ...m,
      frames: m.frames + 1,
      frameSeconds: m.frameSeconds + seconds,
    },
  };
}

/** The answers and note for the wave just played; then the next wave's label, or the end. */
export function rateWave(g: Gauntlet, answers: Answers, note = ""): Gauntlet {
  if (g.phase !== "rate") return g;
  const log = g.log.map((w, i) =>
    i === g.log.length - 1 ? { ...w, answers, note: note.trim() } : w,
  );
  const index = g.index + 1;
  const next = g.presets[index];
  if (!next) return { ...g, log, phase: "done", t: 0 };
  return {
    ...g,
    log,
    index,
    phase: "intro",
    t: 0,
    run: waveRun(next),
    measure: freshMeasure(),
  };
}
