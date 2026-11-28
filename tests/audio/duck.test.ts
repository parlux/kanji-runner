import { describe, expect, it } from "vitest";
import {
  createDuck,
  DUCK_ATTACK_MS,
  DUCK_LEVEL,
  DUCK_MAX_LINE_MS,
  DUCK_RELEASE_MS,
  duckStep,
  SPEECH_DIP_DB,
  speechDipDb,
  voiceDuck,
} from "../../src/audio/duck";

/** Samples the duck's level every `dt` ms from `from` to `to`. */
const levels = (
  duck: ReturnType<typeof createDuck>,
  from: number,
  to: number,
  dt = 10,
): number[] => {
  const out: number[] = [];
  for (let t = from; t <= to; t += dt) out.push(duck.level(t));
  return out;
};

describe("duckStep", () => {
  it("drops to DUCK_LEVEL over the attack and comes back over the release", () => {
    expect(duckStep(1, true, DUCK_ATTACK_MS / 2)).toBeCloseTo(
      1 - (1 - DUCK_LEVEL) / 2,
    );
    expect(duckStep(1, true, DUCK_ATTACK_MS)).toBeCloseTo(DUCK_LEVEL);
    expect(duckStep(1, true, 10 * DUCK_ATTACK_MS)).toBe(DUCK_LEVEL);
    expect(duckStep(DUCK_LEVEL, false, DUCK_RELEASE_MS / 2)).toBeCloseTo(
      DUCK_LEVEL + (1 - DUCK_LEVEL) / 2,
    );
    expect(duckStep(DUCK_LEVEL, false, 10 * DUCK_RELEASE_MS)).toBe(1);
  });
});

describe("duck", () => {
  it("goes through attack, hold and release for one line", () => {
    const duck = createDuck();
    expect(duck.level(0)).toBe(1);
    const close = duck.open(0);
    expect(duck.level(30)).toBeCloseTo(1 - (1 - DUCK_LEVEL) / 2);
    expect(duck.level(60)).toBeCloseTo(DUCK_LEVEL);
    // hold: stays down for as long as the line plays
    expect(levels(duck, 70, 1000).every((l) => l === DUCK_LEVEL)).toBe(true);
    close();
    expect(duck.ducking(1000)).toBe(false);
    expect(duck.level(1125)).toBeCloseTo(DUCK_LEVEL + (1 - DUCK_LEVEL) / 2);
    expect(duck.level(1250)).toBeCloseTo(1);
    expect(duck.level(2000)).toBe(1);
  });

  it("rises without dips: the level only falls while ducking and only rises after", () => {
    const duck = createDuck();
    duck.level(0);
    duck.holdFor(0, 400);
    const down = levels(duck, 0, 390);
    const up = levels(duck, 400, 800);
    expect(down.every((l, i) => i === 0 || l <= (down[i - 1] ?? 1))).toBe(true);
    expect(up.every((l, i) => i === 0 || l >= (up[i - 1] ?? 0))).toBe(true);
    expect(up.at(-1)).toBe(1);
  });

  it("holds a clip for its own length", () => {
    const duck = createDuck();
    duck.holdFor(100, 500);
    expect(duck.ducking(100)).toBe(true);
    expect(duck.ducking(599)).toBe(true);
    expect(duck.ducking(600)).toBe(false);
  });

  it("overlapping lines extend the hold", () => {
    const duck = createDuck();
    const a = duck.open(0);
    duck.holdFor(200, 600); // to 800
    const b = duck.open(300);
    a();
    expect(duck.ducking(500)).toBe(true);
    b();
    expect(duck.ducking(700)).toBe(true); // still the clip's hold
    expect(duck.ducking(800)).toBe(false);
    // a shorter hold inside a longer one doesn't cut it
    duck.holdFor(1000, 500);
    duck.holdFor(1100, 100);
    expect(duck.ducking(1400)).toBe(true);
    expect(duck.ducking(1500)).toBe(false);
  });

  it("closing twice is fine, and a line never closed lets go after DUCK_MAX_LINE_MS", () => {
    const duck = createDuck();
    const a = duck.open(0);
    a();
    a();
    expect(duck.ducking(10)).toBe(false);
    duck.open(1000);
    expect(duck.ducking(1000 + DUCK_MAX_LINE_MS - 1)).toBe(true);
    expect(duck.ducking(1000 + DUCK_MAX_LINE_MS)).toBe(false);
  });

  it("voiceDuck reads the page's clock", () => {
    const duck = createDuck();
    let now = 50;
    const v = voiceDuck(duck, () => now);
    v.holdFor(100);
    now = 149;
    expect(duck.ducking(now)).toBe(true);
    const close = v.open();
    now = 5000;
    expect(duck.ducking(now)).toBe(true);
    close();
    expect(duck.ducking(now)).toBe(false);
  });
});

describe("speechDipDb", () => {
  it("is 0 with no duck and SPEECH_DIP_DB at full duck, linear between", () => {
    expect(speechDipDb(1)).toBe(0);
    expect(speechDipDb(DUCK_LEVEL)).toBeCloseTo(SPEECH_DIP_DB);
    expect(speechDipDb((1 + DUCK_LEVEL) / 2)).toBeCloseTo(SPEECH_DIP_DB / 2);
    expect(speechDipDb(0)).toBeCloseTo(SPEECH_DIP_DB);
  });
});
