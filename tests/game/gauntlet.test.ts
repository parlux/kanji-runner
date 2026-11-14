import { describe, expect, it } from "vitest";
import { packAwake } from "../../src/core/sim";
import { HORDE_DEFAULTS, PACK_ADAPT } from "../../src/core/tuning";
import {
  AFTER_SECONDS,
  countFrame,
  INTRO_SECONDS,
  measureStep,
  rateWave,
  startGauntlet,
  stepGauntlet,
  waveLog,
  waveRun,
  type Gauntlet,
} from "../../src/game/sandbox/gauntlet";
import { sandboxParam } from "../../src/game/sandbox/param";
import {
  GAUNTLET,
  presetErrors,
  type WavePreset,
} from "../../src/game/sandbox/presets";

const DT = 1 / 60;
const BASE = GAUNTLET[0] as WavePreset;

/** Plays the current wave to its rating card (or gives up after `max` seconds). */
function playWave(g: Gauntlet, max = 60): Gauntlet {
  let n = 0;
  while (g.phase !== "rate" && g.phase !== "done" && n++ < max / DT)
    g = countFrame(stepGauntlet(g, DT), DT);
  return g;
}

describe("gauntlet presets", () => {
  it("the shipped list is valid and 8–10 waves long", () => {
    expect(presetErrors(GAUNTLET)).toEqual([]);
    expect(GAUNTLET.length).toBeGreaterThanOrEqual(8);
    expect(GAUNTLET.length).toBeLessThanOrEqual(10);
  });

  it("starts at today's defaults and changes one thing at a time from them", () => {
    expect(BASE).toMatchObject({
      enemies: HORDE_DEFAULTS.packMax,
      killSeconds: HORDE_DEFAULTS.killSeconds,
      packWidth: HORDE_DEFAULTS.packWidth,
      hordeScale: HORDE_DEFAULTS.hordeScale,
      packAdapt: PACK_ADAPT,
    });
    expect(BASE.army).toBe(BASE.expected);
    const keys = [
      "enemies",
      "killSeconds",
      "packWidth",
      "hordeScale",
      "army",
    ] as const;
    for (const p of GAUNTLET) {
      const changed = keys.filter((k) => p[k] !== BASE[k]);
      const adapt = p.packAdapt !== BASE.packAdapt;
      // army size moves with its pack (expected) or alone (a strong army), adapt only with a strong army
      expect(changed.length + (adapt ? 1 : 0)).toBeLessThanOrEqual(
        adapt ? 2 : 1,
      );
      if (adapt) expect(p.army).toBeGreaterThan(p.expected);
      if (changed.length === 0)
        expect(p).toEqual({ ...BASE, x: p.x, note: p.note });
    }
  });

  it("sweeps kill time, enemy count and army size, and has a strong army", () => {
    const kill = new Set(GAUNTLET.map((p) => p.killSeconds));
    const enemies = new Set(GAUNTLET.map((p) => p.enemies));
    const army = new Set(GAUNTLET.map((p) => p.army));
    expect(kill.size).toBeGreaterThanOrEqual(3);
    expect(enemies.size).toBeGreaterThanOrEqual(3);
    expect(army.size).toBeGreaterThanOrEqual(3);
    expect(GAUNTLET.some((p) => p.army >= 4 * p.expected)).toBe(true);
  });

  it("flags bad presets", () => {
    expect(presetErrors([])).toEqual(["no waves"]);
    expect(
      presetErrors([{ ...BASE, army: 0, packWidth: 1.5, packAdapt: -1 }]),
    ).toEqual(["wave 1: army", "wave 1: packWidth", "wave 1: packAdapt"]);
  });
});

describe("waveRun", () => {
  it("builds one waiting pack, no walls, the army at the preset size", () => {
    const run = waveRun(BASE);
    expect(run.rows).toEqual([]);
    expect(run.track.hazards).toHaveLength(1);
    expect(run.army).toBe(BASE.army);
    expect(run.heads[0]).toBe(BASE.enemies);
    expect(run.hp[0]).toBeCloseTo(BASE.killSeconds * BASE.expected);
    expect(run.woke[0]).toBe(false);
    // in view, not yet charging (the label shows over a waiting crowd)
    expect(packAwake(run, 0)).toBe(true);
  });

  it("a strong army makes the pack adapt by the preset's PACK_ADAPT on waking", () => {
    const p = { ...BASE, army: 300, packAdapt: 0.5 };
    const g = stepGauntlet({ ...startGauntlet([p]), phase: "play" }, DT);
    const eff = Math.sqrt(p.expected * p.army);
    expect(g.run.woke[0]).toBe(true);
    expect(g.run.hp[0]).toBeCloseTo(p.killSeconds * eff);
  });
});

describe("gauntlet sequencing", () => {
  const two = [BASE, { ...BASE, killSeconds: 1.5 }];

  it("shows the label, plays, waits for a rating, then the next wave, then done", () => {
    let g = startGauntlet(two);
    expect(g.phase).toBe("intro");
    const army = g.run.army;
    // the label holds the run still
    for (let i = 0; i < INTRO_SECONDS / DT - 2; i++) g = stepGauntlet(g, DT);
    expect(g.phase).toBe("intro");
    expect(g.run.army).toBe(army);
    g = playWave(g);
    expect(g.phase).toBe("rate");
    expect(g.log).toHaveLength(1);
    expect(g.log[0]?.rating).toBeNull();
    // nothing moves while the card is up
    expect(stepGauntlet(g, DT)).toBe(g);
    g = rateWave(g, "right");
    expect(g.phase).toBe("intro");
    expect(g.index).toBe(1);
    expect(g.log[0]?.rating).toBe("right");
    g = rateWave(playWave(g), "fast");
    expect(g.phase).toBe("done");
    expect(g.log.map((w) => [w.wave, w.rating])).toEqual([
      [1, "right"],
      [2, "fast"],
    ]);
  });

  it("rating outside the card does nothing", () => {
    const g = startGauntlet(two);
    expect(rateWave(g, "slow")).toBe(g);
  });
});

describe("measurement", () => {
  it("kill time at the expected army is about the preset's kill time", () => {
    const g = playWave(startGauntlet([BASE]));
    const w = g.log[0];
    expect(w?.killSeconds).not.toBeNull();
    // fire reaches the stream as it starts; contact eats a little of the pack
    expect(w?.killSeconds ?? 0).toBeGreaterThan(BASE.killSeconds * 0.7);
    expect(w?.killSeconds ?? 0).toBeLessThan(BASE.killSeconds * 1.2);
    expect(w?.enemies).toBe(BASE.enemies);
    expect(w?.fps).toBe(60);
    expect(w?.died).toBe(false);
  });

  it("a slower kill takes longer; soldiers lost is never negative and matches the army's drop", () => {
    for (const p of GAUNTLET) {
      const g = playWave(startGauntlet([p]));
      const w = g.log[0];
      expect(w, p.note).toBeDefined();
      expect(w?.lost ?? -1).toBeGreaterThanOrEqual(0);
      expect(w?.lost).toBe(p.army - g.run.army);
    }
    const fast = playWave(startGauntlet([{ ...BASE, killSeconds: 1.5 }]));
    const slow = playWave(startGauntlet([{ ...BASE, killSeconds: 3.5 }]));
    expect(slow.log[0]?.killSeconds ?? 0).toBeGreaterThan(
      fast.log[0]?.killSeconds ?? 0,
    );
  });

  it("a pack that all reaches you has no kill time", () => {
    // a lone soldier against a pack sized for 60: it streams in
    const p = { ...BASE, army: 1, expected: 60 };
    const g = playWave(startGauntlet([p]));
    expect(g.log[0]?.killSeconds).toBeNull();
    expect(g.log[0]?.died).toBe(true);
  });

  it("measureStep: first hit, gone, and losses only count drops", () => {
    const run = waveRun(BASE);
    const m0 = {
      t: 0,
      firstHit: null,
      gone: null,
      lost: 0,
      frames: 0,
      frameSeconds: 0,
    };
    const hit = { ...run, target: 0, army: run.army - 2 };
    const m1 = measureStep(m0, run, hit, 0.5);
    expect(m1).toMatchObject({ t: 0.5, firstHit: 0.5, gone: null, lost: 2 });
    const grew = {
      ...hit,
      army: hit.army + 5,
      nextHazard: 1,
      damage: [...hit.hp],
    };
    const m2 = measureStep(m1, hit, grew, 0.5);
    expect(m2).toMatchObject({ firstHit: 0.5, gone: 1, lost: 2 });
    const log = waveLog(1, BASE, m2, grew);
    expect(log.killSeconds).toBe(0.5);
  });

  it("the wave ends AFTER_SECONDS after the pack is gone", () => {
    const g = playWave(startGauntlet([BASE]));
    expect(g.measure.gone).not.toBeNull();
    expect(g.measure.t - (g.measure.gone ?? 0)).toBeGreaterThanOrEqual(
      AFTER_SECONDS - 1e-9,
    );
    expect(g.measure.t - (g.measure.gone ?? 0)).toBeLessThan(
      AFTER_SECONDS + 2 * DT,
    );
  });
});

describe("sandboxParam", () => {
  it("is horde only for ?sandbox=horde", () => {
    expect(sandboxParam("?sandbox=horde")).toBe("horde");
    expect(sandboxParam("?fps&sandbox=horde")).toBe("horde");
    expect(sandboxParam("")).toBeNull();
    expect(sandboxParam("?sandbox=x")).toBeNull();
  });
});
