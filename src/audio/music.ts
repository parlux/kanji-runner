import type { AudioEngine } from "./engine";

/** The two loops under `public/music/`: `menu.m4a` and `run.m4a`. */
type Track = "menu" | "run";

/** What should play: a loop, and whether the boss lift is on. */
export type Mood = { track: Track; lift: boolean };

/** Seconds of crossfade between the loops (spec §9: 400 ms). */
const FADE_S = 0.4;
/** The run loop plays this much faster, and higher, at the boss. */
export const BOSS_RATE = 1.06;
/** Seconds the boss lift takes to ease in or out. */
const RATE_EASE_S = 0.25;

/** Calm loop on every screen but a run; the run loop in a run, lifted at the boss. */
export function moodFor(sceneKind: string): Mood {
  const running = sceneKind === "run" || sceneKind === "boss";
  return { track: running ? "run" : "menu", lift: sceneKind === "boss" };
}

export type Music = {
  /** Sets what should play; call every frame (cheap when nothing changed). Starts once the context exists and the loop is decoded. */
  set(mood: Mood): void;
};

type Playing = { src: AudioBufferSourceNode; gain: GainNode };
type Slot = {
  buf: AudioBuffer | null;
  loading: boolean;
  cur: Playing | null;
};

/** The music: one looped source per track on the music bus, crossfaded; absent audio means silence. */
export function createMusic(
  engine: Pick<AudioEngine, "context" | "bus">,
  base: string,
  fetcher: (url: string) => Promise<Pick<Response, "ok" | "arrayBuffer">> = (
    u,
  ) => fetch(u),
): Music {
  const slots: Record<Track, Slot> = {
    menu: { buf: null, loading: false, cur: null },
    run: { buf: null, loading: false, cur: null },
  };
  let want: Mood = { track: "menu", lift: false };
  const fade = (g: GainNode, ctx: AudioContext, to: number): void => {
    const now = ctx.currentTime;
    g.gain.cancelScheduledValues(now);
    g.gain.setValueAtTime(g.gain.value, now);
    g.gain.linearRampToValueAtTime(to, now + FADE_S);
  };
  const load = (t: Track, ctx: AudioContext): void => {
    const s = slots[t];
    if (s.loading || s.buf) return;
    s.loading = true;
    void fetcher(`${base}${t}.m4a`)
      .then((r) => (r.ok ? r.arrayBuffer() : null))
      .then((b) => (b ? ctx.decodeAudioData(b) : null))
      .then((buf) => {
        s.buf = buf;
        sync();
      })
      .catch(() => {});
  };
  const sync = (): void => {
    const ctx = engine.context();
    const bus = engine.bus("music");
    if (!ctx || !bus) return;
    try {
      for (const t of ["menu", "run"] as const) {
        const s = slots[t];
        load(t, ctx);
        if (t === want.track && !s.cur && s.buf) {
          const src = ctx.createBufferSource();
          src.buffer = s.buf;
          src.loop = true;
          const gain = ctx.createGain();
          gain.gain.value = 0;
          src.connect(gain);
          gain.connect(bus);
          src.start();
          fade(gain, ctx, 1);
          s.cur = { src, gain };
        } else if (t !== want.track && s.cur) {
          const { src, gain } = s.cur;
          s.cur = null;
          fade(gain, ctx, 0);
          src.stop(ctx.currentTime + FADE_S + 0.05);
        }
        if (t === "run" && s.cur) {
          s.cur.src.playbackRate.setTargetAtTime(
            want.lift ? BOSS_RATE : 1,
            ctx.currentTime,
            RATE_EASE_S / 3,
          );
        }
      }
    } catch {
      // audio failures are silent
    }
  };
  let last = "";
  return {
    set(mood) {
      const key = `${mood.track}${mood.lift}${engine.context()?.state}${slots.menu.cur ? 1 : 0}${slots.run.cur ? 1 : 0}`;
      want = mood;
      if (key === last) return;
      last = key;
      sync();
    },
  };
}
