import { Scene } from "three";
import { describe, expect, it } from "vitest";
import {
  createRunState,
  isShattered,
  packSurvivors,
  type RunState,
} from "../../src/core/sim";
import type { Track } from "../../src/core/track";
import {
  startGauntlet,
  stepGauntlet,
  waveRun,
  type Gauntlet,
} from "../../src/game/sandbox/gauntlet";
import { GAUNTLET, type WavePreset } from "../../src/game/sandbox/presets";
import { createHorde } from "../../src/game/three/horde";
import {
  createKills,
  FINAL_PIECES,
  killPieces,
  MAX_KILL_PIECES,
  MAX_KILL_RINGS,
  ROW_CHIPS,
} from "../../src/game/three/kills";
import { DIST_SCALE, shapeDistance } from "../../src/game/three/world";

const rows = [
  {
    type: "reading" as const,
    prompt: "山",
    options: ["やま", "かわ"],
    answerIndex: 0,
    answer: "やま",
  },
];

/** A run with one pack of 200 (40 HP) 2 ahead, `damage` dealt. */
function pack(damage: number): RunState {
  const track: Track = {
    questions: [9],
    hazards: [{ kind: "pack", pos: 2, x: 0.5 }],
    charges: [],
  };
  const run = createRunState(rows, track);
  run.army = 200;
  run.hp = [40];
  run.heads = [200];
  run.damage = [damage];
  run.packs = [{ pos: 2, x: 0.5 }];
  return run;
}

function setup() {
  const kills = createKills();
  const h = createHorde(new Scene(), kills);
  const step = (run: RunState, clock: number) => {
    h.update(run, clock);
    kills.update(run, clock);
  };
  return { kills, step };
}

/** Plays gauntlet wave `i` frame by frame with the horde and its kills. */
function play(i: number) {
  const { kills, step } = setup();
  let g: Gauntlet = {
    ...startGauntlet(GAUNTLET),
    index: i,
    run: waveRun(GAUNTLET[i] as WavePreset),
    phase: "play",
  };
  const matrices = kills.pieces.instanceMatrix.array;
  let most = 0;
  let mostRings = 0;
  let dead = 0;
  const dt = 1 / 60;
  for (let f = 0; f < 4000 && g.phase === "play"; f++) {
    const before = g.run;
    g = stepGauntlet(g, dt, 0);
    // drawn deaths this frame: survivors that dropped, minus those that ran past
    if (g.run.track === before.track) {
      const k = g.run.track.hazards.findIndex((hz) => hz.kind === "pack");
      const was = isShattered(before, k) ? 0 : packSurvivors(before, k);
      const now = isShattered(g.run, k) ? 0 : packSurvivors(g.run, k);
      dead += was - now;
    }
    step(g.run, f * dt);
    most = Math.max(most, kills.pieces.count);
    mostRings = Math.max(mostRings, kills.rings.count);
  }
  return {
    kills,
    most,
    mostRings,
    dead,
    same: kills.pieces.instanceMatrix.array === matrices,
  };
}

describe("kill effects (Task H6)", () => {
  it("never grows its pool through a whole wave, and wipes the pack with one final burst", () => {
    const r = play(0);
    expect(r.same).toBe(true);
    expect(r.kills.pieces.instanceMatrix.count).toBe(MAX_KILL_PIECES);
    expect(r.most).toBeGreaterThan(10);
    expect(r.most).toBeLessThanOrEqual(MAX_KILL_PIECES);
    expect(r.mostRings).toBeGreaterThan(0);
    expect(r.mostRings).toBeLessThanOrEqual(MAX_KILL_RINGS);
    expect(r.kills.stats.wiped).toBe(1);
    // every drop the core made shows as a kill (none ran past a held line)
    expect(r.kills.stats.killed).toBe(r.dead);
    // gathered per row: far fewer events than kills
    expect(r.kills.stats.events).toBeLessThan(r.kills.stats.killed / 2);
  });

  it("flashes in the melee when a weak army holds its line", () => {
    const r = play(5);
    expect(r.kills.stats.melee).toBeGreaterThan(0);
  });

  it("counts each drop once, nothing while paused, and starts over on a new run", () => {
    const { kills, step } = setup();
    const a = pack(0);
    step(a, 0);
    expect(kills.stats.killed).toBe(0);
    // 10 of 200 killed (0.2 HP each)
    const b = { ...a, damage: [2], dist: 0.01 };
    step(b, 0.1);
    expect(kills.stats).toMatchObject({ killed: 10, wiped: 0, events: 1 });
    const drawn = kills.pieces.count;
    const m = Array.from(
      kills.pieces.instanceMatrix.array.slice(0, 16 * drawn),
    );
    // paused: the same state and clock, frame after frame
    for (let f = 0; f < 5; f++) step(b, 0.1);
    expect(kills.stats).toMatchObject({ killed: 10, events: 1 });
    expect(kills.pieces.count).toBe(drawn);
    expect(
      Array.from(kills.pieces.instanceMatrix.array.slice(0, 16 * drawn)),
    ).toEqual(m);
    // the rest die: a final burst
    step({ ...b, damage: [40], dist: 0.02 }, 0.2);
    expect(kills.stats).toMatchObject({ killed: 200, wiped: 1 });
    expect(kills.rings.count).toBe(1);
    // a new run: counts start over, nothing left drawn from the old one
    const c = pack(0);
    step(c, 0.3);
    expect(kills.stats).toMatchObject({ killed: 0, wiped: 0, events: 0 });
    expect(kills.pieces.count).toBe(0);
    step({ ...c, damage: [1], dist: 0.01 }, 0.4);
    expect(kills.stats.killed).toBe(5);
  });

  it("uses fewer pieces beyond half the shape distance", () => {
    const half = (shapeDistance() * DIST_SCALE) / 2;
    expect(killPieces("row", 50, -1)).toBe(ROW_CHIPS);
    expect(killPieces("row", 50, -half - 1)).toBe(ROW_CHIPS / 2);
    expect(killPieces("row", 1, -1)).toBe(5);
    expect(killPieces("final", 1, -1)).toBe(FINAL_PIECES);
    expect(killPieces("final", 1, -half - 1)).toBe(FINAL_PIECES / 2);
    expect(killPieces("melee", 1, -1)).toBeLessThan(killPieces("melee", 9, -1));
  });
});
