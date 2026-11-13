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
  clipGaps,
  crowdHalfDepth,
  drawnCentre,
  drawnWidth,
  scaledWidth,
  spreadScale,
  spreadShare,
  stepShare,
  spreadWidth,
  SQUEEZE_DIST,
  BOSS_RANGE,
  bossShown,
  BOSS_TOP,
  bossArmyDist,
  bossFightAt,
  bossHp,
  bossPlace,
  type CameraPose,
  CAMERA_LIMITS,
  followStep,
  followTarget,
  poseFromSettings,
  DEFAULT_CAMERA,
  HAZE_MAX,
  setShapeDistance,
  shapeDistance,
  type CameraSettings,
} from "../../src/game/three/world";
import { clashAt } from "../../src/core/boss";
import {
  BASE_SPEED,
  CLASH_APPROACH_SECONDS,
  CLASH_HOLD_SECONDS,
  CLASH_SECONDS,
  MAX_SPEED_MUL,
} from "../../src/core/tuning";
import { defaultProgress } from "../../src/core/srs";
import {
  createSession,
  handleAction,
  updateScene,
  type Scene,
} from "../../src/game/scenes";
import { STEP } from "../../src/game/loop";
import { createRunState, stepRun, type RunState } from "../../src/core/sim";
import { buildTrack } from "../../src/core/track";
import { ROWS_PER_RUN } from "../../src/core/tuning";
import { kanaRun } from "../core/kana-run";
import { hazardSpan, type Saw } from "../../src/core/track";
import { AIM, cameraFor } from "../../src/game/three/view";

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

describe("crowd spread and squeeze", () => {
  const out = new Float32Array(2 * MAX_DRAWN_SOLDIERS);

  it("spreads wider than the true width on open road: ~0.1, ~0.3, 0.55 of the track", () => {
    expect(spreadWidth(5)).toBeCloseTo(0.11, 2);
    expect(spreadWidth(40)).toBeCloseTo(0.32, 2);
    expect(spreadWidth(200)).toBe(0.55);
    for (const army of [1, 5, 40, 100, 200, 1000])
      expect(spreadWidth(army)).toBeGreaterThanOrEqual(crowdWidth(army));
    expect(drawnWidth(200, Infinity, Infinity)).toBe(spreadWidth(200));
  });

  it("keeps the stretched layout inside the drawn width and on the track", () => {
    for (const army of [1, 5, 40, 200, 1000])
      for (const share of [0, 0.3, 1]) {
        const n = crowdLayout(army, out);
        const cw = crowdWidth(army);
        const w = cw + (spreadWidth(army) - cw) * share;
        const k = spreadScale(army, w);
        expect(scaledWidth(army, k)).toBeCloseTo(w, 9);
        for (const x of [cw / 2, 0.5, 1]) {
          const c = worldX(drawnCentre(x, w));
          for (let i = 0; i < n; i++) {
            const fx = c + (out[2 * i] as number) * k;
            expect(Math.abs(fx - c) + FIGURE_RADIUS).toBeLessThan(
              (w * TRACK_W) / 2 + 1e-9,
            );
            expect(fx - FIGURE_RADIUS).toBeGreaterThan(worldX(0) - 1e-9);
            expect(fx + FIGURE_RADIUS).toBeLessThan(worldX(1) + 1e-9);
          }
        }
      }
    // squeezed: exactly the sim's crowd, where the sim has it
    expect(spreadScale(40, crowdWidth(40))).toBe(1);
    expect(drawnCentre(0.2, crowdWidth(100))).toBe(0.2);
  });

  it("is exactly the true width while an obstacle is within the crowd, and continuous", () => {
    for (const army of [5, 40, 200]) {
      expect(drawnWidth(army, 0, Infinity)).toBe(crowdWidth(army));
      expect(drawnWidth(army, Infinity, 0)).toBe(crowdWidth(army));
      expect(drawnWidth(army, crowdHalfDepth(army), 5)).toBe(crowdWidth(army));
      let last = drawnWidth(army, 3, Infinity);
      for (let d = 3; d >= -3; d -= 0.01) {
        const w =
          d >= 0
            ? drawnWidth(army, d, Infinity)
            : drawnWidth(army, Infinity, -d);
        expect(Math.abs(w - last)).toBeLessThan(0.01);
        last = w;
      }
      expect(drawnWidth(army, SQUEEZE_DIST + crowdHalfDepth(army), 9)).toBe(
        spreadWidth(army),
      );
    }
  });

  it("finds every kind of obstacle: walls, charges, saws, crates and packs", () => {
    const base = createRunState(kanaRun(1), buildTrack(1, ROWS_PER_RUN));
    const run: RunState = {
      ...base,
      track: {
        questions: [10, 20],
        charges: [1],
        hazards: [
          { kind: "saw", pos: 13, mid: 0.5, amp: 0.01, phase: 0 },
          { kind: "block", pos: 15, left: 0.4, right: 0.6 },
          { kind: "pack", pos: 18, x: 0.5 },
        ],
      },
      // the pack has run in from 18 to 17
      packs: [null, null, { pos: 17, x: 0.5 }],
      hp: [0, 3, 3],
      heads: [0, 0, 15],
      damage: [0, 0, 0],
    };
    for (const pos of [10, 13, 15, 17, 20]) {
      const g = clipGaps({ ...run, dist: pos });
      expect(g.ahead).toBe(0);
      expect(drawnWidth(200, g.ahead, g.behind)).toBe(crowdWidth(200));
    }
    expect(clipGaps({ ...run, dist: 14 })).toEqual({ ahead: 1, behind: 1 });
    expect(clipGaps({ ...run, dist: 25 }).ahead).toBe(Infinity);
  });

  it("is fully squeezed in the frames either side of every contact in a real run", () => {
    for (const seed of [1, 2, 3]) {
      let s = createRunState(kanaRun(seed), buildTrack(seed, ROWS_PER_RUN));
      s = { ...s, army: 150 };
      let contacts = 0;
      while (s.status === "running" && s.dist < 200) {
        const next = stepRun(s, 1 / 60);
        // contacts that clip (walls always; hazards only if they hit)
        if (next.next !== s.next || next.lastClip !== s.lastClip) {
          contacts++;
          for (const r of [s, next]) {
            const g = clipGaps(r);
            expect(spreadShare(r.army, g.ahead, g.behind)).toBe(0);
          }
        }
        s = next;
      }
      expect(contacts).toBeGreaterThan(3);
    }
  });

  describe("only what would hit squeezes", () => {
    const base = createRunState(kanaRun(1), buildTrack(1, ROWS_PER_RUN));
    const withHazards = (
      hazards: RunState["track"]["hazards"],
      over: Partial<RunState> = {},
    ): RunState => ({
      ...base,
      army: 200,
      x: 0.5,
      dist: 0,
      track: { questions: [50], charges: [], hazards },
      hp: hazards.map(() => 3),
      heads: hazards.map(() => 15),
      damage: hazards.map(() => 0),
      packs: hazards.map(() => null),
      ...over,
    });
    const ahead = (r: RunState): number => clipGaps(r).ahead;

    it("ignores a crate, saw and pack in another lane; counts them in the crowd's path", () => {
      // a 200 crowd spreads over 0.225..0.775
      const off = withHazards(
        [
          { kind: "block", pos: 5, left: 0.05, right: 0.15 },
          { kind: "saw", pos: 8, mid: 0.9, amp: 0.02, phase: 0 },
          { kind: "pack", pos: 11, x: 0.93 },
        ],
        { packs: [null, null, { pos: 11, x: 0.93 }] },
      );
      expect(ahead(off)).toBe(50);
      const on = withHazards([
        { kind: "block", pos: 5, left: 0.45, right: 0.55 },
      ]);
      expect(ahead(on)).toBe(5);
      const saw = withHazards([
        { kind: "saw", pos: 8, mid: 0.5, amp: 0.02, phase: 0 },
      ]);
      expect(ahead(saw)).toBe(8);
      const pack = withHazards([{ kind: "pack", pos: 11, x: 0.6 }], {
        packs: [{ pos: 11, x: 0.6 }],
      });
      expect(ahead(pack)).toBe(11);
    });

    it("tests a saw where it is when the crowd reaches it, not its sweep", () => {
      // sweeps 0.1..0.9: in the crowd's lane for some phases, off it for others
      const mk = (ph: number) =>
        withHazards([{ kind: "saw", pos: 8, mid: 0.5, amp: 0.4, phase: ph }]);
      const gaps = [0, Math.PI / 4, Math.PI / 2, Math.PI, 5].map((ph) =>
        ahead(mk(ph)),
      );
      expect(gaps.some((g) => g === 8)).toBe(true);
      expect(gaps.some((g) => g === 50)).toBe(true);
    });

    it("ignores shattered crates and dead packs", () => {
      const blk = withHazards(
        [{ kind: "block", pos: 5, left: 0.4, right: 0.6 }],
        { damage: [3] },
      );
      expect(ahead(blk)).toBe(50);
      const pk = withHazards([{ kind: "pack", pos: 5, x: 0.5 }], {
        damage: [3],
        packs: [{ pos: 5, x: 0.5 }],
      });
      expect(ahead(pk)).toBe(50);
    });

    it("always counts a wall, even with nothing else", () => {
      expect(ahead(withHazards([]))).toBe(50);
    });

    it("everything the sim clips counts: crowd span inside the spread span at any x", () => {
      for (const x of [0.1, 0.3, 0.5, 0.9]) {
        const w = crowdWidth(200);
        const r = withHazards(
          [{ kind: "block", pos: 5, left: x - w / 2, right: x + w / 2 }],
          { x },
        );
        expect(ahead(r)).toBe(5);
      }
    });
  });

  describe("share easing", () => {
    const step = (p: number, a: number, b: number, n: number, dt = 1 / 60) => {
      for (let i = 0; i < n; i++) p = stepShare(p, 200, a, b, dt);
      return p;
    };
    it("stays at 1 on open road and 0 at contact", () => {
      expect(step(1, Infinity, Infinity, 60)).toBe(1);
      expect(step(1, 0, Infinity, 1)).toBe(0);
      expect(step(1, crowdHalfDepth(200), Infinity, 1)).toBe(0);
      expect(step(1, Infinity, 0, 1)).toBe(0);
    });
    it("follows a normal approach continuously and reaches 0 by contact", () => {
      let p = 1;
      let last = 1;
      const speed = 3; // track units per second, fast
      for (let d = 5; d > 0; d -= speed / 60) {
        p = stepShare(p, 200, d, Infinity, 1 / 60);
        expect(Math.abs(p - last)).toBeLessThan(0.1);
        last = p;
      }
      expect(p).toBe(0);
    });
    it("eases (no snap) when a hazard is destroyed mid-squeeze, and when steering off/into it", () => {
      const hold = crowdHalfDepth(200);
      const mid = hold + SQUEEZE_DIST / 2;
      const squeezed = spreadShare(200, mid, Infinity);
      // gone: target 1, the share rises at the easing rate only
      const up = stepShare(squeezed, 200, Infinity, Infinity, 1 / 60);
      expect(up - squeezed).toBeGreaterThan(0);
      expect(up - squeezed).toBeLessThan(0.05);
      // it reappears (steered into): comes in fast but not at once
      const down = stepShare(1, 200, mid, Infinity, 1 / 60);
      expect(1 - down).toBeGreaterThan(0);
      expect(1 - down).toBeLessThan(0.14);
      // yet never late: within the crowd's depth it is 0 regardless
      expect(stepShare(1, 200, hold, Infinity, 1 / 60)).toBe(0);
    });
    it("a paused frame (dt 0) changes nothing", () => {
      expect(stepShare(0.4, 200, Infinity, Infinity, 0)).toBe(0.4);
    });
  });
});

describe("haze and horizons", () => {
  const poses = [pose, cameraFor(null).pose, cameraFor(null).pose];
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

describe("default camera", () => {
  const sizes: [number, number][] = [
    [390, 844],
    [1280, 800],
  ];
  const viewZ = worldZ(VIEW_DISTANCE, 0);
  const pitchOf = (p: CameraPose): number =>
    (Math.atan2(p.height - p.lookHeight, p.back + p.lookAhead) * 180) / Math.PI;

  it("is the owner's pick: pitch 8, distance 15, FOV 34, follow 0.4, smoothing 1", () => {
    expect(DEFAULT_CAMERA).toMatchObject({
      pitch: 8,
      distance: 15,
      fov: 34,
      follow: 0.4,
      smoothing: 1,
    });
    const fit = cameraFor(null);
    expect(fit).toEqual(poseFromSettings(DEFAULT_CAMERA, AIM.armyY));
    expect(pitchOf(fit.pose)).toBeCloseTo(8, 9);
    expect(Math.hypot(fit.pose.height, fit.pose.back)).toBeCloseTo(15, 9);
    expect(fit.fov).toBe(34);
  });

  for (const [w, h] of sizes)
    it(`at ${w}×${h} puts the army 80% down and the read line above it`, () => {
      const aspect = w / h;
      const fit = cameraFor(null);
      const army = screenAt(fit, aspect, 0, 0, 0).y;
      expect(army).toBeCloseTo(0.8, 6);
      const view = screenAt(fit, aspect, 0, 0, viewZ).y;
      expect(view).toBeLessThan(army);
      expect(view).toBeGreaterThan(0.2);
      // the far line (the shape horizon) is above the read line, below the top
      const far = screenAt(fit, aspect, 0, 0, worldZ(SHAPE_DISTANCE, 0)).y;
      expect(far).toBeLessThan(view);
      expect(far).toBeGreaterThan(0);
      // the biggest crowd's near edge stays on screen
      const nearZ = (CROWD_MAX_W / 2) * CROWD_DEPTH * TRACK_W;
      expect(screenAt(fit, aspect, 0, 0, nearZ).y).toBeLessThan(1);
      // real perspective: the track at the read line is narrower than at the army
      const nearW = screenAt(fit, aspect, worldX(1), 0, 0).x - 0.5;
      const farW = screenAt(fit, aspect, worldX(1), 0, viewZ).x - 0.5;
      expect(farW).toBeLessThan(nearW * 0.9);
    });

  it("matches the owner's measurements at 390×844 (height 4.7, back 14.2)", () => {
    const { pose } = cameraFor(null);
    expect(pose.height).toBeCloseTo(4.73, 1);
    expect(pose.back).toBeCloseTo(14.23, 1);
  });

  it("spreads the haze over most of the screen: the gate at VIEW_DISTANCE is well below the horizon", () => {
    const fit = cameraFor(null);
    const at = (d: number): number =>
      screenAt(fit, 390 / 844, 0, 0, worldZ(d, 0)).y;
    // clear at the read line, total at the shape horizon: a wide band, not a sliver
    expect(at(VIEW_DISTANCE) - at(SHAPE_DISTANCE)).toBeGreaterThan(0.08);
  });
});

describe("walls and their text", () => {
  const w = 390;
  const h = 844;
  const fit = cameraFor(null);

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
    for (const p of [pose, cameraFor(null).pose]) {
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
    const session = createSession(defaultProgress(), null);
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
    const haze = hazeFor(cameraFor(null).pose, 0);
    expect(haze(bossShown(), BOSS_TOP)).toBe(1);
    expect(haze(bossShown(), 0)).toBe(1);
    expect(haze(BOSS_RANGE, BOSS_TOP)).toBe(0);
  });

  it("is whole on screen at the firing stop, with room for its HP above", () => {
    for (const aspect of [390 / 844, 1280 / 800]) {
      const fit = cameraFor(null);
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

describe("camera settings", () => {
  const aspects = [390 / 844, 1280 / 800];

  it("keeps the army at the aim height and the chosen pitch, FOV and distance", () => {
    const s: CameraSettings = {
      pitch: 20,
      distance: 12,
      fov: 50,
      follow: 0,
      smoothing: 0.2,
      haze: 10,
    };
    const fit = poseFromSettings(s, AIM.armyY);
    const { pose } = fit;
    for (const a of aspects)
      expect(screenAt(fit, a, 0, 0, 0).y).toBeCloseTo(AIM.armyY, 6);
    expect(Math.hypot(pose.height, pose.back)).toBeCloseTo(12, 9);
    expect(
      (Math.atan2(pose.height, pose.back + pose.lookAhead) * 180) / Math.PI,
    ).toBeCloseTo(20, 9);
    expect(fit.fov).toBe(50);
  });

  it("keeps the haze total at the horizon in use and clear at VIEW_DISTANCE across tuned extremes", () => {
    const d = DEFAULT_CAMERA;
    for (const pitch of [3, 8, 45])
      for (const distance of [6, 15, 60])
        for (const fov of [20, 34, 75])
          for (const horizon of [VIEW_DISTANCE + 1, SHAPE_DISTANCE, HAZE_MAX]) {
            const { pose } = poseFromSettings(
              { ...d, pitch, distance, fov },
              AIM.armyY,
            );
            const range = fogRange(pose, horizon);
            expect(range.far).toBeGreaterThan(range.near);
            for (const y of [0, WALL_H, FOG_TOP_H]) {
              const at = (dist: number): number =>
                hazeAt(range, viewDepth(pose, y, worldZ(dist, 0)));
              expect(at(horizon)).toBeGreaterThan(0.97);
              expect(at(VIEW_DISTANCE)).toBeLessThan(0.05);
            }
          }
  });

  it("has the default haze at SHAPE_DISTANCE, 4 × VIEW_DISTANCE, below the re-ask gap and the slider's maximum", () => {
    expect(DEFAULT_CAMERA.haze).toBe(SHAPE_DISTANCE);
    expect(SHAPE_DISTANCE).toBe(4 * VIEW_DISTANCE);
    expect(shapeDistance()).toBe(SHAPE_DISTANCE);
    expect(SHAPE_DISTANCE).toBeLessThan(HAZE_MAX);
    expect(HAZE_MAX).toBeLessThan(
      REASK_GAP_MIN * (CALM_DISTANCE + 2 * HAZARD_SPACING),
    );
    expect(CAMERA_LIMITS.haze).toEqual({
      min: VIEW_DISTANCE + 1,
      max: HAZE_MAX,
    });
  });

  it("sets the live shape horizon within the slider's range", () => {
    try {
      setShapeDistance(15);
      expect(shapeDistance()).toBe(15);
      expect(bossShown()).toBe(16);
      setShapeDistance(100);
      expect(shapeDistance()).toBe(HAZE_MAX);
      setShapeDistance(0);
      expect(shapeDistance()).toBe(VIEW_DISTANCE + 1);
    } finally {
      setShapeDistance(SHAPE_DISTANCE);
    }
  });

  it("offers the wider slider ranges around the defaults", () => {
    expect(CAMERA_LIMITS.pitch.min).toBe(3);
    expect(CAMERA_LIMITS.smoothing.max).toBe(2);
    expect(CAMERA_LIMITS.distance).toEqual({ min: 6, max: 60 });
    for (const k of [
      "pitch",
      "distance",
      "fov",
      "follow",
      "smoothing",
      "haze",
    ] as const) {
      expect(DEFAULT_CAMERA[k]).toBeGreaterThanOrEqual(CAMERA_LIMITS[k].min);
      expect(DEFAULT_CAMERA[k]).toBeLessThanOrEqual(CAMERA_LIMITS[k].max);
    }
  });
});

describe("camera follow", () => {
  it("targets follow × the army's world x", () => {
    expect(followTarget(0, 1)).toBe(0);
    expect(followTarget(1, 1)).toBeCloseTo(worldX(1), 9);
    expect(followTarget(0.6, 0)).toBeCloseTo(0.6 * worldX(0), 9);
    expect(followTarget(1, 0.5)).toBeCloseTo(0, 9);
  });

  it("follow 0 keeps the camera at x = 0 and follow 1 settles on the army", () => {
    let x0 = 0;
    let x1 = 0;
    for (let i = 0; i < 600; i++) {
      x0 = followStep(x0, followTarget(0, 1), 1 / 60, 0.3);
      x1 = followStep(x1, followTarget(1, 1), 1 / 60, 0.3);
    }
    expect(x0).toBe(0);
    expect(x1).toBeCloseTo(worldX(1), 6);
  });

  it("snaps at 0 smoothing, and is continuous: a tiny step moves a tiny way", () => {
    expect(followStep(0, 3, 1 / 60, 0)).toBe(3);
    expect(followStep(0, 3, 0, 0.3)).toBe(0);
    expect(Math.abs(followStep(1, 3, 1e-6, 0.3) - 1)).toBeLessThan(1e-4);
  });

  it("is the same at 30 and 60 fps", () => {
    let a = 0;
    let b = 0;
    for (let i = 0; i < 30; i++) a = followStep(a, 2, 1 / 30, 0.5);
    for (let i = 0; i < 60; i++) b = followStep(b, 2, 1 / 60, 0.5);
    expect(a).toBeCloseTo(b, 9);
    // most of the gap (95%) closes in the smoothing time
    expect(followStep(0, 1, 0.5, 0.5)).toBeCloseTo(0.95, 2);
  });
});
