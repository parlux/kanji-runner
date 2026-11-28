import { describe, expect, it } from "vitest";
import { createSfx, playSound, soundLength, SOUNDS } from "../../src/audio/sfx";

/** The summed volume of a sound's first note (its tones starting at 0). */
const firstNote = (name: keyof typeof SOUNDS): number =>
  SOUNDS[name].tones
    .filter((t) => (t.at ?? 0) === 0)
    .reduce((a, t) => a + t.volume, 0);

describe("sound effects", () => {
  it("are short, except the clash's rumble", () => {
    for (const [name, s] of Object.entries(SOUNDS))
      expect(soundLength(s), name).toBeLessThanOrEqual(
        name === "boss-clash" ? 2.6 : 1.1,
      );
  });

  it("keep the shot far under the chime", () => {
    expect(firstNote("shot")).toBeLessThanOrEqual(
      0.15 * firstNote("gate-right"),
    );
  });

  it("schedules every tone, pitch spread by the jitter", () => {
    const freqs: number[] = [];
    let started = 0;
    const param = () => ({
      value: 0,
      setValueAtTime(v: number) {
        freqs.push(v);
      },
      linearRampToValueAtTime() {},
      exponentialRampToValueAtTime() {},
    });
    const node = () => ({
      connect() {},
      gain: param(),
      frequency: param(),
      Q: param(),
      start() {
        started++;
      },
      stop() {},
    });
    const ctx = {
      currentTime: 0,
      sampleRate: 8000,
      createGain: node,
      createOscillator: node,
      createBiquadFilter: node,
      createBufferSource: node,
      createBuffer: () => ({ getChannelData: () => new Float32Array(8000) }),
    } as unknown as BaseAudioContext;
    const out = node() as unknown as AudioNode;
    playSound(ctx, out, SOUNDS["boss-clash"]);
    expect(started).toBe(2);
    freqs.length = 0;
    playSound(ctx, out, SOUNDS.shot, 0, () => 1);
    expect(freqs).toContain(1600 * 1.05);
  });

  it("is silent without audio", () => {
    const play = createSfx({ context: () => null, bus: () => null });
    expect(() => play(["gate-right", "tap"])).not.toThrow();
  });
});
