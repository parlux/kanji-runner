import { applyUnlock } from "../core/progression";
import { buildRun } from "../core/run";
import { KANA } from "../core/kana";
import { KANJI } from "../core/kanji";
import {
  createRunState,
  nudgeTarget,
  stepRun,
  type RunState,
} from "../core/sim";
import { buildTrack } from "../core/track";
import { recordRun } from "../core/srs";
import { ROWS_PER_RUN, STEER_MAX_SPEED } from "../core/tuning";
import type { KanaItem, Progress } from "../core/types";
import type { Action } from "./input";

export type Scene =
  | { kind: "start" }
  | { kind: "run"; seed: number; run: RunState; paused: boolean }
  | { kind: "end"; seed: number; run: RunState };

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
};

/**
 * A normal session plays and saves the stored progress. A dev `?level=N`
 * session is a sandbox: kanji only, levels 2..N unlocked, SRS updates kept in
 * memory for the page's lifetime but never saved, so real progress is untouched.
 */
export function createSession(stored: Progress, level: number | null): Session {
  return level === null
    ? { progress: stored, kana: KANA, persist: true }
    : {
        progress: { ...stored, unlockedLevel: level },
        kana: [],
        persist: false,
      };
}

function newRun(seed: number, session: Session): Scene {
  return {
    kind: "run",
    seed,
    run: createRunState(
      buildRun(seed, session.progress, session.kana, KANJI),
      buildTrack(seed, ROWS_PER_RUN),
    ),
    paused: false,
  };
}

/**
 * The session after one update step: if `prev → next` just ended a run, its
 * answers go into the SRS and the run stats, then the unlock rule runs.
 * Otherwise the same session.
 */
export function afterStep(
  session: Session,
  prev: Scene,
  next: Scene,
  now: number,
): Session {
  if (prev.kind !== "run" || next.kind !== "end") return session;
  const { rows, results, status } = next.run;
  return {
    ...session,
    progress: applyUnlock(
      recordRun(session.progress, rows, results, status === "finished", now),
      session.kana,
      KANJI,
    ),
  };
}

export function handleAction(
  scene: Scene,
  action: Action,
  newSeed: () => number,
  session: Session,
): Scene {
  switch (scene.kind) {
    case "start":
    case "end":
      return action === "confirm" ? newRun(newSeed(), session) : scene;
    case "run":
      return action === "pause" ? { ...scene, paused: !scene.paused } : scene;
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
  if (scene.kind !== "run" || scene.paused) return scene;
  const dx = steer * STEER_MAX_SPEED * dt + dragDx;
  let run = dx ? nudgeTarget(scene.run, dx) : scene.run;
  run = stepRun(run, dt);
  if (run.status !== "running") return { kind: "end", seed: scene.seed, run };
  return { ...scene, run };
}
