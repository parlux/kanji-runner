import { describe, expect, it } from "vitest";
import { BOSS_RATE, createMusic, moodFor } from "../../src/audio/music";

describe("moodFor", () => {
  it("is the calm loop everywhere but a run, lifted at the boss", () => {
    for (const k of ["start", "end", "progress"])
      expect(moodFor(k)).toEqual({ track: "menu", lift: false });
    expect(moodFor("run")).toEqual({ track: "run", lift: false });
    expect(moodFor("boss")).toEqual({ track: "run", lift: true });
  });
});

describe("music", () => {
  function stub() {
    const log: string[] = [];
    let now = 0;
    const ctx = {
      state: "running",
      get currentTime() {
        return now;
      },
      decodeAudioData: (b: ArrayBuffer) =>
        Promise.resolve({ tag: new TextDecoder().decode(b) }),
      createGain() {
        const id = `g${log.length}`;
        const gain = {
          value: 1,
          cancelScheduledValues() {},
          setValueAtTime() {},
          linearRampToValueAtTime: (v: number, t: number) =>
            log.push(`${id} ramp ${v} by ${t}`),
        };
        return { gain, connect: () => {} };
      },
      createBufferSource() {
        const s = {
          buffer: null as { tag: string } | null,
          loop: false,
          playbackRate: {
            setTargetAtTime: (v: number) => log.push(`rate ${v}`),
          },
          connect: () => {},
          start: () => log.push(`start ${s.buffer?.tag} loop=${s.loop}`),
          stop: (t: number) => log.push(`stop ${s.buffer?.tag} at ${t}`),
        };
        return s;
      },
    };
    let ready = false;
    const engine = {
      context: () => (ready ? (ctx as unknown as AudioContext) : null),
      bus: () => (ready ? ({} as GainNode) : null),
    };
    const fetch = (url: string) =>
      Promise.resolve({
        ok: true,
        arrayBuffer: () =>
          Promise.resolve(
            new TextEncoder().encode(url.split("/").pop()).buffer,
          ),
      });
    return {
      music: createMusic(engine, "/music/", fetch),
      log,
      unlock: () => (ready = true),
      at: (t: number) => (now = t),
    };
  }
  const flush = () => new Promise((r) => setTimeout(r, 0));

  it("waits for the context, then loops the menu track fading in", async () => {
    const s = stub();
    s.music.set(moodFor("start"));
    expect(s.log).toEqual([]);
    s.unlock();
    s.music.set(moodFor("start"));
    await flush();
    expect(s.log.filter((l) => l.startsWith("start"))).toEqual([
      "start menu.m4a loop=true",
    ]);
    expect(s.log.some((l) => l.endsWith("ramp 1 by 0.4"))).toBe(true);
  });

  it("crossfades to the run loop and lifts at the boss", async () => {
    const s = stub();
    s.unlock();
    s.music.set(moodFor("start"));
    await flush();
    s.at(10);
    s.log.length = 0;
    s.music.set(moodFor("run"));
    expect(s.log).toContain("start run.m4a loop=true");
    expect(s.log.some((l) => l.endsWith("ramp 0 by 10.4"))).toBe(true);
    expect(s.log.some((l) => /^stop menu.m4a at 10.45/.test(l))).toBe(true);
    s.music.set(moodFor("boss"));
    expect(s.log.at(-1)).toBe(`rate ${BOSS_RATE}`);
    s.music.set(moodFor("run"));
    expect(s.log.at(-1)).toBe("rate 1");
  });
});
