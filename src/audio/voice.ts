import type { Spoken } from "../core/speech";

/** What the phone voice needs from the page; absent pieces mean silence, never an error. */
export type SpeechEnv = {
  speechSynthesis?: Pick<SpeechSynthesis, "speak" | "cancel" | "getVoices">;
  SpeechSynthesisUtterance?: typeof SpeechSynthesisUtterance;
};

/**
 * The gate voice. One line at a time: a new line cuts the previous one.
 * For now always the phone's Japanese voice (`speechSynthesis`); clips come
 * later (played first, the phone voice for any clip not ready).
 */
export type Voice = {
  /** Says a line now, cutting whatever is being said. */
  say(line: Spoken): void;
  /** The lines a run may say, given when the run is built (clips will be fetched here). */
  prepare(lines: readonly Spoken[]): void;
  /** Stops the current line. */
  stop(): void;
  /** Call from a user gesture: iOS lets speech start only after one. */
  unlock(): void;
};

const LANG = "ja-JP";
const isJapanese = (v: SpeechSynthesisVoice): boolean =>
  v.lang.replace("_", "-").toLowerCase().startsWith("ja");

export function createVoice(env: SpeechEnv = globalThis): Voice {
  const synth = env.speechSynthesis;
  const Utterance = env.SpeechSynthesisUtterance;
  let unlocked = false;
  const speak = (text: string): void => {
    if (!synth || !Utterance) return;
    try {
      synth.cancel();
      const u = new Utterance(text);
      u.lang = LANG;
      const voice = synth.getVoices().find(isJapanese);
      if (voice) u.voice = voice;
      synth.speak(u);
    } catch {
      // no voice: stay silent
    }
  };
  return {
    say: (line) => speak(line.reading),
    prepare: () => {},
    stop: () => {
      try {
        synth?.cancel();
      } catch {
        // nothing to stop
      }
    },
    unlock: () => {
      if (unlocked) return;
      unlocked = true;
      // an empty line inside the gesture lets later lines play on iOS
      speak("");
    },
  };
}
