import { afterEach, describe, expect, it, vi } from "vitest";
import { createDuck, voiceDuck } from "../../src/audio/duck";
import { createEngine } from "../../src/audio/engine";
import {
  createVoice,
  type ClipEnv,
  type SpeechEnv,
} from "../../src/audio/voice";

/** A stub `speechSynthesis` that logs what it is asked to do. */
function stubSpeech(voices: { lang: string; name: string }[]) {
  const log: string[] = [];
  const said: Utterance[] = [];
  class Utterance {
    lang = "";
    voice: { name: string } | null = null;
    onstart: (() => void) | null = null;
    onend: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(public text: string) {}
  }
  const env = {
    speechSynthesis: {
      speak: (u: Utterance) => {
        said.push(u);
        log.push(`speak ${u.text} ${u.lang} ${u.voice?.name ?? "-"}`);
      },
      cancel: () => log.push("cancel"),
      getVoices: () => voices,
    },
    SpeechSynthesisUtterance: Utterance,
  } as unknown as SpeechEnv;
  return { env, log, said };
}

describe("voice", () => {
  it("says the reading in Japanese with the first Japanese voice, cutting the previous line", () => {
    const { env, log } = stubSpeech([
      { lang: "en-US", name: "Alex" },
      { lang: "ja_JP", name: "Kyoko" },
      { lang: "ja-JP", name: "Otoya" },
    ]);
    const v = createVoice(env);
    v.say({ text: "毎年", reading: "まいとし" });
    v.say({ text: "にち", reading: "にち" });
    expect(log).toEqual([
      "cancel",
      "speak まいとし ja-JP Kyoko",
      "cancel",
      "speak にち ja-JP Kyoko",
    ]);
  });

  it("primes once on unlock (iOS needs a gesture)", () => {
    const { env, log } = stubSpeech([]);
    const v = createVoice(env);
    v.unlock();
    v.unlock();
    expect(log).toEqual(["cancel", "speak  ja-JP -"]);
  });

  it("says nothing and stops the line when disabled", () => {
    const { env, log } = stubSpeech([]);
    const v = createVoice(env);
    v.setEnabled(false);
    v.say({ text: "あ", reading: "あ" });
    expect(log).toEqual(["cancel"]);
    v.setEnabled(true);
    v.say({ text: "あ", reading: "あ" });
    expect(log).toEqual(["cancel", "cancel", "speak あ ja-JP -"]);
  });

  it("is silent and error-free without speech", () => {
    const v = createVoice({});
    expect(() => {
      v.unlock();
      v.prepare([{ text: "あ", reading: "あ" }]);
      v.say({ text: "あ", reading: "あ" });
      v.stop();
    }).not.toThrow();
  });
});

describe("voice timing", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("waits the given delay; a newer line or stop drops a pending one", () => {
    vi.useFakeTimers();
    const { env, log } = stubSpeech([]);
    const v = createVoice(env);
    v.say({ text: "あ", reading: "あ" }, 120);
    vi.advanceTimersByTime(119);
    expect(log).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(log).toEqual(["cancel", "speak あ ja-JP -"]);
    log.length = 0;
    v.say({ text: "い", reading: "い" }, 300);
    v.say({ text: "う", reading: "う" }, 120);
    vi.advanceTimersByTime(400);
    expect(log).toEqual(["cancel", "speak う ja-JP -"]);
    log.length = 0;
    v.say({ text: "え", reading: "え" }, 300);
    v.stop();
    vi.advanceTimersByTime(400);
    expect(log).toEqual(["cancel"]);
  });
});

describe("voice ducking", () => {
  it("ducks from a line's start event to its end event", () => {
    const { env, said } = stubSpeech([]);
    const duck = createDuck();
    const v = createVoice(
      env,
      voiceDuck(duck, () => 0),
    );
    v.say({ text: "あ", reading: "あ" });
    expect(duck.ducking(0)).toBe(false);
    said[0]?.onstart?.();
    expect(duck.ducking(0)).toBe(true);
    said[0]?.onend?.();
    expect(duck.ducking(0)).toBe(false);
  });

  it("a line cut by the next or by stop ends its duck, even without an end event", () => {
    const { env, said } = stubSpeech([]);
    const duck = createDuck();
    const v = createVoice(
      env,
      voiceDuck(duck, () => 0),
    );
    v.say({ text: "あ", reading: "あ" });
    said[0]?.onstart?.();
    v.say({ text: "い", reading: "い" });
    expect(duck.ducking(0)).toBe(false);
    said[1]?.onstart?.();
    // the cut line's late end event doesn't end the new line's duck
    said[0]?.onend?.();
    expect(duck.ducking(0)).toBe(true);
    v.stop();
    expect(duck.ducking(0)).toBe(false);
  });

  it("the silent unlock line doesn't duck", () => {
    const { env, said } = stubSpeech([]);
    const duck = createDuck();
    const v = createVoice(
      env,
      voiceDuck(duck, () => 0),
    );
    v.unlock();
    said[0]?.onstart?.();
    expect(duck.ducking(0)).toBe(false);
  });
});

describe("engine", () => {
  it("is silent and error-free without Web Audio", () => {
    const e = createEngine({});
    e.unlock();
    expect(e.context()).toBeNull();
    expect(e.bus("voice")).toBeNull();
  });

  it("sets the audio session to playback and builds three buses into the master", () => {
    const connects: string[] = [];
    let resumed = 0;
    let made = 0;
    const node = (name: string) => ({
      connect: (to: { name: string }) => connects.push(`${name}>${to.name}`),
      name,
      gain: { value: 1 },
    });
    let gains = 0;
    class Ctx {
      state = "suspended";
      destination = { name: "out" };
      constructor() {
        made++;
      }
      createGain() {
        return node(`g${gains++}`);
      }
      resume() {
        resumed++;
        return Promise.resolve();
      }
    }
    const navigator = { audioSession: { type: "auto" } };
    const e = createEngine({
      AudioContext: Ctx as unknown as typeof AudioContext,
      navigator,
    });
    e.unlock();
    e.unlock();
    expect(navigator.audioSession.type).toBe("playback");
    expect(made).toBe(1);
    expect(resumed).toBe(2);
    expect(connects).toEqual(["g0>out", "g1>g0", "g2>g0", "g3>g0"]);
    expect(e.bus("music")).not.toBeNull();
  });

  it("gives a closed bus gain 0, before and after the context exists", () => {
    class Ctx {
      state = "running";
      currentTime = 0;
      destination = {};
      createGain() {
        const gain = {
          value: 1,
          cancelScheduledValues() {},
          setTargetAtTime(v: number) {
            gain.value = v;
          },
        };
        return { connect: () => {}, gain };
      }
    }
    const e = createEngine({
      AudioContext: Ctx as unknown as typeof AudioContext,
    });
    e.setOn("sfx", false);
    e.unlock();
    expect(e.bus("sfx")?.gain.value).toBe(0);
    expect(e.bus("voice")?.gain.value).toBe(1);
    e.setOn("voice", false);
    e.setOn("sfx", true);
    expect(e.bus("voice")?.gain.value).toBe(0);
    expect(e.bus("sfx")?.gain.value).toBe(1);
    // the duck dips sfx and music, never the voice, and not a closed bus
    e.setOn("voice", true);
    e.setOn("music", false);
    e.setDuck(0.35);
    expect(e.bus("sfx")?.gain.value).toBe(0.35);
    expect(e.bus("voice")?.gain.value).toBe(1);
    expect(e.bus("music")?.gain.value).toBe(0);
    e.setOn("music", true);
    expect(e.bus("music")?.gain.value).toBe(0.35);
  });

  it("stays silent when the context cannot be made", () => {
    const Broken = function () {
      throw new Error("no audio");
    };
    const e = createEngine({
      AudioContext: Broken as unknown as typeof AudioContext,
    });
    expect(() => e.unlock()).not.toThrow();
    expect(e.context()).toBeNull();
  });
});

describe("voice clips", () => {
  /** A stub engine whose context decodes any bytes and logs what plays. */
  function stubClips(index: Record<string, [string, number]>) {
    const log: string[] = [];
    const sources: { onended: (() => void) | null }[] = [];
    const ctx = {
      decodeAudioData: (b: ArrayBuffer) =>
        Promise.resolve({ duration: 0.5, tag: new TextDecoder().decode(b) }),
      createBufferSource() {
        const s = {
          buffer: null as { tag: string } | null,
          onended: null as (() => void) | null,
          connect: () => {},
          start: () => log.push(`play ${s.buffer?.tag}`),
          stop: () => {
            log.push(`stop ${s.buffer?.tag}`);
            s.onended?.();
          },
        };
        sources.push(s);
        return s;
      },
    };
    let ready = false;
    const engine = {
      context: () => (ready ? (ctx as unknown as AudioContext) : null),
      bus: () => (ready ? ({} as GainNode) : null),
    };
    const fetch = (url: string) => {
      log.push(`fetch ${url}`);
      const file = url.split("/").pop() ?? "";
      const ok =
        file === "index.json" || Object.values(index).some(([f]) => f === file);
      return Promise.resolve({
        ok,
        json: () => Promise.resolve(index),
        arrayBuffer: () =>
          Promise.resolve(new TextEncoder().encode(file).buffer),
      });
    };
    const clips = { engine, base: "/voice/x/", fetch } as unknown as ClipEnv;
    return { clips, log, sources, unlock: () => (ready = true) };
  }
  const flush = () => new Promise((r) => setTimeout(r, 0));
  const nichi = { text: "にち", reading: "にち" };
  const mai = { text: "毎年", reading: "まいとし" };

  it("plays a prepared clip on the voice bus, and the phone voice for a key without one", async () => {
    const speech = stubSpeech([]);
    const c = stubClips({ "にち|にち": ["a1.m4a", 400] });
    c.unlock();
    const v = createVoice(speech.env, null, c.clips);
    v.prepare([nichi, mai]);
    await flush();
    v.say(nichi);
    v.say(mai);
    expect(c.log).toEqual([
      "fetch /voice/x/index.json",
      "fetch /voice/x/a1.m4a",
      "play a1.m4a",
      "stop a1.m4a",
    ]);
    expect(speech.log).toEqual(["cancel", "cancel", "speak まいとし ja-JP -"]);
  });

  it("falls back to the phone voice until the clip is decoded, then plays it", async () => {
    const speech = stubSpeech([]);
    const c = stubClips({ "にち|にち": ["a1.m4a", 400] });
    const v = createVoice(speech.env, null, c.clips);
    // the run was built before the AudioContext existed
    v.prepare([nichi]);
    v.say(nichi);
    expect(speech.log).toEqual(["cancel", "speak にち ja-JP -"]);
    c.unlock();
    v.unlock();
    await flush();
    v.say(nichi);
    expect(c.log.at(-1)).toBe("play a1.m4a");
  });

  it("ducks while a clip plays and stops ducking when it is cut", async () => {
    const speech = stubSpeech([]);
    const c = stubClips({ "にち|にち": ["a1.m4a", 400] });
    c.unlock();
    const duck = createDuck();
    const v = createVoice(
      speech.env,
      voiceDuck(duck, () => 0),
      c.clips,
    );
    v.prepare([nichi]);
    await flush();
    v.say(nichi);
    expect(duck.ducking(0)).toBe(true);
    v.stop();
    expect(duck.ducking(0)).toBe(false);
    v.say(nichi);
    c.sources.at(-1)?.onended?.();
    expect(duck.ducking(0)).toBe(false);
  });

  it("falls back to the phone voice when the index or clip fails to load", async () => {
    const speech = stubSpeech([]);
    const engine = {
      context: () => ({}) as AudioContext,
      bus: () => ({}) as GainNode,
    };
    const v = createVoice(speech.env, null, {
      engine,
      base: "/v/",
      fetch: () => Promise.reject(new Error("offline")),
    });
    v.prepare([nichi]);
    await flush();
    v.say(nichi);
    expect(speech.log).toEqual(["cancel", "speak にち ja-JP -"]);
  });
});
