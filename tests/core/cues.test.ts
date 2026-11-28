import { describe, expect, it } from "vitest";
import { bossCues, cues, limitShots, type Cue } from "../../src/core/cues";
import { stepRun } from "../../src/core/sim";
import {
  CLASH_APPROACH_SECONDS,
  CLASH_SECONDS,
  SHOT_CUE_MS,
  WALL_SHOT_CUE_MS,
} from "../../src/core/tuning";
import { DT, fresh } from "./sim-helpers";

const kinds = (l: readonly Cue[]) => l.map((c) => c.kind);

describe("cues from run states", () => {
  it("a step with nothing happening gives none", () => {
    const s = { ...fresh(1), gateTarget: null, targets: [] };
    expect(cues(s, { ...s, dist: s.dist + 0.01 })).toEqual([]);
  });

  it("gives right and wrong gates with the row", () => {
    const s = fresh(1, true);
    expect(cues(s, { ...s, results: [true] })).toEqual([
      { kind: "gate-right", row: 0 },
    ]);
    const a = { ...s, results: [true, false] };
    expect(cues(s, a)).toEqual([
      { kind: "gate-right", row: 0 },
      { kind: "gate-wrong", row: 1 },
    ]);
  });

  it("a hazard breaking is a block, a pack wiped is a pack", () => {
    const s = fresh(1, true);
    const bi = s.track.hazards.findIndex((h) => h.kind === "block");
    const pi = s.track.hazards.findIndex((h) => h.kind === "pack");
    const hit = (i: number) => {
      const hp = s.hp.map((v, j) => (j === i ? 10 : v));
      const damage = s.damage.map((v, j) => (j === i ? 10 : v));
      return { ...s, hp, damage };
    };
    const start = {
      ...s,
      hp: s.hp.map((v, j) => (j === bi || j === pi ? 10 : v)),
    };
    if (bi >= 0) expect(kinds(cues(start, hit(bi)))).toContain("hazard-broken");
    if (pi >= 0) expect(kinds(cues(start, hit(pi)))).toContain("pack-wiped");
    // already broken: no new cue
    if (bi >= 0) expect(cues(hit(bi), hit(bi))).toEqual([]);
  });

  it("fire gives shots", () => {
    const s = fresh(1);
    expect(cues(s, { ...s, gateTarget: 0 })).toEqual([
      { kind: "shot", wall: true },
    ]);
    expect(
      kinds(cues(s, { ...s, targets: [{ index: 0, share: 1 }] as never })),
    ).toEqual(["shot"]);
    expect(
      cues(s, {
        ...s,
        gateTarget: 0,
        targets: [{ index: 0, share: 1 }] as never,
      }),
    ).toEqual([{ kind: "shot" }]);
  });

  it("a whole run gives exactly one gate cue per row", () => {
    for (const seed of [1, 2, 3]) {
      let s = fresh(seed, true);
      const gates: number[] = [];
      for (let i = 0; s.status === "running" && i < 60 * 600; i++) {
        const next = stepRun(
          { ...s, targetX: 0.5 + 0.4 * Math.sin(i / 40) },
          DT,
        );
        for (const c of cues(s, next))
          if (c.kind === "gate-right" || c.kind === "gate-wrong")
            gates.push(c.row);
        s = next;
      }
      expect(gates).toEqual(s.rows.map((_, i) => i).slice(0, gates.length));
      expect(gates.length).toBe(s.results.length);
    }
  });
});

describe("limitShots", () => {
  it("lets one shot per SHOT_CUE_MS through and keeps other cues", () => {
    const shot: Cue = { kind: "shot" };
    let wait = 0;
    let passed = 0;
    for (let i = 0; i < 60; i++) {
      const r = limitShots([shot, { kind: "hazard-broken" }], 1000 / 60, wait);
      wait = r.wait;
      passed += r.cues.filter((c) => c.kind === "shot").length;
      expect(kinds(r.cues)).toContain("hazard-broken");
    }
    expect(passed).toBeGreaterThanOrEqual(
      Math.floor(1000 / (SHOT_CUE_MS + 17)),
    );
    expect(passed).toBeLessThanOrEqual(Math.ceil(1000 / SHOT_CUE_MS));
  });
});

describe("limitShots on a gate wall", () => {
  it("lets one wall shot per WALL_SHOT_CUE_MS through", () => {
    const shot: Cue = { kind: "shot", wall: true };
    let wait = 0;
    let passed = 0;
    for (let i = 0; i < 120; i++) {
      const r = limitShots([shot], 1000 / 60, wait);
      wait = r.wait;
      passed += r.cues.length;
    }
    expect(passed).toBeGreaterThanOrEqual(
      Math.floor(2000 / (WALL_SHOT_CUE_MS + 17)),
    );
    expect(passed).toBeLessThanOrEqual(Math.ceil(2000 / WALL_SHOT_CUE_MS));
  });
});

describe("bossCues", () => {
  const f = (t: number, army: number, boss: number) => ({ t, army, boss });
  const end = CLASH_APPROACH_SECONDS + CLASH_SECONDS;
  it("clash starts when the approach ends", () => {
    expect(kinds(bossCues(f(0, 9, 5), f(0.1, 9, 5)))).toEqual([]);
    expect(kinds(bossCues(f(0.5, 9, 5), f(0.7, 9, 5)))).toEqual(["boss-clash"]);
    expect(bossCues(f(0.7, 9, 5), f(0.8, 9, 5))).toEqual([]);
  });
  it("result when the clash is done; a tie is lost", () => {
    expect(kinds(bossCues(f(end - 0.1, 9, 5), f(end + 0.1, 9, 5)))).toEqual([
      "boss-won",
    ]);
    expect(kinds(bossCues(f(end - 0.1, 5, 5), f(end + 0.1, 5, 5)))).toEqual([
      "boss-lost",
    ]);
    expect(bossCues(f(end + 0.1, 9, 5), null)).toEqual([]);
  });
});
