import type { Voice } from "../audio/voice";
import { KANJI } from "../core/kanji";
import { spoken, type SpeechContext, type Spoken } from "../core/speech";
import type { RunState } from "../core/state";
import { WORDS } from "../core/words";
import type { Scene, Session } from "./scenes";

const context = (session: Session): SpeechContext => ({
  kanji: session.wk?.kanji ?? KANJI,
  words: WORDS,
  progress: session.progress,
});

const lines = (
  run: RunState,
  from: number,
  to: number,
  ctx: SpeechContext,
): Spoken[] => run.rows.slice(from, to).flatMap((r) => spoken(r, ctx) ?? []);

/**
 * The gate voice's one hook, called once per update step with the scene
 * before and after it and the session the run was built from (before the run
 * is recorded): a new run hands its lines to the voice; every gate row that
 * resolved this step, right or wrong, is said.
 */
export function speakStep(
  voice: Voice,
  prev: Scene,
  next: Scene,
  session: Session,
): void {
  if (next.kind === "run" && prev.kind !== "run")
    voice.prepare(lines(next.run, 0, next.run.rows.length, context(session)));
  if (prev.kind !== "run" || !("run" in next)) return;
  const from = prev.run.results.length;
  const to = next.run.results.length;
  if (to > from)
    for (const line of lines(next.run, from, to, context(session)))
      voice.say(line);
}
