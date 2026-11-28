import { speechDipDb } from "./duck";

/** The three buses, each a gain into the master. */
type Bus = "voice" | "sfx" | "music";

/** Each open bus's gain before the duck: music sits under the voice and effects. */
export const BUS_LEVEL: Record<Bus, number> = {
  voice: 1,
  sfx: 0.8,
  music: 0.5,
};
/** The sfx and music speech-range dip (peaking filter, see `speechDipDb`). */
const DIP_HZ = 2500;
const DIP_Q = 0.7;
/** Voice EQ for phone speakers: cut rumble they can't play, lift the consonants. */
const VOICE_LOWCUT_HZ = 120;
const VOICE_PRESENCE_HZ = 3000;
const VOICE_PRESENCE_DB = 4;

/** What the engine needs from the page; absent pieces mean no sound, never an error. */
export type EngineEnv = {
  AudioContext?: typeof AudioContext;
  navigator?: { audioSession?: { type: string } };
};

export type AudioEngine = {
  /**
   * Creates the AudioContext (once) and resumes it. Call from a user gesture:
   * iOS only starts audio there. Also asks Safari to play with the ringer
   * switch off. Safe to call again.
   */
  unlock(): void;
  /** The context, or null before the first unlock or where audio is missing. */
  context(): AudioContext | null;
  /** A bus's gain node (into the master), or null without a context. */
  bus(name: Bus): GainNode | null;
  /** Opens or closes a bus (its `BUS_LEVEL` or 0); kept for buses made later. */
  setOn(name: Bus, on: boolean): void;
  /** The duck's gain on the sfx and music buses (1 = none; see `duck.ts`). */
  setDuck(level: number): void;
  /** Suspends all sound while the page is hidden (tab switch, screen off); resumes when shown. */
  setHidden(hidden: boolean): void;
};

const BUSES: readonly Bus[] = ["voice", "sfx", "music"];

/** One AudioContext with voice, sfx and music buses into a master gain. */
export function createEngine(
  env: EngineEnv = globalThis as unknown as EngineEnv,
): AudioEngine {
  let ctx: AudioContext | null = null;
  let buses: Record<Bus, GainNode> | null = null;
  let failed = false;
  let hidden = false;
  const open: Record<Bus, boolean> = { voice: true, sfx: true, music: true };
  let duck = 1;
  let dips: BiquadFilterNode[] = [];
  const gainOf = (b: Bus): number =>
    !open[b] ? 0 : BUS_LEVEL[b] * (b === "voice" ? 1 : duck);
  // a switch is at once; the duck's steps are smoothed over ~10 ms
  const apply = (b: Bus, smooth: boolean): void => {
    const g = buses?.[b];
    if (!g || !ctx) return;
    g.gain.cancelScheduledValues(ctx.currentTime);
    if (smooth && open[b])
      g.gain.setTargetAtTime(gainOf(b), ctx.currentTime, 0.01);
    else g.gain.value = gainOf(b);
  };
  return {
    unlock() {
      try {
        // Safari: "playback" plays with the ringer switch off
        if (env.navigator?.audioSession)
          env.navigator.audioSession.type = "playback";
        if (!ctx && !failed && env.AudioContext) {
          ctx = new env.AudioContext();
          const c = ctx;
          // a soft limiter catches peaks the voice lift adds
          const master = c.createDynamicsCompressor();
          master.threshold.value = -3;
          master.knee.value = 3;
          master.ratio.value = 12;
          master.attack.value = 0.003;
          master.release.value = 0.15;
          master.connect(c.destination);
          const filter = (
            type: BiquadFilterType,
            hz: number,
            q: number,
            db = 0,
          ): BiquadFilterNode => {
            const f = c.createBiquadFilter();
            f.type = type;
            f.frequency.value = hz;
            f.Q.value = q;
            f.gain.value = db;
            return f;
          };
          const made = {} as Record<Bus, GainNode>;
          const madeDips: BiquadFilterNode[] = [];
          for (const b of BUSES) {
            const g = c.createGain();
            g.gain.value = gainOf(b);
            if (b === "voice") {
              const low = filter("highpass", VOICE_LOWCUT_HZ, 0.7);
              const lift = filter(
                "peaking",
                VOICE_PRESENCE_HZ,
                1,
                VOICE_PRESENCE_DB,
              );
              g.connect(low).connect(lift).connect(master);
            } else {
              const dip = filter("peaking", DIP_HZ, DIP_Q, speechDipDb(duck));
              g.connect(dip).connect(master);
              madeDips.push(dip);
            }
            made[b] = g;
          }
          buses = made;
          dips = madeDips;
        }
        if (ctx && !hidden && ctx.state !== "running")
          void ctx.resume().catch(() => {});
      } catch {
        failed = true;
        ctx = null;
        buses = null;
        dips = [];
      }
    },
    context: () => ctx,
    bus: (name) => buses?.[name] ?? null,
    setOn(name, on) {
      open[name] = on;
      try {
        apply(name, false);
      } catch {
        // audio failures are silent
      }
    },
    setHidden(h) {
      hidden = h;
      try {
        if (!ctx) return;
        if (h) void ctx.suspend().catch(() => {});
        else if (ctx.state !== "running") void ctx.resume().catch(() => {});
      } catch {
        // audio failures are silent
      }
    },
    setDuck(level) {
      if (level === duck) return;
      duck = level;
      try {
        apply("sfx", true);
        apply("music", true);
        if (ctx)
          for (const d of dips)
            d.gain.setTargetAtTime(speechDipDb(level), ctx.currentTime, 0.01);
      } catch {
        // audio failures are silent
      }
    },
  };
}

/** Calls `onChange(hidden)` when the page is hidden or shown (tab switch, screen off, app switch). */
export function onHiddenChange(
  doc: Pick<Document, "addEventListener" | "visibilityState">,
  onChange: (hidden: boolean) => void,
): void {
  doc.addEventListener("visibilitychange", () =>
    onChange(doc.visibilityState === "hidden"),
  );
}

/** Calls `unlock` on every tap and key press (cheap once running; iOS may suspend the context again). */
export function unlockOnGesture(
  target: Pick<EventTarget, "addEventListener">,
  unlock: () => void,
): void {
  for (const type of ["pointerdown", "touchend", "keydown"])
    target.addEventListener(type, unlock, { capture: true, passive: true });
}
