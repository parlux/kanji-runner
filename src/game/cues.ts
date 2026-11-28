import { bossCues, cues, type ClashFrame, type Cue } from "../core/cues";
import type { Scene } from "./scenes";

const frame = (s: Scene): ClashFrame | null =>
  s.kind === "boss" ? { t: s.t, army: s.run.army, boss: s.boss } : null;

/**
 * Every cue from one update step, the scene before and after it: the run's
 * (the step that ends it included) and the boss clash's.
 */
export function sceneCues(prev: Scene, next: Scene): Cue[] {
  const run =
    prev.kind === "run" && "run" in next ? cues(prev.run, next.run) : [];
  return [...run, ...bossCues(frame(prev), frame(next))];
}

/**
 * Where the non-gate cues go (the gate cues go to the voice, in `speakStep`).
 * Task A6 plugs the sound effects player in here; until then they go nowhere.
 */
export function playCues(list: readonly Cue[]): void {
  void list;
}
