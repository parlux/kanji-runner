import { buildKanaRun } from "../core/run";
import { KANA } from "../core/kana";
import {
  createRunState,
  nudgeTarget,
  stepRun,
  type RunState,
} from "../core/sim";
import { buildTrack } from "../core/track";
import { ROWS_PER_RUN, STEER_MAX_SPEED } from "../core/tuning";
import type { Action } from "./input";

export type Scene =
  | { kind: "start" }
  | { kind: "run"; seed: number; run: RunState; paused: boolean }
  | { kind: "end"; seed: number; run: RunState };

function newRun(seed: number): Scene {
  return {
    kind: "run",
    seed,
    run: createRunState(
      buildKanaRun(seed, KANA),
      buildTrack(seed, ROWS_PER_RUN),
    ),
    paused: false,
  };
}

export function handleAction(
  scene: Scene,
  action: Action,
  newSeed: () => number,
): Scene {
  switch (scene.kind) {
    case "start":
    case "end":
      return action === "confirm" ? newRun(newSeed()) : scene;
    case "run":
      return action === "pause" ? { ...scene, paused: !scene.paused } : scene;
  }
}

/** `steer` is the held axis (-1, 0 or 1); holding moves the target at STEER_MAX_SPEED. */
export function updateScene(scene: Scene, dt: number, steer: number): Scene {
  if (scene.kind !== "run" || scene.paused) return scene;
  let run = steer
    ? nudgeTarget(scene.run, steer * STEER_MAX_SPEED * dt)
    : scene.run;
  run = stepRun(run, dt);
  if (run.status !== "running") return { kind: "end", seed: scene.seed, run };
  return { ...scene, run };
}
