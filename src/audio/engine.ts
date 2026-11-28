/** The three buses, each a gain into the master. */
type Bus = "voice" | "sfx" | "music";

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
  /** Opens or closes a bus (gain 1 or 0); kept for buses made later. */
  setOn(name: Bus, on: boolean): void;
  /** The duck's gain on the sfx and music buses (1 = none; see `duck.ts`). */
  setDuck(level: number): void;
};

const BUSES: readonly Bus[] = ["voice", "sfx", "music"];

/** One AudioContext with voice, sfx and music buses into a master gain. */
export function createEngine(
  env: EngineEnv = globalThis as unknown as EngineEnv,
): AudioEngine {
  let ctx: AudioContext | null = null;
  let buses: Record<Bus, GainNode> | null = null;
  let failed = false;
  const open: Record<Bus, boolean> = { voice: true, sfx: true, music: true };
  let duck = 1;
  const gainOf = (b: Bus): number => (!open[b] ? 0 : b === "voice" ? 1 : duck);
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
          const master = ctx.createGain();
          master.connect(ctx.destination);
          const made = {} as Record<Bus, GainNode>;
          for (const b of BUSES) {
            const g = ctx.createGain();
            g.gain.value = gainOf(b);
            g.connect(master);
            made[b] = g;
          }
          buses = made;
        }
        if (ctx && ctx.state !== "running") void ctx.resume().catch(() => {});
      } catch {
        failed = true;
        ctx = null;
        buses = null;
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
    setDuck(level) {
      if (level === duck) return;
      duck = level;
      try {
        apply("sfx", true);
        apply("music", true);
      } catch {
        // audio failures are silent
      }
    },
  };
}

/** Calls `unlock` on every tap and key press (cheap once running; iOS may suspend the context again). */
export function unlockOnGesture(
  target: Pick<EventTarget, "addEventListener">,
  unlock: () => void,
): void {
  for (const type of ["pointerdown", "touchend", "keydown"])
    target.addEventListener(type, unlock, { capture: true, passive: true });
}
