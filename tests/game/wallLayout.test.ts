import { describe, expect, it } from "vitest";
import { VIEW_DISTANCE } from "../../src/core/tuning";
import { SHAPE_DISTANCE, worldZ } from "../../src/game/three/world";
import {
  fogRange,
  hazeAt,
  viewDepth,
  screenAt,
  hazeFor,
  type CameraPose,
} from "../../src/game/three/camera";
import {
  projectorFor,
  squadDist,
  squadPlace,
  FIREFIGHT_DIST,
  SQUAD_BEYOND,
  wallPx,
  WALL_H,
} from "../../src/game/three/wallLayout";
import { AIM, cameraFor } from "../../src/game/three/view";

const pose: CameraPose = { height: 4, back: 12, lookAhead: 20, lookHeight: 0 };

describe("walls and their text", () => {
  const w = 390;
  const h = 844;
  const fit = cameraFor();

  it("projects a wall smaller the farther away it is", () => {
    const project = projectorFor(fit, w, h, 5);
    let last = Infinity;
    for (const ahead of [0.3, 0.8, 1.5, 2.2, VIEW_DISTANCE]) {
      const px = wallPx(project, 0.5, 5 + ahead);
      expect(px).toBeGreaterThan(0);
      expect(px).toBeLessThan(last);
      last = px;
    }
  });

  it("matches the live camera's placement of the army and the shape horizon", () => {
    const project = projectorFor(fit, w, h, 2);
    expect((project(0.5, 2, 0)?.y ?? 0) / h).toBeCloseTo(AIM.armyY, 6);
    expect((project(0.5, 2 + SHAPE_DISTANCE, 0)?.y ?? 0) / h).toBeCloseTo(
      screenAt(fit, w / h, 0, 0, worldZ(SHAPE_DISTANCE, 0)).y,
      6,
    );
    expect(project(0.5, 2 - 10, 0)).toBeNull();
  });

  it("gives overlay text the haze the fog gives the object at that point", () => {
    const run = 7;
    for (const p of [pose, cameraFor().pose]) {
      const haze = hazeFor(p, run);
      for (const ahead of [
        0.5,
        VIEW_DISTANCE,
        1.5 * VIEW_DISTANCE,
        SHAPE_DISTANCE,
      ])
        for (const y of [0, WALL_H / 2, WALL_H])
          expect(haze(run + ahead, y)).toBe(
            hazeAt(fogRange(p), viewDepth(p, y, worldZ(ahead, 0))),
          );
      expect(haze(run + SHAPE_DISTANCE, WALL_H / 2)).toBeGreaterThan(0.97);
      expect(haze(run + VIEW_DISTANCE, WALL_H / 2)).toBeLessThan(0.05);
      expect(haze(run + 1, WALL_H / 2)).toBe(0);
    }
  });

  it("stands squads beyond the wall, and the fighting one ahead of the army", () => {
    expect(squadDist(10, 8, null)).toBe(10 + SQUAD_BEYOND);
    // at contact it is still where it stood, then steps back and keeps ahead
    expect(squadDist(10, 10, 0)).toBe(10 + SQUAD_BEYOND);
    expect(squadDist(10, 10.5, 0.5)).toBeGreaterThan(10.5 + SQUAD_BEYOND);
  });
});

describe("squad placement", () => {
  const squad = (chosen: boolean, outcome: "join" | "fight" | null) => ({
    label: "a",
    x: 0.3,
    count: 10,
    chosen,
    outcome,
  });
  const charge = (contactDist: number | null, resolved: boolean) => ({
    row: 0,
    pos: 10,
    prompt: "水",
    resolved,
    contactDist,
    squads: [],
  });

  it("stands beyond its opening before contact", () => {
    const p = squadPlace(8, 0.5, charge(null, false), squad(false, null));
    expect(p).toMatchObject({ x: 0.3, dist: 10 + SQUAD_BEYOND, standing: 10 });
  });

  it("falls back once another squad was run into", () => {
    expect(
      squadPlace(10.1, 0.5, charge(10, true), squad(false, null))?.shown,
    ).toBeLessThan(1);
    expect(
      squadPlace(11, 0.5, charge(10, true), squad(false, null)),
    ).toBeNull();
  });

  it("is shot down when it fights back, and runs into the army when it joins", () => {
    const end = 10 + FIREFIGHT_DIST * 0.9;
    const fight = squadPlace(end, 0.5, charge(10, true), squad(true, "fight"));
    expect(fight?.tag).toBe("fight");
    expect(fight?.standing).toBeLessThan(10);
    const join = squadPlace(end, 0.5, charge(10, true), squad(true, "join"));
    expect(join?.friendly).toBe(true);
    expect(join?.x).toBeCloseTo(0.5, 6);
    expect(join?.dist).toBeCloseTo(end, 6);
    expect(
      squadPlace(
        10 + FIREFIGHT_DIST + 0.01,
        0.5,
        charge(10, true),
        squad(true, "join"),
      ),
    ).toBeNull();
  });
});
