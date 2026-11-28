import { clipKey, type Spoken } from "../core/speech";
import type { VoiceDuck } from "./duck";
import type { AudioEngine } from "./engine";

/** The picked character: its clip folder under `voice/` and the credit its terms ask for. */
export const VOICE_ID = "ryusei-nekketsu";
export const VOICE_CREDIT = "VOICEVOX:青山龍星";

/** A clip folder's `index.json`: clip key → [file, length in ms]. */
type ClipIndex = Record<string, [file: string, ms: number]>;

/** Where the clips come from and where they play; absent, every line is the phone voice. */
export type ClipEnv = {
  engine: Pick<AudioEngine, "context" | "bus">;
  /** The clip folder's URL, ending in `/` (it holds `index.json` and the clips). */
  base: string;
  fetch?: (
    url: string,
  ) => Promise<Pick<Response, "ok" | "json" | "arrayBuffer">>;
};

/** What the phone voice needs from the page; absent pieces mean silence, never an error. */
export type SpeechEnv = {
  speechSynthesis?: Pick<SpeechSynthesis, "speak" | "cancel" | "getVoices">;
  SpeechSynthesisUtterance?: typeof SpeechSynthesisUtterance;
};

/**
 * The gate voice. One line at a time: a new line cuts the previous one.
 * A line plays its VOICEVOX clip on the voice bus when the clip is fetched
 * and decoded; otherwise the phone's Japanese voice (`speechSynthesis`) says it.
 */
export type Voice = {
  /**
   * Says a line `delayMs` from now (default at once), cutting whatever is
   * being said when it starts; a newer line, or `stop`, cancels a pending one.
   */
  say(line: Spoken, delayMs?: number): void;
  /** The lines a run may say, given when the run is built: their clips are fetched and decoded now; other clips are dropped. */
  prepare(lines: readonly Spoken[]): void;
  /** Stops the current line and drops a pending one. */
  stop(): void;
  /** Off: nothing is said, and the current line stops at once. */
  setEnabled(on: boolean): void;
  /** Call from every user gesture: iOS lets speech start only after one; clips waiting for the AudioContext decode. */
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
 * it: it opens as a line starts (the phone voice's start event, or a clip's
 * start) and closes when the line ends or is cut.
 */
export function createVoice(
  env: SpeechEnv = globalThis,
  duck: VoiceDuck | null = null,
  clips: ClipEnv | null = null,
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
  const fetcher = clips?.fetch ?? globalThis.fetch?.bind(globalThis);
  let index: Promise<ClipIndex | null> | null = null;
  // per key: the clip's bytes (null: none), and its decoded audio once ready
  const bytes = new Map<string, Promise<ArrayBuffer | null>>();
  const decoded = new Map<string, AudioBuffer>();
  const decoding = new Set<string>();
  let source: AudioBufferSourceNode | null = null;
  const decode = (key: string): void => {
    const ctx = clips?.engine.context();
    const got = bytes.get(key);
    if (!ctx || !got || decoded.has(key) || decoding.has(key)) return;
    decoding.add(key);
    void got
      .then((b) => (b ? ctx.decodeAudioData(b.slice(0)) : null))
      .then((buf) => {
        if (buf && bytes.has(key)) decoded.set(key, buf);
      })
      .catch(() => {})
      .finally(() => decoding.delete(key));
  };
  const load = (key: string): void => {
    if (!clips || !fetcher || bytes.has(key)) return;
    index ??= fetcher(`${clips.base}index.json`)
      .then((r) => (r.ok ? (r.json() as Promise<ClipIndex>) : null))
      .catch(() => null);
    const base = clips.base;
    bytes.set(
      key,
      index
        .then(async (i) => {
          const clip = i?.[key];
          if (!clip) return null;
          const r = await fetcher(`${base}${clip[0]}`);
          return r.ok ? r.arrayBuffer() : null;
        })
        .catch(() => null),
    );
  };
  const stopClip = (): void => {
    const s = source;
    source = null;
    try {
      s?.stop();
    } catch {
      // already stopped
    }
  };
  /** Plays the line's clip if it is ready; false sends the line to the phone voice. */
  const playClip = (line: Spoken): boolean => {
    const key = clipKey(line);
    const buf = decoded.get(key);
    const ctx = clips?.engine.context();
    const bus = clips?.engine.bus("voice");
    if (!buf || !ctx || !bus) {
      decode(key);
      return false;
    }
    try {
      synth?.cancel();
      endLine();
      stopClip();
      const s = ctx.createBufferSource();
      s.buffer = buf;
      s.connect(bus);
      const close = duck?.open() ?? (() => {});
      release = close;
      s.onended = () => {
        close();
        if (source === s) source = null;
      };
      s.start();
      source = s;
      return true;
    } catch {
      return false;
    }
  };
  const speak = (text: string): void => {
    stopClip();
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
    stopClip();
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
      const say = (): void => {
        if (!playClip(line)) speak(line.reading);
      };
      if (delayMs <= 0) return say();
      pending = setTimeout(() => {
        pending = null;
        if (enabled) say();
      }, delayMs);
    },
    prepare: (lines) => {
      const keys = new Set(lines.map(clipKey));
      for (const k of [...bytes.keys()])
        if (!keys.has(k)) {
          bytes.delete(k);
          decoded.delete(k);
        }
      for (const k of keys) {
        load(k);
        decode(k);
      }
    },
    stop,
    setEnabled: (on) => {
      enabled = on;
      if (!on) stop();
    },
    unlock: () => {
      // clips fetched before the AudioContext existed decode now
      for (const k of bytes.keys()) decode(k);
      if (unlocked) return;
      unlocked = true;
      // an empty line inside the gesture lets later lines play on iOS
      speak("");
    },
  };
}
