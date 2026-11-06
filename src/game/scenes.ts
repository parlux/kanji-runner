import { buildKanaRun } from "../core/run";
import { KANA } from "../core/kana";
import { createRunState, steer, stepRun, type RunState } from "../core/sim";
import type { Action } from "./input";

/** Army's horizontal slide speed, in track widths per second. */
const ARMY_SLIDE_SPEED = 4;

export type Scene =
  | { kind: "start" }
  | {
      kind: "run";
      seed: number;
      run: RunState;
      paused: boolean;
      /** Army centre as a fraction of track width (visual only). */
      armyX: number;
    }
  | { kind: "end"; seed: number; run: RunState };

export function laneCenter(run: RunState): number {
  const lanes = run.rows[run.next]?.options.length ?? 1;
  return (run.lane + 0.5) / lanes;
}

function newRun(seed: number): Scene {
  const run = createRunState(buildKanaRun(seed, KANA));
  return { kind: "run", seed, run, paused: false, armyX: laneCenter(run) };
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
      if (action === "pause") return { ...scene, paused: !scene.paused };
      if (scene.paused) return scene;
      if (action === "left") return { ...scene, run: steer(scene.run, -1) };
      if (action === "right") return { ...scene, run: steer(scene.run, 1) };
      return scene;
  }
}

export function updateScene(scene: Scene, dt: number): Scene {
  if (scene.kind !== "run" || scene.paused) return scene;
  const run = stepRun(scene.run, dt);
  if (run.status !== "running") return { kind: "end", seed: scene.seed, run };
  const target = laneCenter(run);
  const max = ARMY_SLIDE_SPEED * dt;
  const armyX =
    scene.armyX + Math.max(-max, Math.min(max, target - scene.armyX));
  return { ...scene, run, armyX };
}
