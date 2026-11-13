import { InstancedMesh, Scene } from "three";
import { describe, expect, it } from "vitest";
import { createRunState, type RunState } from "../../src/core/sim";
import type { Track } from "../../src/core/track";
import { PACK_MAX } from "../../src/core/tuning";
import { createFx } from "../../src/game/three/fx";
import { createHazards } from "../../src/game/three/hazards";

const rows = [
  {
    type: "reading" as const,
    prompt: "山",
    options: ["やま", "かわ"],
    answerIndex: 0,
    answer: "やま",
  },
];

/** A run with full 200-head packs (40 HP each) at these distances ahead, `damage` dealt to each. */
function horde(at: number[], damage: number, dist = 0): RunState {
  const track: Track = {
    questions: [9],
    hazards: at.map((pos) => ({ kind: "pack" as const, pos, x: 0.5 })),
    charges: [],
  };
  const run = createRunState(rows, track);
  run.dist = dist;
  run.hp = at.map(() => 40);
  run.heads = at.map(() => PACK_MAX);
  run.damage = at.map(() => damage);
  return run;
}

function setup() {
  const scene = new Scene();
  const fx = createFx(scene);
  const before = scene.children.length;
  const hazards = createHazards(scene, fx);
  // the enemies are the first mesh the hazards add
  const enemies = scene.children[before];
  if (!(enemies instanceof InstancedMesh)) throw new Error("no enemy mesh");
  return { hazards, enemies };
}

describe("drawing the horde", () => {
  it("draws every live enemy of a pack, and two full packs at once", () => {
    const { hazards, enemies } = setup();
    hazards.update(horde([2], 0), 0, false);
    expect(enemies.count).toBe(PACK_MAX);
    const { hazards: h2, enemies: e2 } = setup();
    h2.update(horde([1, 2, 3], 0), 0, false);
    expect(e2.count).toBe(2 * PACK_MAX);
  });

  it("a killed enemy shrinks out over a short run distance, not at once", () => {
    const { hazards, enemies } = setup();
    const a = horde([2], 0);
    hazards.update(a, 0, false);
    // 10 of 200 killed (40 HP, 0.2 each)
    const b = { ...a, damage: [2], dist: 0.01 };
    hazards.update(b, 0, false);
    expect(enemies.count).toBe(PACK_MAX);
    // gone a little later
    hazards.update({ ...b, dist: 1 }, 0, false);
    expect(enemies.count).toBe(PACK_MAX - 10);
  });
});
