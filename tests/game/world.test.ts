import { describe, expect, it } from "vitest";
import { crowdWidth } from "../../src/core/crowd";
import {
  CALM_DISTANCE,
  CROWD_MAX_W,
  HAZARD_SPACING,
  REASK_GAP_MIN,
  SAW_W,
  VIEW_DISTANCE,
} from "../../src/core/tuning";
import {
  CROWD_DEPTH,
  crowdLayout,
  FIGURE_RADIUS,
  FOG_TOP_H,
  fogRange,
  hazeAt,
  SHAPE_DISTANCE,
  MAX_DRAWN_SOLDIERS,
  TRACK_W,
  trackDist,
  trackX,
  viewDepth,
  worldX,
  worldZ,
  screenAt,
  hazeFor,
  projectorFor,
  squadDist,
  squadPlace,
  FIREFIGHT_DIST,
  SQUAD_BEYOND,
  wallPx,
  WALL_H,
  spanWorld,
  sawPlace,
  burstPiece,
  BURST_PIECES,
  recruitProgress,
  packFigureScale,
  type CameraPose,
} from "../../src/game/three/world";
import { gateOpenings } from "../../src/core/gates";
import { hazardSpan, type Saw } from "../../src/core/track";
import { AIM, CAMERA_MIN_HEIGHT, cameraFit } from "../../src/game/three/view";

const pose: CameraPose = { height: 4, back: 12, lookAhead: 20, lookHeight: 0 };

describe("track ↔ world mapping", () => {
  it("round-trips track x and distance", () => {
    for (const x of [0, 0.13, 0.5, 0.9, 1]) expect(trackX(worldX(x))).toBe(x);
    for (const d of [0, 1.25, 7.5]) expect(trackDist(worldZ(d, 3), 3)).toBe(d);
  });

  it("spans the track width, centred, with the army at Z = 0 running to −Z", () => {
    expect(worldX(0)).toBe(-TRACK_W / 2);
    expect(worldX(1)).toBe(TRACK_W / 2);
    expect(worldZ(4, 4)).toBe(-0);
    expect(worldZ(5, 4)).toBeLessThan(0);
  });
});

describe("crowd layout", () => {
  const out = new Float32Array(2 * MAX_DRAWN_SOLDIERS);

  it("draws one figure per soldier, capped at MAX_DRAWN_SOLDIERS", () => {
    expect(crowdLayout(5, out)).toBe(5);
    expect(crowdLayout(40, out)).toBe(40);
    expect(crowdLayout(200, out)).toBe(200);
    expect(crowdLayout(1000, out)).toBe(MAX_DRAWN_SOLDIERS);
    expect(crowdLayout(0, out)).toBe(0);
  });

  it("keeps every figure inside the crowd's width", () => {
    for (const army of [1, 5, 40, 200, 1000]) {
      const n = crowdLayout(army, out);
      const half = (crowdWidth(army) * TRACK_W) / 2;
      for (let k = 0; k < n; k++)
        expect(Math.abs(out[2 * k] as number) + FIGURE_RADIUS).toBeLessThan(
          half + 1e-9,
        );
    }
  });

  it("is the same for the same army size", () => {
    const a = new Float32Array(400);
    const b = new Float32Array(400);
    crowdLayout(40, a);
    crowdLayout(77, b);
    crowdLayout(40, b);
    expect(Array.from(b.subarray(0, 80))).toEqual(
      Array.from(a.subarray(0, 80)),
    );
  });
});

describe("haze and horizons", () => {
  const poses = [pose, cameraFit(390 / 844).pose, cameraFit(1280 / 800).pose];
  const haze = (p: CameraPose, ahead: number, y: number): number =>
    hazeAt(fogRange(p), viewDepth(p, y, worldZ(ahead, 0)));

  it("is near-total at SHAPE_DISTANCE and near-none at VIEW_DISTANCE", () => {
    for (const p of poses)
      for (const y of [0, WALL_H, FOG_TOP_H]) {
        expect(haze(p, SHAPE_DISTANCE, y)).toBeGreaterThan(0.97);
        expect(haze(p, VIEW_DISTANCE, y)).toBeLessThan(0.05);
        // shapes are already gone as they cross the shape horizon: no pop-in
        expect(haze(p, SHAPE_DISTANCE + 0.01, y)).toBe(1);
      }
  });

  it("thins steadily as a shape comes closer, with no jump", () => {
    for (const p of poses) {
      let last = 1;
      for (let a = SHAPE_DISTANCE; a >= VIEW_DISTANCE; a -= 0.05) {
        const h = haze(p, a, WALL_H / 2);
        expect(h).toBeLessThanOrEqual(last);
        expect(last - h).toBeLessThan(0.03);
        last = h;
      }
    }
  });

  it("keeps SHAPE_DISTANCE below the closest a re-ask can replace a row", () => {
    expect(SHAPE_DISTANCE).toBeGreaterThan(VIEW_DISTANCE);
    expect(SHAPE_DISTANCE).toBeLessThan(
      REASK_GAP_MIN * (CALM_DISTANCE + 2 * HAZARD_SPACING),
    );
  });
});

describe("camera fit", () => {
  const sizes: [number, number][] = [
    [390, 844],
    [1280, 800],
  ];
  const viewZ = worldZ(VIEW_DISTANCE, 0);
  const farZ = worldZ(SHAPE_DISTANCE, 0);
  const pitchOf = (p: CameraPose): number =>
    (Math.atan2(p.height - p.lookHeight, p.back + p.lookAhead) * 180) / Math.PI;

  for (const [w, h] of sizes)
    it(`at ${w}×${h} puts the army in the lower third, the far line near the top and both edges in view`, () => {
      const aspect = w / h;
      const fit = cameraFit(aspect);
      const army = screenAt(fit, aspect, 0, 0, 0).y;
      const far = screenAt(fit, aspect, 0, 0, farZ).y;
      expect(army).toBeCloseTo(AIM.armyY, 6);
      expect(far).toBeCloseTo(AIM.farY, 6);
      expect(army).toBeGreaterThanOrEqual(0.66);
      expect(army).toBeLessThanOrEqual(0.76);
      expect(far).toBeGreaterThanOrEqual(0.05);
      expect(far).toBeLessThanOrEqual(0.15);
      // the read line sits between them
      const view = screenAt(fit, aspect, 0, 0, viewZ).y;
      expect(view).toBeGreaterThan(far);
      expect(view).toBeLessThan(army);
      // sky (and the hazed track beyond the far line) is about a tenth at most
      expect(far).toBeLessThanOrEqual(0.12);
      for (const x of [0, 1]) {
        const p = screenAt(fit, aspect, worldX(x), 0, 0).x;
        expect(p).toBeGreaterThan(0);
        expect(p).toBeLessThan(1);
      }
      // the biggest crowd's near edge stays on screen
      const nearZ = (CROWD_MAX_W / 2) * CROWD_DEPTH * TRACK_W;
      expect(screenAt(fit, aspect, 0, 0, nearZ).y).toBeLessThan(1);
      // real perspective: the track at the read line is narrower than at the army
      const nearW = screenAt(fit, aspect, worldX(1), 0, 0).x - 0.5;
      const farW = screenAt(fit, aspect, worldX(1), 0, viewZ).x - 0.5;
      expect(farW).toBeLessThan(nearW * 0.7);
    });

  it("keeps a 3-answer wall's outer openings on screen at 390×844 from VIEW_DISTANCE to the army", () => {
    const aspect = 390 / 844;
    const fit = cameraFit(aspect);
    const openings = gateOpenings(3);
    const outer = [openings[0], openings[2]];
    for (let ahead = 0; ahead <= VIEW_DISTANCE; ahead += 0.25)
      for (const o of outer)
        for (const x of [o?.left ?? 0, o?.right ?? 1])
          for (const y of [0, WALL_H]) {
            const p = screenAt(fit, aspect, worldX(x), y, worldZ(ahead, 0));
            expect(p.x).toBeGreaterThan(0);
            expect(p.x).toBeLessThan(1);
            expect(p.y).toBeGreaterThan(0);
            expect(p.y).toBeLessThan(1);
          }
  });

  it("is flatter than before on a phone, and closer on a wide screen", () => {
    // T1b's camera pitched 40.7° down at 390×844 and 29.7° at 1280×800
    expect(pitchOf(cameraFit(390 / 844).pose)).toBeLessThan(40.7 - 8);
    expect(pitchOf(cameraFit(1280 / 800).pose)).toBeLessThan(29.7);
  });

  it("moves the camera back (not steeper) only when the screen is too narrow", () => {
    const wide = cameraFit(1280 / 800).pose;
    const narrow = cameraFit(390 / 844).pose;
    expect(wide.height).toBe(CAMERA_MIN_HEIGHT);
    expect(narrow.height).toBeGreaterThan(CAMERA_MIN_HEIGHT);
    expect(narrow.height / narrow.back).toBeCloseTo(wide.height / wide.back, 6);
  });
});

describe("walls and their text", () => {
  const w = 390;
  const h = 844;
  const fit = cameraFit(w / h);

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

  it("matches the live camera's placement of the army and the far line", () => {
    const project = projectorFor(fit, w, h, 2);
    expect((project(0.5, 2, 0)?.y ?? 0) / h).toBeCloseTo(AIM.armyY, 6);
    expect((project(0.5, 2 + SHAPE_DISTANCE, 0)?.y ?? 0) / h).toBeCloseTo(
      AIM.farY,
      6,
    );
    expect(project(0.5, 2 - 10, 0)).toBeNull();
  });

  it("gives overlay text the haze the fog gives the object at that point", () => {
    const run = 7;
    for (const p of [pose, cameraFit(390 / 844).pose]) {
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

describe("hazards in the world", () => {
  it("draws a crate over the span the sim clips", () => {
    const { x, w } = spanWorld(0.2, 0.5);
    expect(x - w / 2).toBeCloseTo(worldX(0.2));
    expect(x + w / 2).toBeCloseTo(worldX(0.5));
  });

  it("puts a saw's disc over its sim span at every distance", () => {
    const saw: Saw = { kind: "saw", pos: 5, mid: 0.5, amp: 0.3, phase: 1 };
    for (const d of [0, 0.4, 1.1, 2.7]) {
      const s = hazardSpan(saw, d);
      const p = sawPlace(saw, d);
      expect(p.x - p.r).toBeCloseTo(worldX(s.left));
      expect(p.x + p.r).toBeCloseTo(worldX(s.right));
      expect(p.r * 2).toBeCloseTo(SAW_W * TRACK_W);
      // the rail holds the whole sweep
      expect(Math.abs(p.x - p.railX) + p.r).toBeLessThanOrEqual(
        p.railW / 2 + 1e-9,
      );
    }
  });

  it("flings burst pieces out from nothing and shrinks them away", () => {
    for (let k = 0; k < BURST_PIECES; k++) {
      const a = burstPiece(k, 0, 2);
      expect(Math.hypot(a.x, a.y, a.z)).toBe(0);
      expect(burstPiece(k, 0.9, 2).size).toBeLessThan(a.size);
    }
    expect(Math.abs(burstPiece(3, 0.5, 2).x)).toBeGreaterThan(0);
  });

  it("sends recruits off staggered, all arrived by the end", () => {
    expect(recruitProgress(0, 10, 0)).toBe(0);
    expect(recruitProgress(9, 10, 0.2)).toBe(0);
    expect(recruitProgress(0, 10, 0.3)).toBeGreaterThan(0);
    for (let k = 0; k < 10; k++) expect(recruitProgress(k, 10, 1)).toBe(1);
  });

  it("thins a pack figure by figure, the last one shrinking as it is hit", () => {
    expect(packFigureScale(0, 3)).toBe(1);
    expect(packFigureScale(2, 3)).toBe(1);
    expect(packFigureScale(3, 3)).toBe(0);
    expect(packFigureScale(2, 2.5)).toBeCloseTo(0.7);
    expect(packFigureScale(2, 2.01)).toBeLessThan(0.5);
  });
});
