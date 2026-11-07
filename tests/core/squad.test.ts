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
import { clipLoss, crowdWidth } from "../../src/core/crowd";
import {
  createRunState,
  gateOpenings,
  setTarget,
  squadCentres,
  stepRun,
  viewOf,
  wallSolids,
  type ChargeView,
  type RunState,
  type SquadView,
} from "../../src/core/sim";
import { buildTrack, isCharge } from "../../src/core/track";
import { BASE_REWARD, ROWS_PER_RUN } from "../../src/core/tuning";
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

  it("are laid out exactly like walls", () => {
    const bad = SEEDS.filter((seed) => {
      const on = buildTrack(seed, ROWS_PER_RUN);
      const off = buildTrack(seed, ROWS_PER_RUN, false);
      return JSON.stringify({ ...on, charges: [] }) !== JSON.stringify(off);
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

/** A seeded run without hazards, sitting `ahead` before charge `q` with the crowd at x. */
function beforeCharge(
  seed: number,
  q = 3,
  x = 0.5,
  army = 40,
  ahead = 1e-6,
): RunState {
  const track = { ...buildTrack(seed, ROWS_PER_RUN), hazards: [] };
  const s = createRunState(buildKanaRun(seed, KANA), track);
  return {
    ...s,
    army,
    next: q,
    x,
    targetX: x,
    dist: (track.questions[q] as number) - ahead,
  };
}

/** Steps until question `s.next` resolves, calling `input` before every step. */
function toContact(s: RunState, input = (r: RunState) => r): RunState {
  const target = s.next + 1;
  while (s.next < target && s.status === "running") s = stepRun(input(s), DT);
  return s;
}

describe("choosing at a charge", () => {
  it("the choice is the opening nearest the crowd's centre at contact", () => {
    expect(toContact(beforeCharge(1, 3, 0.3)).lastAnswer?.choice).toBe(0);
    expect(toContact(beforeCharge(1, 3, 0.7)).lastAnswer?.choice).toBe(1);
    const mids = squadCentres(gateOpenings(3));
    mids.forEach((x, j) =>
      expect(toContact(beforeCharge(1, 7, x)).lastAnswer?.choice).toBe(j),
    );
  });

  it("steering works right up to contact", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      for (const q of [3, 7, 11]) {
        const n = buildKanaRun(seed, KANA)[q]?.options.length ?? 2;
        const mids = squadCentres(gateOpenings(n));
        // start lined up on the first squad, switch to its neighbour late
        const s = beforeCharge(seed, q, mids[0], 20, 0.8);
        const after = toContact(s, (r) => setTarget(r, mids[1] as number));
        expect(after.next).toBe(q + 1);
        expect(after.lastAnswer?.choice).toBe(1);
        expect(after.x).toBeCloseTo(mids[1] as number, 1);
        // and one step before contact the target still moves
        const almost = beforeCharge(seed, q, mids[0], 20, 0.05);
        expect(setTarget(almost, 0.8).targetX).toBe(0.8);
      }
    }
  });

  it("a charge clips exactly like a wall, then scores the rest as a charge", () => {
    const army = 100;
    const w = crowdWidth(army);
    const probe = beforeCharge(1, 7);
    const row = probe.rows[7] as GateRow;
    const o = gateOpenings(3)[row.answerIndex] as {
      left: number;
      right: number;
    };
    // a quarter of the crowd hangs over the wall beside the right answer
    const x = row.answerIndex === 0 ? o.right - w / 4 : o.left + w / 4;
    const clip = clipLoss(army, x, w, wallSolids(gateOpenings(3)));
    expect(clip).toBeGreaterThan(0);
    const after = toContact({ ...beforeCharge(1, 7, x, army), streak: 1 });
    expect(after.lastClip?.loss).toBe(clip);
    expect(after.army).toBe(
      applyCorrectCharge(army - clip, 1, BASE_REWARD[row.type]).army,
    );
    expect(after.lastAnswer).toMatchObject({ correct: true });
  });

  it("a charge that clips the crowd to nothing ends the run", () => {
    const after = toContact(beforeCharge(1, 3, 0.5, 3));
    // the middle of a 2-answer wall is solid
    expect(after.army).toBe(0);
    expect(after.status).toBe("dead");
  });
});

describe("charge resolution", () => {
  /** Runs into the given squad of charge q. */
  function charge(q: number, pick: "right" | "wrong", army = 40, streak = 2) {
    const probe = beforeCharge(1, q);
    const row = probe.rows[q];
    const n = row?.options.length ?? 2;
    const answer = row?.answerIndex ?? 0;
    const idx = pick === "right" ? answer : (answer + 1) % n;
    const x = squadCentres(gateOpenings(n))[idx] as number;
    const s = { ...beforeCharge(1, q, x, army), streak };
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
  it("before contact, every squad in a charge looks the same apart from label and position (300 seeds)", () => {
    const bad: string[] = [];
    let checked = 0;
    for (let seed = 0; seed < 300; seed++) {
      const track = buildTrack(seed, ROWS_PER_RUN);
      let s = createRunState(buildKanaRun(seed, KANA), track);
      const rng = createRng(seed);
      while (s.status === "running") {
        if (rng() < 0.05) s = setTarget(s, rng());
        for (const c of viewOf(s).charges) {
          if (c.resolved) continue;
          checked++;
          const first = JSON.stringify(look(c.squads[0] as SquadView));
          const same = c.squads.every(
            (q) => JSON.stringify(look(q)) === first && !q.chosen && !q.outcome,
          );
          if (!same || c.contactDist !== null) bad.push(`${seed}:${c.row}`);
        }
        s = stepRun(s, DT);
      }
    }
    expect(checked).toBeGreaterThan(1000);
    expect(bad).toEqual([]);
  }, 60_000);

  it("before contact, the view doesn't change with which answer is correct", () => {
    for (let seed = 0; seed < 50; seed++) {
      for (const ahead of [2, 0.5, 1e-6]) {
        const s = beforeCharge(seed, 7, 0.5, 40, ahead);
        const row = s.rows[7] as GateRow;
        for (let a = 0; a < row.options.length; a++) {
          const rows = [...s.rows];
          rows[7] = { ...row, answerIndex: a, answer: row.options[a] ?? "" };
          expect(viewOf({ ...s, rows })).toEqual(viewOf(s));
        }
      }
    }
  });

  it("after contact, only the chosen squad shows an outcome", () => {
    const s = toContact(beforeCharge(1, 7, 0.5));
    const c = viewOf(s).charges.find((v) => v.row === 7) as ChargeView;
    expect(c.resolved).toBe(true);
    expect(c.contactDist).toBe(s.lastAnswer?.dist);
    const chosen = c.squads.filter((q) => q.chosen);
    expect(chosen).toHaveLength(1);
    expect(chosen[0]?.outcome).toBe(s.lastAnswer?.correct ? "join" : "fight");
    const others = c.squads.filter((q) => !q.chosen).map(look);
    expect(others.every((o) => o.outcome === null)).toBe(true);
  });
});
