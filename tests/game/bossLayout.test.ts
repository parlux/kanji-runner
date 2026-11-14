import { describe, expect, it } from "vitest";
import { worldZ } from "../../src/game/three/world";
import { screenAt, hazeFor } from "../../src/game/three/camera";
import {
  BOSS_RANGE,
  bossShown,
  BOSS_TOP,
  bossArmyDist,
  bossFightAt,
  bossHp,
  bossPlace,
} from "../../src/game/three/bossLayout";
import { clashAt } from "../../src/core/boss";
import {
  BASE_SPEED,
  CLASH_APPROACH_SECONDS,
  CLASH_HOLD_SECONDS,
  CLASH_SECONDS,
  MAX_SPEED_MUL,
  ROWS_PER_RUN,
} from "../../src/core/tuning";
import { defaultProgress } from "../../src/core/srs";
import {
  createSession,
  handleAction,
  updateScene,
  type Scene,
} from "../../src/game/scenes";
import { STEP } from "../../src/game/loop";
import { buildTrack } from "../../src/core/track";
import { AIM, cameraFor } from "../../src/game/three/view";

describe("the giant boss", () => {
  const track = buildTrack(7, ROWS_PER_RUN);
  const last = track.questions.at(-1) ?? 0;
  const final = BASE_SPEED * MAX_SPEED_MUL;

  it("stands past the last question: the approach at the final speed, then firing range", () => {
    const p = bossPlace(track);
    expect(p.stop).toBeCloseTo(last + final * CLASH_APPROACH_SECONDS, 9);
    expect(p.boss).toBeCloseTo(p.stop + BOSS_RANGE, 9);
    // a slower speed preset covers less in the approach
    const slow = bossPlace(track, 0.7);
    expect(slow.stop).toBeCloseTo(last + 0.7 * final * CLASH_APPROACH_SECONDS);
  });

  it("runs the army on at the final speed from where the run ended, stopping at the firing stop", () => {
    const { stop } = bossPlace(track, 0.85);
    const from = last + 0.01;
    expect(bossArmyDist(from, track, 0.85, 0)).toBe(from);
    const t = 0.1;
    expect(bossArmyDist(from, track, 0.85, t)).toBeCloseTo(
      from + 0.85 * final * t,
      9,
    );
    expect(bossArmyDist(from, track, 0.85, CLASH_APPROACH_SECONDS)).toBe(stop);
    expect(bossArmyDist(from, track, 0.85, 3)).toBe(stop);
  });

  it("has the 2D boss's size as HP, for the same seed", () => {
    const session = createSession(defaultProgress());
    for (const seed of [1, 7, 42]) {
      const start = handleAction(
        { kind: "start" },
        "confirm",
        () => seed,
        session,
      );
      if (start.scene.kind !== "run") throw new Error("no run");
      const run = start.scene.run;
      const hp = bossHp(run, seed);
      const end = run.track.questions.at(-1) ?? 0;
      const almost: Scene = {
        ...start.scene,
        run: {
          ...run,
          dist: end - 1e-6,
          next: run.rows.length - 1,
          nextHazard: run.track.hazards.length,
          army: 50,
        },
      };
      const boss = updateScene(almost, STEP, 0);
      if (boss.kind !== "boss") throw new Error(`got ${boss.kind}`);
      expect(hp).toBe(boss.boss);
    }
  });

  it("shows both sides per clashAt: nobody fires on the approach, then each soldier lost takes 1 HP", () => {
    const pre = bossFightAt(40, 30, CLASH_APPROACH_SECONDS / 2);
    expect(pre).toEqual({ army: 40, hp: 30, firing: false, ending: null });
    for (const t of [0.7, 1.2, 2, 2.9]) {
      const f = bossFightAt(40, 30, t);
      const c = clashAt(40, 30, t - CLASH_APPROACH_SECONDS);
      expect([f.army, f.hp]).toEqual([c.army, c.boss]);
      expect(40 - f.army).toBe(30 - f.hp);
      expect(f.firing).toBe(true);
      expect(f.ending).toBeNull();
    }
    const end = CLASH_APPROACH_SECONDS + CLASH_SECONDS;
    expect(bossFightAt(40, 30, end)).toMatchObject({
      army: 10,
      hp: 0,
      firing: false,
    });
  });

  it("topples on a win, stomps on a loss, stands on a tie, over the hold", () => {
    const end = CLASH_APPROACH_SECONDS + CLASH_SECONDS;
    expect(bossFightAt(40, 30, end).ending).toEqual({ kind: "topple", u: 0 });
    expect(bossFightAt(20, 30, end).ending?.kind).toBe("stomp");
    expect(bossFightAt(30, 30, end).ending?.kind).toBe("stand");
    expect(
      bossFightAt(20, 30, end + CLASH_HOLD_SECONDS / 2).ending?.u,
    ).toBeCloseTo(0.5);
    expect(bossFightAt(20, 30, end + 9).ending?.u).toBe(1);
  });

  it("comes out of the haze: total at bossShown() up to its top, clear at the firing stop", () => {
    const haze = hazeFor(cameraFor().pose, 0);
    expect(haze(bossShown(), BOSS_TOP)).toBe(1);
    expect(haze(bossShown(), 0)).toBe(1);
    expect(haze(BOSS_RANGE, BOSS_TOP)).toBe(0);
  });

  it("is whole on screen at the firing stop, with room for its HP above", () => {
    for (const aspect of [390 / 844, 1280 / 800]) {
      const fit = cameraFor();
      const z = worldZ(BOSS_RANGE, 0);
      const top = screenAt(fit, aspect, 0, BOSS_TOP, z).y;
      const foot = screenAt(fit, aspect, 0, 0, z).y;
      expect(top).toBeGreaterThan(0.15);
      expect(foot).toBeLessThan(AIM.armyY);
      // a giant: several times a soldier's height on screen
      const soldier =
        screenAt(fit, aspect, 0, 0, 0).y - screenAt(fit, aspect, 0, 0.8, 0).y;
      expect(foot - top).toBeGreaterThan(2.5 * soldier);
    }
  });
});
