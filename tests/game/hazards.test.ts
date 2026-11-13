import { Mesh, Scene } from "three";
import { describe, expect, it } from "vitest";
import { createRunState } from "../../src/core/sim";
import type { Track } from "../../src/core/track";
import { createFx } from "../../src/game/three/fx";
import { createHazards } from "../../src/game/three/hazards";

describe("hazards", () => {
  it("draws a pack in view through the horde", () => {
    const scene = new Scene();
    const fx = createFx(scene);
    const before = scene.children.length;
    const hazards = createHazards(scene, fx);
    const track: Track = {
      questions: [9],
      hazards: [{ kind: "pack", pos: 2, x: 0.5 }],
      charges: [],
    };
    const run = createRunState(
      [
        {
          type: "reading",
          prompt: "山",
          options: ["やま", "かわ"],
          answerIndex: 0,
          answer: "やま",
        },
      ],
      track,
    );
    run.heads = [300];
    hazards.update(run, 0, false);
    // the horde's slots are the first meshes the hazards add
    const slot = scene.children[before];
    if (!(slot instanceof Mesh)) throw new Error("no horde mesh");
    expect(slot.visible).toBe(true);
    expect(slot.geometry.instanceCount).toBe(300);
  });
});
