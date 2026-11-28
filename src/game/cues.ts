import { bossCues, cues, type ClashFrame, type Cue } from "../core/cues";
import type { Scene, Session } from "./scenes";
import type { SoundName } from "../audio/sfx";

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
 * Plays a step's cues as sound effects, gate cues included (the chime or
 * buzz; the voice follows in `speakStep`).
 */
export function playCues(
  play: (names: readonly SoundName[]) => void,
  list: readonly Cue[],
): void {
  if (list.length > 0) play(list.map((c) => c.kind));
}

/**
 * Whether the step brings up the end screen of a run that unlocked a level
 * (`session` is the one after the step), for the unlock jingle.
 */
export const unlockSound = (
  prev: Scene,
  next: Scene,
  session: Session,
): boolean =>
  prev.kind !== "end" && next.kind === "end" && session.unlocked !== null;
