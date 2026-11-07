import { describe, expect, it } from "vitest";
import { expectedArmy } from "../../src/core/fire";
import { KANA } from "../../src/core/kana";
import { createRng } from "../../src/core/rng";
import { buildKanaRun } from "../../src/core/run";
import {
  applyCorrect,
  applyCorrectCharge,
  applyWrongCharge,
} from "../../src/core/scoring";
import {
  createRunState,
  isLocked,
  nudgeTarget,
  setTarget,
  squadCentres,
  stepRun,
  viewOf,
  type ChargeView,
  type RunState,
  type SquadView,
} from "../../src/core/sim";
import { buildTrack, chargeLine, isCharge } from "../../src/core/track";
import {
  BASE_REWARD,
  CALM_DISTANCE,
  CHARGE_LINE_DISTANCE,
  ROWS_PER_RUN,
} from "../../src/core/tuning";
import type { GateRow } from "../../src/core/types";

const DT = 1 / 60;

const SEEDS = Array.from({ length: 1000 }, (_, seed) => seed);

describe("squad charges on the track", () => {
  it("are questions 4, 8 and 12, never a warm-up", () => {
    const bad = SEEDS.filter((seed) => {
      const t = buildTrack(seed, ROWS_PER_RUN);
      return t.charges.join() !== "3,7,11" || t.charges.some((q) => q < 3);
    });
    expect(bad).toEqual([]);
  });

  it("put the charge line CHARGE_LINE_DISTANCE before the squads, inside the calm stretch", () => {
    expect(CHARGE_LINE_DISTANCE).toBeLessThan(CALM_DISTANCE);
    const bad = SEEDS.filter((seed) => {
      const t = buildTrack(seed, ROWS_PER_RUN);
      return t.charges.some((q) => {
        const line = chargeLine(t, q);
        const pos = t.questions[q] as number;
        return (
          Math.abs(pos - line - CHARGE_LINE_DISTANCE) > 1e-12 ||
          t.hazards.some((h) => h.pos >= line && h.pos <= pos)
        );
      });
    });
    expect(bad).toEqual([]);
  });

  it("don't change the rest of the layout, and can be switched off", () => {
    const on = buildTrack(5, ROWS_PER_RUN);
    const off = buildTrack(5, ROWS_PER_RUN, false);
    expect(off.charges).toEqual([]);
    expect({ ...on, charges: [] }).toEqual(off);
    expect(isCharge(on, 3)).toBe(true);
    expect(isCharge(on, 4)).toBe(false);
    expect(isCharge(off, 3)).toBe(false);
  });

  it("are deterministic per seed", () => {
    expect(buildTrack(9, ROWS_PER_RUN)).toEqual(buildTrack(9, ROWS_PER_RUN));
  });

  it("only include questions that exist in a short run", () => {
    expect(buildTrack(1, 8).charges).toEqual([3, 7]);
    expect(buildTrack(1, 3).charges).toEqual([]);
  });
});

/** A seeded run without hazards, sitting just before charge `q`'s line with the crowd at x. */
function beforeLine(seed: number, q = 3, x = 0.5, army = 40): RunState {
  const track = { ...buildTrack(seed, ROWS_PER_RUN), hazards: [] };
  const s = createRunState(buildKanaRun(seed, KANA), track);
  return {
    ...s,
    army,
    next: q,
    x,
    targetX: x,
    dist: chargeLine(track, q) - 1e-6,
  };
}

/** Steps until question `s.next` resolves, calling `input` before every step. */
function toContact(s: RunState, input = (r: RunState) => r): RunState {
  const target = s.next + 1;
  while (s.next < target && s.status === "running") s = stepRun(input(s), DT);
  return s;
}

describe("charge lock", () => {
  it("crossing the line locks onto the squad nearest the crowd's centre", () => {
    const s = beforeLine(1, 3, 0.3);
    expect(isLocked(s)).toBe(false);
    const locked = stepRun(s, DT);
    expect(isLocked(locked)).toBe(true);
    expect(locked.lock?.choice).toBe(0);
    expect(stepRun(beforeLine(1, 3, 0.7), DT).lock?.choice).toBe(1);
  });

  it("steering input after the line has no effect until contact", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      for (const q of [3, 7, 11]) {
        const locked = stepRun(beforeLine(seed, q, 0.3), DT);
        expect(isLocked(locked)).toBe(true);
        const still = toContact(locked);
        const rng = createRng(seed * 31 + q);
        const steered = toContact(locked, (r) =>
          rng() < 0.5 ? setTarget(r, rng()) : nudgeTarget(r, rng() - 0.5),
        );
        expect(steered).toEqual(still);
        expect(still.lastAnswer?.choice).toBe(0);
        expect(still.next).toBe(q + 1);
      }
    }
  });

  it("the locked army runs at its chosen squad", () => {
    const s = toContact(stepRun(beforeLine(1, 7, 0.45), DT));
    expect(s.x).toBeCloseTo(squadCentres(3)[1] as number, 3);
  });

  it("steering works again after contact", () => {
    const s = toContact(stepRun(beforeLine(1, 3, 0.3), DT));
    expect(setTarget(s, 0.8).targetX).toBe(0.8);
  });
});

describe("charge resolution", () => {
  /** Locks onto the given squad of charge q and runs to contact. */
  function charge(q: number, pick: "right" | "wrong", army = 40, streak = 2) {
    const probe = beforeLine(1, q);
    const row = probe.rows[q];
    const n = row?.options.length ?? 2;
    const answer = row?.answerIndex ?? 0;
    const idx = pick === "right" ? answer : (answer + 1) % n;
    const x = squadCentres(n)[idx] as number;
    const s = { ...beforeLine(1, q, x, army), streak };
    return {
      before: s,
      after: toContact(s),
      base: BASE_REWARD[row?.type ?? "kana"],
    };
  }

  it("a correct charge pays the streak reward plus SQUAD_DEFECT_GAIN", () => {
    const { after, base } = charge(3, "right", 40, 2);
    expect(after.army).toBe(applyCorrectCharge(40, 2, base).army);
    expect(after.army).toBe(applyCorrect(40, 2, base).army + 10);
    expect(after.streak).toBe(3);
    expect(after.results.at(-1)).toBe(true);
    expect(after.lastAnswer).toMatchObject({ correct: true });
    expect(after.lastClip).toBeNull();
  });

  it("a wrong charge costs max(8, 50%) and resets the streak", () => {
    for (const [army, left] of [
      [40, 20],
      [15, 7],
      [9, 1],
    ] as const) {
      const { after } = charge(7, "wrong", army, 4);
      expect(after.army).toBe(applyWrongCharge(army).army);
      expect(after.army).toBe(left);
      expect(after.streak).toBe(0);
      expect(after.results.at(-1)).toBe(false);
      expect(after.status).toBe("running");
    }
  });

  it("a wrong charge that takes the army to 0 ends the run", () => {
    const { after } = charge(11, "wrong", 8);
    expect(after.army).toBe(0);
    expect(after.status).toBe("dead");
  });
});

describe("expectedArmy with charges", () => {
  it("scores charge questions as charges", () => {
    const rows = buildKanaRun(1, KANA);
    const plain = expectedArmy(rows);
    const withCharges = expectedArmy(rows, [3]);
    expect(withCharges[3]).toBe(plain[3]);
    expect(withCharges[4]).toBe((plain[4] as number) + 10);
  });
});

/** A squad without the two things that may differ between squads. */
const look = (q: SquadView): SquadView => ({ ...q, label: "", x: 0 });

describe("squad view honesty", () => {
  it("before the lock, every squad in a charge looks the same apart from label and position (300 seeds)", () => {
    const bad: string[] = [];
    for (let seed = 0; seed < 300; seed++) {
      const track = buildTrack(seed, ROWS_PER_RUN);
      let s = createRunState(buildKanaRun(seed, KANA), track);
      const rng = createRng(seed);
      while (s.status === "running") {
        if (rng() < 0.05) s = setTarget(s, rng());
        for (const c of viewOf(s).charges) {
          if (c.locked || c.resolved) continue;
          const first = JSON.stringify(look(c.squads[0] as SquadView));
          const same = c.squads.every(
            (q) => JSON.stringify(look(q)) === first && !q.chosen && !q.outcome,
          );
          if (!same || c.lockDist !== null) bad.push(`${seed}:${c.row}`);
        }
        s = stepRun(s, DT);
      }
    }
    expect(bad).toEqual([]);
  }, 60_000);

  it("before the lock, the view doesn't change with which answer is correct", () => {
    for (let seed = 0; seed < 50; seed++) {
      const s = beforeLine(seed, 7);
      const row = s.rows[7] as GateRow;
      for (let a = 0; a < row.options.length; a++) {
        const rows = [...s.rows];
        rows[7] = { ...row, answerIndex: a, answer: row.options[a] ?? "" };
        expect(viewOf({ ...s, rows })).toEqual(viewOf(s));
      }
    }
  });

  it("after the lock, only the chosen squad shows an outcome", () => {
    const s = stepRun(beforeLine(1, 7, 0.5), DT);
    const c = viewOf(s).charges.find((v) => v.row === 7) as ChargeView;
    expect(c.locked).toBe(true);
    const chosen = c.squads.filter((q) => q.chosen);
    expect(chosen).toHaveLength(1);
    const answer = s.rows[7]?.answerIndex;
    expect(chosen[0]?.outcome).toBe(
      s.lock?.choice === answer ? "join" : "fight",
    );
    const others = c.squads.filter((q) => !q.chosen).map(look);
    expect(others.every((o) => o.outcome === null)).toBe(true);
  });
});
