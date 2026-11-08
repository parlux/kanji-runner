import { describe, expect, it } from "vitest";
import { bossSize } from "../../src/core/boss";
import { createRng } from "../../src/core/rng";
import { buildPoolRun, select } from "../../src/core/run";
import {
  REASK_OPTIONS,
  reaskRun,
  type ReaskConfig,
} from "../../src/core/reask";
import {
  createRunState,
  plannedRows,
  rowOpenings,
  setTarget,
  stepRun,
  type RunState,
} from "../../src/core/sim";
import { itemKey, recordRun } from "../../src/core/srs";
import { buildTrack } from "../../src/core/track";
import {
  REASK_GAP_MAX,
  REASK_GAP_MIN,
  REASK_MAX,
  REASK_MAX_BOX,
  ROWS_PER_RUN,
  VIEW_DISTANCE,
} from "../../src/core/tuning";
import { botRun } from "./bot";
import { kanaRun } from "./kana-run";
import { wkPool, wkProgress, wkRun } from "./wk-run";

const DT = 1 / 60;
const SEEDS = Array.from({ length: 100 }, (_, seed) => seed);

/**
 * Drives a run to the end through the chosen opening of every wall, with an
 * army too big to die, checking each new re-ask is placed out of sight.
 */
function drive(s0: RunState, wrong: (q: number) => boolean): RunState {
  let s: RunState = { ...s0, army: 100_000 };
  while (s.status === "running") {
    const row = s.rows[s.next];
    const n = row?.options.length ?? 2;
    const answer = row?.answerIndex ?? 0;
    const pick = wrong(s.next) ? (answer + 1) % n : answer;
    s = setTarget(s, rowOpenings(s, s.next)[pick]?.centre ?? 0.5);
    const before = s.reask?.links.length ?? 0;
    s = stepRun(s, DT);
    const link = s.reask?.links[before];
    if (link) {
      const wall = s.track.questions[link.row] ?? 0;
      expect(wall - s.dist).toBeGreaterThan(VIEW_DISTANCE);
    }
  }
  return s;
}

const track = (seed: number) => buildTrack(seed, ROWS_PER_RUN);

/** A WaniKani run where every row starts at `box`. */
function atBox(seed: number, box: number): RunState {
  const { rows, reask } = wkRun(seed);
  const cfg = reask as ReaskConfig;
  return createRunState(rows, track(seed), {
    ...cfg,
    startBoxes: cfg.startBoxes.map(() => box),
  });
}

describe("reaskRun", () => {
  it("gives buildPoolRun's rows, with matching entries and start boxes", () => {
    for (const seed of SEEDS.slice(0, 20)) {
      const { rows, reask } = reaskRun(seed, wkProgress, wkPool);
      expect(rows).toEqual(buildPoolRun(seed, wkProgress, wkPool));
      const entries = select(createRng(seed), wkPool);
      expect(reask.entries).toEqual(entries);
      expect(reask.startBoxes).toEqual(entries.map((e) => wkPool.box(e)));
      rows.forEach((r, i) =>
        expect(itemKey(r.prompt, r.type)).toBe(reask.entries[i]?.key),
      );
    }
  });
});

describe("re-asks in the sim", () => {
  it("are off without a config: a kana run plays as before", () => {
    for (const seed of SEEDS.slice(0, 10)) {
      const s = botRun(seed, { wrong: (q) => q % 2 === 1 });
      expect(s.reask).toBeNull();
      expect(s.rows).toEqual(kanaRun(seed));
    }
  });

  it("a miss at question q is asked again 3–5 rows later", () => {
    let placed = 0;
    for (const seed of SEEDS)
      for (const q of [0, 2, 4, 6]) {
        const s0 = atBox(seed, REASK_MAX_BOX + 1);
        const s = drive(s0, (i) => i === q);
        const links = s.reask?.links ?? [];
        expect(links.length).toBeLessThanOrEqual(1);
        const link = links[0];
        if (!link) continue;
        placed++;
        expect(link.of).toBe(q);
        expect(link.row - q).toBeGreaterThanOrEqual(REASK_GAP_MIN);
        expect(link.row - q).toBeLessThanOrEqual(REASK_GAP_MAX);
        expect(s.track.charges).not.toContain(link.row);
        const first = s.rows[q];
        const again = s.rows[link.row];
        expect(again?.prompt).toBe(first?.prompt);
        expect(again?.type).toBe(first?.type);
        expect(again?.answer).toBe(first?.answer);
        expect(again?.options).toHaveLength(REASK_OPTIONS);
        expect(s.gates[link.row]).toHaveLength(REASK_OPTIONS);
        expect(s.reask?.entries[link.row]?.key).toBe(s.reask?.entries[q]?.key);
        expect(s.reask?.startBoxes[link.row]).toBe(REASK_MAX_BOX + 1);
        // the re-ask is answered (right) and triggers nothing
        expect(s.results[link.row]).toBe(true);
      }
    // only same-key clashes in the window can block these
    expect(placed).toBeGreaterThan(350);
  }, 60_000);

  it("a right answer at a high box triggers nothing; at a weak box it does", () => {
    for (const seed of SEEDS.slice(0, 20)) {
      expect(
        drive(atBox(seed, REASK_MAX_BOX + 1), () => false).reask?.links,
      ).toEqual([]);
      expect(
        drive(atBox(seed, REASK_MAX_BOX), () => false).reask?.links.length,
      ).toBe(REASK_MAX);
    }
  });

  it("the cap holds, in trigger order, and re-asks never re-trigger", () => {
    for (const seed of SEEDS) {
      const { rows, reask } = wkRun(seed);
      const s = drive(createRunState(rows, track(seed), reask), () => true);
      const links = s.reask?.links ?? [];
      expect(links.length).toBeLessThanOrEqual(REASK_MAX);
      const ofs = links.map((l) => l.of);
      expect(ofs).toEqual([...ofs].sort((a, b) => a - b));
      for (const l of links)
        expect(links.some((m) => m.of === l.row)).toBe(false);
    }
  });

  it("never changes the track, hit points or boss inputs", () => {
    for (const seed of SEEDS.slice(0, 30)) {
      const on = wkRun(seed, true);
      const off = wkRun(seed, false);
      const a = drive(
        createRunState(on.rows, track(seed), on.reask),
        () => true,
      );
      const b = drive(createRunState(off.rows, track(seed), null), () => true);
      expect(a.reask?.links.length).toBeGreaterThan(0);
      expect(a.track).toEqual(b.track);
      expect(a.hp).toEqual(b.hp);
      expect(plannedRows(a)).toEqual(b.rows);
      expect(bossSize(plannedRows(a), a.track.charges, seed)).toBe(
        bossSize(b.rows, b.track.charges, seed),
      );
      expect(a.rows).toHaveLength(ROWS_PER_RUN);
      // only re-ask rows differ
      const reasked = new Set(a.reask?.links.map((l) => l.row));
      a.rows.forEach((r, i) => {
        if (!reasked.has(i)) expect(r).toEqual(b.rows[i]);
      });
    }
  });

  it("same seed and answers give the same run", () => {
    for (const seed of SEEDS.slice(0, 30)) {
      const wrong = (q: number) => q % 2 === 1;
      const run = () => {
        const { rows, reask } = wkRun(seed);
        return drive(createRunState(rows, track(seed), reask), wrong);
      };
      const a = run();
      const b = run();
      expect(a.rows).toEqual(b.rows);
      expect(a.results).toEqual(b.results);
      expect(a.reask?.links).toEqual(b.reask?.links);
    }
  });

  it("feeds recordRun: a pair's record follows the pair table", () => {
    let checked = 0;
    for (const seed of SEEDS.slice(0, 30)) {
      const s0 = atBox(seed, 1);
      // first asks right, re-asks wrong (a re-ask row is never its own trigger)
      const reaskRows = new Set<number>();
      let s: RunState = { ...s0, army: 100_000 };
      while (s.status === "running") {
        for (const l of s.reask?.links ?? []) reaskRows.add(l.row);
        const row = s.rows[s.next];
        const n = row?.options.length ?? 2;
        const answer = row?.answerIndex ?? 0;
        const pick = reaskRows.has(s.next) ? (answer + 1) % n : answer;
        s = setTarget(s, rowOpenings(s, s.next)[pick]?.centre ?? 0.5);
        s = stepRun(s, DT);
      }
      const r = s.reask;
      const link = r?.links[0];
      if (!r || !link) continue;
      const key = r.entries[link.of]?.key as string;
      expect(s.results[link.of]).toBe(true);
      expect(s.results[link.row]).toBe(false);
      const after = recordRun(wkProgress, s.rows, s.results, false, 7, r);
      // right then wrong → 0, both answers counted
      expect(after.items[key]?.box).toBe(0);
      expect(after.items[key]?.seen).toBe(2);
      // a right-right pair (no re-ask missed) → start box + 1
      const allRight = drive(atBox(seed, 1), () => false);
      const rr = allRight.reask;
      const l2 = rr?.links[0];
      if (rr && l2) {
        const k2 = rr.entries[l2.of]?.key as string;
        const p2 = recordRun(
          wkProgress,
          allRight.rows,
          allRight.results,
          true,
          7,
          rr,
        );
        expect(p2.items[k2]?.box).toBe(2);
        expect(p2.items[k2]?.correct).toBe(2);
      }
      checked++;
    }
    expect(checked).toBeGreaterThan(20);
  });
});
