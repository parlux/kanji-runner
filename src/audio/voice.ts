import type { Spoken } from "../core/speech";
import type { VoiceDuck } from "./duck";

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
  /**
   * Says a line `delayMs` from now (default at once), cutting whatever is
   * being said when it starts; a newer line, or `stop`, cancels a pending one.
   */
  say(line: Spoken, delayMs?: number): void;
  /** The lines a run may say, given when the run is built (clips will be fetched here). */
  prepare(lines: readonly Spoken[]): void;
  /** Stops the current line and drops a pending one. */
  stop(): void;
  /** Off: nothing is said, and the current line stops at once. */
  setEnabled(on: boolean): void;
  /** Call from a user gesture: iOS lets speech start only after one. */
  unlock(): void;
};

/** How long the voice waits after the right-gate chime and after the wrong-gate buzz. */
export const VOICE_AFTER_CHIME_MS = 120;
export const VOICE_AFTER_BUZZ_MS = 300;

const LANG = "ja-JP";
const isJapanese = (v: SpeechSynthesisVoice): boolean =>
  v.lang.replace("_", "-").toLowerCase().startsWith("ja");

/**
 * The voice; `duck` hears when a line plays, so the other sounds dip under
 * it: the phone voice opens it on its start event and closes it on its end
 * (a clip would call `holdFor` with its length as it starts).
 */
export function createVoice(
  env: SpeechEnv = globalThis,
  duck: VoiceDuck | null = null,
): Voice {
  const synth = env.speechSynthesis;
  const Utterance = env.SpeechSynthesisUtterance;
  let unlocked = false;
  let enabled = true;
  let pending: ReturnType<typeof setTimeout> | null = null;
  // ends the duck for the line playing now
  let release = (): void => {};
  const endLine = (): void => {
    release();
    release = () => {};
  };
  const speak = (text: string): void => {
    if (!synth || !Utterance) return;
    try {
      synth.cancel();
      endLine();
      const u = new Utterance(text);
      u.lang = LANG;
      const voice = synth.getVoices().find(isJapanese);
      if (voice) u.voice = voice;
      if (duck && text) {
        let close: (() => void) | null = null;
        u.onstart = () => {
          if (close) return;
          close = duck.open();
          release = close;
        };
        u.onend = u.onerror = () => close?.();
      }
      synth.speak(u);
    } catch {
      // no voice: stay silent
    }
  };
  const drop = (): void => {
    if (pending !== null) clearTimeout(pending);
    pending = null;
  };
  const stop = (): void => {
    drop();
    endLine();
    try {
      synth?.cancel();
    } catch {
      // nothing to stop
    }
  };
  return {
    say: (line, delayMs = 0) => {
      if (!enabled) return;
      drop();
      if (delayMs <= 0) return speak(line.reading);
      pending = setTimeout(() => {
        pending = null;
        if (enabled) speak(line.reading);
      }, delayMs);
    },
    prepare: () => {},
    stop,
    setEnabled: (on) => {
      enabled = on;
      if (!on) stop();
    },
    unlock: () => {
      if (unlocked) return;
      unlocked = true;
      // an empty line inside the gesture lets later lines play on iOS
      speak("");
    },
  };
}
