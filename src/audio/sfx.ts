import type { Cue } from "../core/cues";

/**
 * One voice of a sound, sfxr style: a wave (or white noise) sliding from
 * `freq` to `to` (Hz; for noise, the low-pass cutoff), shaped by a linear
 * attack, a hold at `volume` and a release (seconds), `at` seconds in.
 * `lowpass` softens square and saw waves.
 */
type Tone = {
  wave: OscillatorType | "noise";
  freq: number;
  to?: number;
  at?: number;
  attack: number;
  hold: number;
  release: number;
  volume: number;
  lowpass?: number;
};

/** A sound: its tones, and a random pitch spread (±fraction) per play. */
export type Sound = { tones: Tone[]; jitter?: number };

/** Every sound effect: the run's cues (gate cues included) and the scenes' unlock and tap. */
export type SoundName = Cue["kind"] | "unlock" | "tap";

const semis = (hz: number, n: number): number => hz * 2 ** (n / 12);

/** An arpeggio: `tone` once per note (semitones from its `freq`), `step` seconds apart. */
const arp = (tone: Tone, notes: readonly number[], step: number): Tone[] =>
  notes.map((n, i) => ({
    ...tone,
    at: (tone.at ?? 0) + i * step,
    freq: semis(tone.freq, n),
    ...(tone.to ? { to: semis(tone.to, n) } : {}),
  }));

/** The last tone of a list, rung out longer. */
const ringLast = (tones: Tone[], release: number): Tone[] =>
  tones.map((t, i) => (i === tones.length - 1 ? { ...t, release } : t));

const A5 = 880;
const C5 = 523.25;

export const SOUNDS: Record<SoundName, Sound> = {
  // bright rising two-note chime (A5 → E6): soft square with a triangle under it
  "gate-right": {
    tones: [
      ...ringLast(
        arp(
          {
            wave: "square",
            freq: A5,
            attack: 0.004,
            hold: 0.04,
            release: 0.12,
            volume: 0.1,
            lowpass: 3200,
          },
          [0, 7],
          0.075,
        ),
        0.26,
      ),
      ...ringLast(
        arp(
          {
            wave: "triangle",
            freq: A5,
            attack: 0.004,
            hold: 0.04,
            release: 0.12,
            volume: 0.14,
          },
          [0, 7],
          0.075,
        ),
        0.26,
      ),
    ],
  },
  // short low buzz: two slightly detuned squares sagging in pitch
  "gate-wrong": {
    tones: [
      {
        wave: "square",
        freq: 150,
        to: 110,
        attack: 0.005,
        hold: 0.1,
        release: 0.07,
        volume: 0.1,
        lowpass: 1400,
      },
      {
        wave: "square",
        freq: 156,
        to: 114,
        attack: 0.005,
        hold: 0.1,
        release: 0.07,
        volume: 0.07,
        lowpass: 1400,
      },
    ],
  },
  // a very short, quiet tick
  shot: {
    jitter: 0.05,
    tones: [
      {
        wave: "square",
        freq: 1600,
        to: 900,
        attack: 0.001,
        hold: 0.006,
        release: 0.018,
        volume: 0.025,
        lowpass: 5000,
      },
    ],
  },
  // noise crunch with a little thump under it
  "hazard-broken": {
    jitter: 0.04,
    tones: [
      {
        wave: "noise",
        freq: 4000,
        to: 500,
        attack: 0.002,
        hold: 0.03,
        release: 0.13,
        volume: 0.24,
      },
      {
        wave: "square",
        freq: 200,
        to: 60,
        attack: 0.002,
        hold: 0.02,
        release: 0.08,
        volume: 0.06,
        lowpass: 1200,
      },
    ],
  },
  // falling sweep
  "pack-wiped": {
    tones: [
      {
        wave: "square",
        freq: 1000,
        to: 160,
        attack: 0.005,
        hold: 0.12,
        release: 0.16,
        volume: 0.08,
        lowpass: 2800,
      },
      {
        wave: "triangle",
        freq: 1000,
        to: 160,
        attack: 0.005,
        hold: 0.12,
        release: 0.16,
        volume: 0.08,
      },
    ],
  },
  // low rumble for the clash (CLASH_SECONDS 2.5): a growling saw and dark noise
  "boss-clash": {
    tones: [
      {
        wave: "sawtooth",
        freq: 58,
        to: 44,
        attack: 0.15,
        hold: 1.95,
        release: 0.4,
        volume: 0.12,
        lowpass: 320,
      },
      {
        wave: "noise",
        freq: 360,
        to: 200,
        attack: 0.15,
        hold: 1.95,
        release: 0.4,
        volume: 0.35,
      },
    ],
  },
  // 4-note fanfare (C5 E5 G5 C6), the last held; a triangle an octave down
  "boss-won": {
    tones: [
      ...ringLast(
        arp(
          {
            wave: "square",
            freq: C5,
            attack: 0.005,
            hold: 0.08,
            release: 0.06,
            volume: 0.14,
            lowpass: 3600,
          },
          [0, 4, 7, 12],
          0.12,
        ),
        0.5,
      ),
      ...ringLast(
        arp(
          {
            wave: "triangle",
            freq: C5 / 2,
            attack: 0.005,
            hold: 0.08,
            release: 0.06,
            volume: 0.2,
          },
          [0, 4, 7, 12],
          0.12,
        ),
        0.5,
      ),
    ],
  },
  // descending sting (G4 E4 C#4 A3), the last sagging
  "boss-lost": {
    tones: [
      ...arp(
        {
          wave: "square",
          freq: 392,
          attack: 0.005,
          hold: 0.1,
          release: 0.06,
          volume: 0.065,
          lowpass: 2000,
        },
        [0, -3, -6],
        0.16,
      ),
      {
        wave: "square",
        freq: 220,
        to: 180,
        at: 0.48,
        attack: 0.005,
        hold: 0.2,
        release: 0.3,
        volume: 0.065,
        lowpass: 1600,
      },
      ...arp(
        {
          wave: "triangle",
          freq: 392,
          attack: 0.005,
          hold: 0.1,
          release: 0.06,
          volume: 0.1,
        },
        [0, -3, -6],
        0.16,
      ),
      {
        wave: "triangle",
        freq: 220,
        to: 180,
        at: 0.48,
        attack: 0.005,
        hold: 0.2,
        release: 0.3,
        volume: 0.1,
      },
    ],
  },
  // 5-note jingle up to the octave (C6 D6 E6 G6 C7)
  unlock: {
    tones: [
      ...ringLast(
        arp(
          {
            wave: "square",
            freq: 2 * C5,
            attack: 0.004,
            hold: 0.05,
            release: 0.05,
            volume: 0.07,
            lowpass: 3600,
          },
          [0, 2, 4, 7, 12],
          0.085,
        ),
        0.35,
      ),
      ...ringLast(
        arp(
          {
            wave: "triangle",
            freq: 2 * C5,
            attack: 0.004,
            hold: 0.05,
            release: 0.05,
            volume: 0.12,
          },
          [0, 2, 4, 7, 12],
          0.085,
        ),
        0.35,
      ),
    ],
  },
  // a tiny blip
  tap: {
    tones: [
      {
        wave: "triangle",
        freq: 1300,
        to: 1700,
        attack: 0.002,
        hold: 0.012,
        release: 0.03,
        volume: 0.1,
      },
    ],
  },
};

/** Seconds a sound lasts. */
export const soundLength = (s: Sound): number =>
  Math.max(...s.tones.map((t) => (t.at ?? 0) + t.attack + t.hold + t.release));

// one second of white noise per context, looped
const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>();
const noiseBuffer = (ctx: BaseAudioContext): AudioBuffer => {
  let b = noiseBuffers.get(ctx);
  if (!b) {
    b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noiseBuffers.set(ctx, b);
  }
  return b;
};

/** Schedules one tone at context time `when`, pitch scaled by `pitch`, into `out`. */
function playTone(
  ctx: BaseAudioContext,
  out: AudioNode,
  t: Tone,
  when: number,
  pitch: number,
): void {
  const start = when + (t.at ?? 0);
  const end = start + t.attack + t.hold + t.release;
  const freq = t.freq * pitch;
  const to = (t.to ?? t.freq) * pitch;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, start);
  env.gain.linearRampToValueAtTime(t.volume, start + t.attack);
  env.gain.setValueAtTime(t.volume, start + t.attack + t.hold);
  env.gain.linearRampToValueAtTime(0, end);
  env.connect(out);
  let src: AudioScheduledSourceNode;
  let into: AudioNode = env;
  if (t.wave === "noise") {
    const n = ctx.createBufferSource();
    n.buffer = noiseBuffer(ctx);
    n.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(freq, start);
    f.frequency.exponentialRampToValueAtTime(to, end);
    f.connect(env);
    n.connect(f);
    src = n;
  } else {
    if (t.lowpass) {
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = t.lowpass;
      f.Q.value = 0.5;
      f.connect(env);
      into = f;
    }
    const o = ctx.createOscillator();
    o.type = t.wave;
    o.frequency.setValueAtTime(freq, start);
    if (to !== freq) o.frequency.exponentialRampToValueAtTime(to, end);
    o.connect(into);
    src = o;
  }
  src.start(start);
  src.stop(end + 0.01);
}

/**
 * Schedules a sound at context time `when` (default now) into `out`, with
 * its random pitch spread. Works on an offline context too.
 */
export function playSound(
  ctx: BaseAudioContext,
  out: AudioNode,
  sound: Sound,
  when = ctx.currentTime,
  random: () => number = Math.random,
): void {
  const pitch = 1 + (sound.jitter ?? 0) * (random() * 2 - 1);
  for (const t of sound.tones) playTone(ctx, out, t, when, pitch);
}

/** Where sounds go: the engine's context and sfx bus, either null without audio. */
export type SfxOut = {
  context(): BaseAudioContext | null;
  bus(name: "sfx"): AudioNode | null;
};

/** Plays the named sounds now through the sfx bus, each at most once per call. Silent and safe without audio. */
export function createSfx(out: SfxOut): (names: readonly SoundName[]) => void {
  return (names) => {
    const ctx = out.context();
    const bus = out.bus("sfx");
    if (!ctx || !bus || ctx.state !== "running") return;
    try {
      for (const name of new Set(names)) playSound(ctx, bus, SOUNDS[name]);
    } catch {
      // audio failures are silent
    }
  };
}
