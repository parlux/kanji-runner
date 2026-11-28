import { describe, expect, it } from "vitest";
import { createEngine } from "../../src/audio/engine";
import { createVoice, type SpeechEnv } from "../../src/audio/voice";

/** A stub `speechSynthesis` that logs what it is asked to do. */
function stubSpeech(voices: { lang: string; name: string }[]) {
  const log: string[] = [];
  class Utterance {
    lang = "";
    voice: { name: string } | null = null;
    constructor(public text: string) {}
  }
  const env = {
    speechSynthesis: {
      speak: (u: Utterance) =>
        log.push(`speak ${u.text} ${u.lang} ${u.voice?.name ?? "-"}`),
      cancel: () => log.push("cancel"),
      getVoices: () => voices,
    },
    SpeechSynthesisUtterance: Utterance,
  } as unknown as SpeechEnv;
  return { env, log };
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
