import {
  BoxGeometry,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshLambertMaterial,
  PlaneGeometry,
  Euler,
  Quaternion,
  Scene as ThreeScene,
  Vector3,
  WebGLRenderer,
} from "three";
import type { Scene } from "../scenes";
import {
  cameraFor,
  defaultCameraSettings,
  fitCamera,
  LOOK,
  makeCamera,
  MAX_DPR,
} from "./view";
import { makeCrowdMesh, type FigureKind } from "./figures";
import { createWalls } from "./walls";
import { createSquads } from "./squads";
import { createFx } from "./fx";
import { createProps } from "./props";
import { createHazards } from "./hazards";
import { createBoss } from "./boss";
import {
  clipGaps,
  crowdLayout,
  drawnCentre,
  scaledWidth,
  spreadScale,
  stepShare,
  spreadWidth,
  DIST_SCALE,
  MAX_DRAWN_SOLDIERS,
  fogRange,
  followStep,
  followTarget,
  TRACK_W,
  worldX,
  worldZ,
  type CameraFit,
  type CameraSettings,
  type Haze,
  type Projector,
  hazeFor,
  bossArmyDist,
  bossFightAt,
  bossHp,
  bossPlace,
  type BossView,
} from "./world";

export type View3d = {
  resize(w: number, h: number): void;
  /** Draws the run or the boss clash at speed preset `pace`; the scene is only read. */
  render(scene: Extract<Scene, { kind: "run" | "boss" }>, pace?: number): void;
  /** The boss as the last render drew it, for its HP in the overlay. */
  boss(): BossView;
  /** Projects with the camera of the last render. */
  project: Projector;
  /** Haze at a track point, as the fog gives the scene (for the overlay text). */
  haze: Haze;
  /** Tuned camera settings, or null for today's fitted camera. */
  setCamera(settings: CameraSettings | null): void;
  /** Today's camera for the current screen, as settings (the settings screen's start). */
  cameraDefaults(): CameraSettings;
};

/** Track length drawn ahead of and behind the army (world units); it runs on into the haze. */
const TRACK_AHEAD = 260;
const TRACK_BEHIND = 30;
/** Lane markings: dashes this long, this far apart, on lines at these track x. */
const DASH_LEN = 2.2;
const DASH_GAP = 6;
const DASH_LINES = [1 / 3, 2 / 3];
const EDGE_W = 0.35;
const EDGE_H = 0.25;

/** Run cycle: strides per second, hop height, forward lean and side sway (radians). */
const STRIDE_HZ = 2.4;
const HOP = 0.07;
const LEAN = 0.18;
const SWAY = 0.1;
/** Seconds a new figure takes to scale in, and a lost one to fall and shrink away. */
const GROW_S = 0.35;
const DROP_S = 0.45;
/** How fast figures ease to their new place when the crowd's layout changes (per second). */
const SETTLE_RATE = 8;
/** How fast the crowd's run cycle eases out when it stops to fire at the boss (per second). */
const HALT_RATE = 6;

/** A cheap fixed pseudo-random number in [0, 1) per figure index, for its stride phase. */
const phaseOf = (k: number): number => {
  const x = Math.sin(k * 12.9898 + 4.1414) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * An animated crowd of figures: laid out by `crowdLayout`, bobbing as it runs.
 * New figures scale in at the edge; lost ones fall back and shrink away.
 * On open road it spreads sideways (`share` of the way to
 * `spreadWidth`), squeezed back to the true width at what would clip it.
 * Purely visual: the army size passed in is the truth.
 */
function createCrowd(kind: FigureKind) {
  const max = MAX_DRAWN_SOLDIERS;
  const mesh = makeCrowdMesh(kind, max);
  const target = new Float32Array(2 * max);
  const cur = new Float32Array(2 * max);
  const bornAt = new Float32Array(max);
  const diedAt = new Float32Array(max).fill(-Infinity);
  const alive = new Uint8Array(max);
  let lastArmy = -1;
  // the open-road stretch, eased so an army change never jumps the width
  let stretch = 1;
  const pos = new Vector3();
  const scl = new Vector3();
  const rot = new Euler();
  const q = new Quaternion();
  const m = new Matrix4();

  return {
    mesh,
    /**
     * Places the crowd for an army centred at track x `x` (world Z `cz`),
     * `share` spread out, at animation time `now` (s); `dt` eases layout changes.
     * `running` (0..1) scales the run cycle: 0 stands still.
     */
    update(
      army: number,
      x0: number,
      cz: number,
      share: number,
      now: number,
      dt: number,
      running = 1,
    ) {
      if (army !== lastArmy) {
        lastArmy = army;
        const n = crowdLayout(army, target);
        for (let k = 0; k < max; k++) {
          if (k < n && !alive[k]) {
            alive[k] = 1;
            bornAt[k] = now;
            cur[2 * k] = target[2 * k] as number;
            cur[2 * k + 1] = target[2 * k + 1] as number;
          } else if (k >= n && alive[k]) {
            alive[k] = 0;
            diedAt[k] = now;
          }
        }
      }
      const ease = 1 - Math.exp(-SETTLE_RATE * dt);
      stretch += (spreadScale(army, spreadWidth(army)) - stretch) * ease;
      // exactly the true width (and centre) when squeezed
      const sx = 1 + (stretch - 1) * share;
      const cx = worldX(drawnCentre(x0, scaledWidth(army, sx)));
      let i = 0;
      for (let k = 0; k < max; k++) {
        const dying = !alive[k] && now - (diedAt[k] as number) < DROP_S;
        if (!alive[k] && !dying) continue;
        if (alive[k]) {
          const tx = target[2 * k] as number;
          const tz = target[2 * k + 1] as number;
          cur[2 * k] =
            (cur[2 * k] as number) + (tx - (cur[2 * k] as number)) * ease;
          cur[2 * k + 1] =
            (cur[2 * k + 1] as number) +
            (tz - (cur[2 * k + 1] as number)) * ease;
        }
        const x = cx + (cur[2 * k] as number) * sx;
        const z = cz + (cur[2 * k + 1] as number);
        const stride = (now * STRIDE_HZ + phaseOf(k)) * Math.PI * 2;
        if (alive[k]) {
          const g = Math.min(1, (now - (bornAt[k] as number)) / GROW_S);
          // ease out with a little overshoot, so a new figure pops in
          const s = 1 + 2.2 * (g - 1) ** 3 + 1.2 * (g - 1) ** 2;
          pos.set(x, Math.abs(Math.sin(stride)) * HOP * running, z);
          rot.set(-LEAN * running, 0, Math.sin(stride) * SWAY * running);
          scl.setScalar(s);
        } else {
          // left behind as the crowd runs on: tips over backwards and shrinks
          const t = (now - (diedAt[k] as number)) / DROP_S;
          pos.set(x, -0.15 * t, z + 2.5 * t);
          rot.set(t * 1.4, 0, 0);
          scl.setScalar(1 - t);
        }
        q.setFromEuler(rot);
        m.compose(pos, q, scl);
        mesh.setMatrixAt(i++, m);
      }
      mesh.count = i;
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

/**
 * Creates the 3D view on `canvas`, or returns null when WebGL is unavailable
 * (the 2D renderer is used then).
 */
export function createView3d(canvas: HTMLCanvasElement): View3d | null {
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(MAX_DPR, window.devicePixelRatio || 1));
  const camera = makeCamera();
  const scene = new ThreeScene();
  scene.background = new Color(LOOK.sky);
  const fog = new Fog(LOOK.haze, 1, 2);
  scene.fog = fog;

  scene.add(new HemisphereLight(0xffffff, 0x8aa070, 1.6));
  const sun = new DirectionalLight(0xffffff, 1.8);
  sun.position.set(-4, 10, 6);
  scene.add(sun);

  const length = TRACK_AHEAD + TRACK_BEHIND;
  const centreZ = (TRACK_BEHIND - TRACK_AHEAD) / 2;
  const ground = new Mesh(
    new PlaneGeometry(400, length),
    new MeshLambertMaterial({ color: LOOK.ground }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.02, centreZ);
  scene.add(ground);

  const track = new Mesh(
    new PlaneGeometry(TRACK_W, length),
    new MeshLambertMaterial({ color: LOOK.track }),
  );
  track.rotation.x = -Math.PI / 2;
  track.position.set(0, 0, centreZ);
  scene.add(track);

  // a raised kerb along each edge
  const edgeGeo = new BoxGeometry(EDGE_W, EDGE_H, length);
  const edgeMat = new MeshLambertMaterial({ color: LOOK.edge });
  for (const side of [-1, 1]) {
    const edge = new Mesh(edgeGeo, edgeMat);
    edge.position.set(side * (TRACK_W / 2 + EDGE_W / 2), EDGE_H / 2, centreZ);
    scene.add(edge);
  }

  // dashed lane lines, scrolled by the run's distance so speed reads
  const period = DASH_LEN + DASH_GAP;
  const perLine = Math.ceil(length / period) + 1;
  const dashes = new InstancedMesh(
    new BoxGeometry(0.18, 0.02, DASH_LEN),
    new MeshLambertMaterial({ color: LOOK.marking }),
    perLine * DASH_LINES.length,
  );
  scene.add(dashes);
  const m = new Matrix4();
  const layDashes = (dist: number): void => {
    const shift = (dist * DIST_SCALE) % period;
    let i = 0;
    for (const lx of DASH_LINES)
      for (let k = 0; k < perLine; k++) {
        m.makeTranslation(worldX(lx), 0.01, TRACK_BEHIND - k * period + shift);
        dashes.setMatrixAt(i++, m);
      }
    dashes.instanceMatrix.needsUpdate = true;
  };

  const walls = createWalls(scene);
  const fx = createFx(scene);
  const squads = createSquads(scene, fx);
  const props = createProps(scene);
  const hazards = createHazards(scene, fx);
  const army = createCrowd("soldier");
  scene.add(army.mesh);
  const boss = createBoss(scene, fx);

  let w = 1;
  let h = 1;
  let runDist = 0;
  // how spread out the crowd is (1 open road, 0 squeezed), eased over time
  let share = 1;
  let tuned: CameraSettings | null = null;
  let fit: CameraFit = cameraFor(1, null);
  // the camera's sideways position (world X), eased towards the follow target
  let camX = 0;
  let pose = fit.pose;
  // the crowd's run cycle (1 running, 0 stopped at the boss), eased
  let running = 1;
  let bossView: BossView = {
    dist: Infinity,
    height: 0,
    hp: 0,
    size: 0,
    armyDist: 0,
    alpha: 1,
  };
  let haze: Haze = hazeFor(pose, 0);
  // animation time: stands still while the run is paused
  let clock = 0;
  let last = performance.now();
  const v = new Vector3();
  // poses the camera for the screen and settings; the haze follows the pose
  const refit = (): void => {
    fit = cameraFor(w / h, tuned);
    pose = fit.pose;
    fitCamera(camera, w / h, fit, camX);
    const range = fogRange(pose);
    fog.near = range.near;
    fog.far = range.far;
  };
  return {
    resize(cw, ch) {
      w = cw;
      h = ch;
      renderer.setSize(cw, ch, false);
      refit();
    },
    setCamera(settings) {
      tuned = settings;
      refit();
    },
    cameraDefaults: () => defaultCameraSettings(w / h),
    render(s, pace = 1) {
      const now = performance.now();
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const paused = s.kind === "run" && s.paused;
      if (!paused) clock += dt;
      const place = bossPlace(s.run.track, pace);
      const size = s.kind === "boss" ? s.boss : bossHp(s.run, s.seed);
      // in the boss scene the army runs on to the firing stop, the fight as clashAt has it
      const fight =
        s.kind === "boss" ? bossFightAt(s.run.army, s.boss, s.t) : null;
      const run =
        s.kind === "boss"
          ? {
              ...s.run,
              dist: bossArmyDist(s.run.dist, s.run.track, pace, s.t),
              army: fight?.army ?? 0,
              target: null,
              gateTarget: null,
            }
          : s.run;
      runDist = run.dist;
      // the run follows the army sideways; the boss scene eases back to centre
      const follow = tuned?.follow ?? 0;
      camX = followStep(
        camX,
        s.kind === "run" ? followTarget(follow, s.run.x) : 0,
        dt,
        tuned?.smoothing ?? 0,
      );
      fitCamera(camera, w / h, fit, camX);
      haze = hazeFor(pose, runDist);
      layDashes(runDist);
      fx.begin();
      walls.update(run);
      const fighting = squads.update(run, clock);
      props.update(run);
      hazards.update(
        run,
        clock,
        fighting || (fight !== null && run.dist >= place.stop),
        place.boss,
      );
      const top = boss.update(
        place.boss,
        place.stop,
        runDist,
        run.x,
        run.army,
        fight,
        clock,
      );
      fx.end();
      const toppled = fight?.ending?.kind === "topple" ? fight.ending.u : 0;
      bossView = {
        dist: top.dist,
        height: top.height,
        hp: fight?.hp ?? size,
        size,
        armyDist: runDist,
        alpha: 1 - Math.min(1, toppled * 2),
      };
      const gaps = clipGaps(run);
      const pdt = paused ? 0 : dt;
      share = stepShare(share, run.army, gaps.ahead, gaps.behind, pdt);
      const halted = fight !== null && run.dist >= place.stop;
      running +=
        ((halted ? 0 : 1) - running) * (1 - Math.exp(-HALT_RATE * pdt));
      army.update(run.army, run.x, 0, share, clock, pdt, running);
      renderer.render(scene, camera);
    },
    boss: () => bossView,
    haze: (dist, height) => haze(dist, height),
    project(x, dist, height) {
      v.set(worldX(x), height, worldZ(dist, runDist)).project(camera);
      if (v.z > 1) return null;
      return { x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h };
    },
  };
}
