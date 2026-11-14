import { describe, expect, it } from "vitest";
import { packAwake } from "../../src/core/sim";
import {
  CHEER_SECONDS,
  HORDE_DEFAULTS,
  PACK_ADAPT,
  STEER_MAX_SPEED,
} from "../../src/core/tuning";
import {
  AFTER_SECONDS,
  cheerOf,
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
  it("the shipped list is valid and 6–10 waves long", () => {
    expect(presetErrors(GAUNTLET)).toEqual([]);
    expect(GAUNTLET.length).toBeGreaterThanOrEqual(6);
    expect(GAUNTLET.length).toBeLessThanOrEqual(10);
  });

  it("starts at today's defaults; every wave keeps the pack's settings and changes only the army or how close it wakes", () => {
    expect(BASE).toMatchObject({
      enemies: HORDE_DEFAULTS.packMax,
      killSeconds: HORDE_DEFAULTS.killSeconds,
      packWidth: HORDE_DEFAULTS.packWidth,
      hordeScale: HORDE_DEFAULTS.hordeScale,
      packAdapt: PACK_ADAPT,
    });
    expect(BASE.army).toBe(BASE.expected);
    expect(BASE.ahead).toBeUndefined();
    for (const p of GAUNTLET)
      expect({ ...p, army: BASE.army, ahead: undefined, x: 0.5 }).toEqual({
        ...BASE,
        note: p.note,
        hint: p.hint,
      });
  });

  it("round 3: baseline, a dodge (sidestep), a weave, woken close, a strong army, a weak army's melee, an outmatched one (they cheer); each labelled, with a hint", () => {
    expect(GAUNTLET.length).toBe(7);
    expect(new Set(GAUNTLET.map((p) => p.note)).size).toBe(GAUNTLET.length);
    for (const p of GAUNTLET) expect(p.hint ?? "").not.toBe("");
    const find = (word: string): number =>
      GAUNTLET.findIndex((p) => p.note.startsWith(word));
    for (const w of [
      "baseline",
      "dodge",
      "weave",
      "woken close",
      "strong army",
      "weak army",
      "outmatched",
    ])
      expect(find(w), w).toBeGreaterThanOrEqual(0);
    expect(GAUNTLET[find("woken close")]?.ahead).toBeDefined();
    const played = GAUNTLET.map((p) => playWave(startGauntlet([p])).log[0]);
    // the strong army: the same pace as the baseline (full adapt)
    const base = played[0]?.killSeconds ?? 0;
    expect(base).toBeGreaterThan(3);
    expect(played[find("strong army")]?.killSeconds ?? 0).toBeCloseTo(base, 1);
    // held, the weak armies are reached and lose soldiers; only the outmatched one dies
    const weak = GAUNTLET.map((p, i) => ({ p, w: played[i] })).filter(
      ({ p }) => p.army < p.expected,
    );
    expect(weak.length).toBe(4);
    for (const { w } of weak) expect(w?.reached ?? 0).toBeGreaterThan(50);
    expect(weak.filter(({ w }) => w?.died).length).toBe(1);
    expect(played[find("outmatched")]?.died).toBe(true);
    expect(weak.filter(({ w }) => !w?.died && (w?.lost ?? 0) > 0).length).toBe(
      3,
    );
  });

  it("the dodge wave: a full-speed sidestep as they come close makes most of the stream miss, and costs nothing; a weave too", () => {
    const dodge = GAUNTLET.find((p) => p.note.startsWith("dodge"));
    if (!dodge) throw new Error("no dodge wave");
    const play = (steer: (g: Gauntlet) => number) => {
      let g = startGauntlet([dodge]);
      while (g.phase !== "rate") g = stepGauntlet(g, DT, steer(g));
      return g;
    };
    const held = play(() => 0);
    // as the head comes within half a second, steer right at full speed
    const side = play((g) =>
      (g.run.packs[0]?.pos ?? 0) - g.run.dist < 1.1 && g.run.targetX < 0.85
        ? STEER_MAX_SPEED * DT
        : 0,
    );
    const weave = play(
      (g) =>
        STEER_MAX_SPEED *
        DT *
        Math.sign(Math.sin((2 * Math.PI * g.measure.t) / 1.6)),
    );
    expect(held.log[0]?.lost ?? 0).toBeGreaterThan(0);
    expect(held.run.missed[0] ?? 0).toBeLessThan(1);
    for (const g of [side, weave]) {
      expect(g.log[0]?.lost).toBe(0);
      expect(g.run.missed[0] ?? 0).toBeGreaterThan(50);
      expect(g.log[0]?.reached ?? 0).toBeLessThan(held.log[0]?.reached ?? 0);
    }
  });

  it("flags bad presets", () => {
    expect(presetErrors([])).toEqual(["no waves"]);
    expect(
      presetErrors([
        { ...BASE, army: 0, packWidth: 1.5, packAdapt: -1, ahead: 0 },
      ]),
    ).toEqual([
      "wave 1: army",
      "wave 1: packWidth",
      "wave 1: packAdapt",
      "wave 1: ahead",
    ]);
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

  it("shows the label, plays, waits for the card, then the next wave, then done", () => {
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
    expect(g.log[0]?.answers).toBeNull();
    // nothing moves while the card is up
    expect(stepGauntlet(g, DT)).toBe(g);
    g = rateWave(g, { pace: "right", melee: "fair" }, "  felt good \n");
    expect(g.phase).toBe("intro");
    expect(g.index).toBe(1);
    expect(g.log[0]?.answers).toEqual({ pace: "right", melee: "fair" });
    expect(g.log[0]?.note).toBe("felt good");
    // all blank is fine
    g = rateWave(playWave(g), {});
    expect(g.phase).toBe("done");
    expect(g.log.map((w) => [w.wave, w.answers, w.note])).toEqual([
      [1, { pace: "right", melee: "fair" }, "felt good"],
      [2, {}, ""],
    ]);
  });

  it("answering outside the card does nothing", () => {
    const g = startGauntlet(two);
    expect(rateWave(g, { pace: "slow" })).toBe(g);
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

  it("an army wiped out in a melee: the enemies cheer CHEER_SECONDS (cheerOf counts it), then the card; nobody cheers otherwise", () => {
    let g = startGauntlet([{ ...BASE, army: 8, note: "outmatched" }]);
    let cheered = 0;
    let last = -1;
    while (g.phase !== "rate") {
      g = stepGauntlet(g, DT);
      const c = cheerOf(g);
      if (c >= 0) {
        expect(c).toBeGreaterThanOrEqual(last);
        cheered++;
        last = c;
      }
    }
    expect(g.log[0]?.died).toBe(true);
    expect(cheered * DT).toBeGreaterThanOrEqual(CHEER_SECONDS - 2 * DT);
    expect(g.measure.t - (g.measure.gone ?? 0)).toBeLessThan(
      CHEER_SECONDS + 2 * DT,
    );
    // a wave the army wins: no cheering
    let w = startGauntlet([BASE]);
    while (w.phase !== "rate") {
      w = stepGauntlet(w, DT);
      expect(cheerOf(w)).toBe(-1);
    }
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
