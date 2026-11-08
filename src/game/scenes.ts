import { bossSize, bossWon } from "../core/boss";
import { applyUnlock, maxLevel, place } from "../core/progression";
import { mergeProgress } from "../core/merge";
import { builtInPool, wanikaniPool } from "../core/pool";
import { reaskRun } from "../core/reask";
import { buildPoolRun } from "../core/run";
import { KANA } from "../core/kana";
import { KANJI } from "../core/kanji";
import {
  createRunState,
  nudgeTarget,
  plannedRows,
  stepRun,
  type RunState,
} from "../core/sim";
import { buildTrack } from "../core/track";
import { recordRun } from "../core/srs";
import {
  CLASH_APPROACH_SECONDS,
  CLASH_HOLD_SECONDS,
  CLASH_SECONDS,
  ROWS_PER_RUN,
  STEER_MAX_SPEED,
} from "../core/tuning";
import type { KanaItem, Progress } from "../core/types";
import type { WkList } from "../wanikani/parse";
import type { Action } from "./input";

export type Scene =
  /** `pick` is set while the placement picker is open: "I know up to level pick". */
  | { kind: "start"; pick?: number }
  | { kind: "run"; seed: number; run: RunState; paused: boolean }
  /** The clash after the last question: `t` seconds in, against a boss of `boss` units. */
  | { kind: "boss"; seed: number; run: RunState; boss: number; t: number }
  /** `boss` is null when the army died before reaching the boss. */
  | { kind: "end"; seed: number; run: RunState; boss: BossResult | null };

/** How the boss clash went: the boss's size and whether the army won (a tie is a loss). */
export type BossResult = { size: number; won: boolean };

/**
 * Dev flag `?level=N` (N ≥ 2): kanji levels 2..N count as unlocked, and runs
 * ask meaning and reading gates. Null for normal kana runs.
 */
export function devLevel(search: string): number | null {
  const n = Number(new URLSearchParams(search).get("level"));
  return Number.isInteger(n) && n >= 2 ? n : null;
}

/** What runs are built from this page load, and whether results are saved. */
export type Session = {
  progress: Progress;
  kana: readonly KanaItem[];
  persist: boolean;
  /** The level the last run unlocked, shown until the next run starts. */
  unlocked: number | null;
  /** The taught WaniKani kanji when runs use WaniKani mode, else null (Built-in). */
  wk: WkList | null;
};

/**
 * A normal session plays and saves the stored progress. A dev `?level=N`
 * session is a sandbox: kanji only, levels 2..N unlocked, SRS updates kept in
 * memory for the page's lifetime but never saved, so real progress is untouched.
 */
export function createSession(stored: Progress, level: number | null): Session {
  return level === null
    ? { progress: stored, kana: KANA, persist: true, unlocked: null, wk: null }
    : {
        progress: { ...stored, unlockedLevel: level },
        kana: [],
        persist: false,
        unlocked: null,
        wk: null,
      };
}

/**
 * The session with synced progress merged in. Merging (not replacing) keeps a
 * run that finished while the sync was in flight. A dev session never syncs.
 */
export function adoptProgress(session: Session, synced: Progress): Session {
  if (!session.persist) return session;
  return { ...session, progress: mergeProgress(session.progress, synced) };
}

/**
 * A new run. WaniKani runs have re-asks on (built with `reaskRun`, same rows
 * as `buildPoolRun`); Built-in runs have none and are unchanged.
 */
function newRun(seed: number, session: Session): Scene {
  const track = buildTrack(seed, ROWS_PER_RUN);
  const { progress, kana, wk } = session;
  let run: RunState;
  if (wk) {
    const pool = wanikaniPool(progress, kana, wk);
    const { rows, reask } = reaskRun(seed, progress, pool);
    run = createRunState(rows, track, reask);
  } else {
    const pool = builtInPool(progress, kana, KANJI);
    run = createRunState(buildPoolRun(seed, progress, pool), track);
  }
  return { kind: "run", seed, run, paused: false };
}

/**
 * The session after one update step: if `prev → next` just left the run (to
 * the boss, or to the end screen if the army died), its answers go into the
 * SRS and the run stats, then the unlock rule runs. The SRS updates whatever
 * the boss outcome; only beating the boss counts as a win. Otherwise the same
 * session.
 */
export function afterStep(
  session: Session,
  prev: Scene,
  next: Scene,
  now: number,
): Session {
  if (prev.kind !== "run" || (next.kind !== "boss" && next.kind !== "end"))
    return session;
  const { rows, results, army, reask } = next.run;
  const won = next.kind === "boss" && bossWon(army, next.boss);
  const progress = applyUnlock(
    recordRun(session.progress, rows, results, won, now, reask ?? undefined),
    session.kana,
    KANJI,
  );
  const gained = progress.unlockedLevel > session.progress.unlockedLevel;
  return {
    ...session,
    progress,
    unlocked: gained ? progress.unlockedLevel : null,
  };
}

/**
 * The start screen: `confirm` starts a run; ←/→ or `place` open the placement
 * picker at the current placement (unlocked level − 1, −1 = none). In the
 * picker ←/→ change the pick, `confirm` applies it, `back` closes it.
 */
function startAction(
  scene: Extract<Scene, { kind: "start" }>,
  action: Action,
  newSeed: () => number,
  session: Session,
): { scene: Scene; session: Session } {
  const { pick } = scene;
  if (pick === undefined) {
    if (action === "confirm") {
      const next = { ...session, unlocked: null };
      return { scene: newRun(newSeed(), next), session: next };
    }
    // placement is off in WaniKani mode: WaniKani's level gates the pool
    if (
      !session.wk &&
      (action === "left" || action === "right" || action === "place")
    )
      return {
        scene: { kind: "start", pick: session.progress.unlockedLevel - 1 },
        session,
      };
    return { scene, session };
  }
  const top = maxLevel(KANJI) - 1;
  switch (action) {
    case "left":
    case "right": {
      const next = pick + (action === "left" ? -1 : 1);
      return {
        scene: { kind: "start", pick: Math.max(-1, Math.min(top, next)) },
        session,
      };
    }
    case "confirm":
    case "place":
      return {
        scene: { kind: "start" },
        session: {
          ...session,
          progress: place(session.progress, pick, KANA, KANJI),
        },
      };
    case "back":
      return { scene: { kind: "start" }, session };
    default:
      return { scene, session };
  }
}

/** The scene, and the session (placement changes progress), after an action. */
export function handleAction(
  scene: Scene,
  action: Action,
  newSeed: () => number,
  session: Session,
): { scene: Scene; session: Session } {
  switch (scene.kind) {
    case "start":
      return startAction(scene, action, newSeed, session);
    case "boss":
      return { scene, session };
    case "end":
      return {
        scene: action === "confirm" ? { kind: "start" } : scene,
        session,
      };
    case "run":
      return {
        scene: action === "pause" ? { ...scene, paused: !scene.paused } : scene,
        session,
      };
  }
}

/**
 * `steer` is the held axis (-1, 0 or 1); holding moves the target at STEER_MAX_SPEED.
 * `dragDx` is target movement from drag, in track units.
 */
export function updateScene(
  scene: Scene,
  dt: number,
  steer: number,
  dragDx = 0,
): Scene {
  if (scene.kind === "boss") return stepBoss(scene, dt);
  if (scene.kind !== "run" || scene.paused) return scene;
  const dx = steer * STEER_MAX_SPEED * dt + dragDx;
  let run = dx ? nudgeTarget(scene.run, dx) : scene.run;
  run = stepRun(run, dt);
  const { seed } = scene;
  if (run.status === "dead") return { kind: "end", seed, run, boss: null };
  if (run.status === "finished")
    return {
      kind: "boss",
      seed,
      run,
      boss: bossSize(plannedRows(run), run.track.charges, seed),
      t: 0,
    };
  return { ...scene, run };
}

/** The sides close in, the clash plays out, the result holds, then the end screen. */
function stepBoss(scene: Extract<Scene, { kind: "boss" }>, dt: number): Scene {
  const t = scene.t + dt;
  if (t < CLASH_APPROACH_SECONDS + CLASH_SECONDS + CLASH_HOLD_SECONDS)
    return { ...scene, t };
  const { seed, run, boss } = scene;
  return {
    kind: "end",
    seed,
    run,
    boss: { size: boss, won: bossWon(run.army, boss) },
  };
}
