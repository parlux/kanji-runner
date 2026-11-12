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
import { fitCamera, LOOK, makeCamera, MAX_DPR } from "./view";
import { makeCrowdMesh, type FigureKind } from "./figures";
import { createWalls } from "./walls";
import { createSquads } from "./squads";
import { createFx } from "./fx";
import { createProps } from "./props";
import {
  crowdLayout,
  DIST_SCALE,
  MAX_DRAWN_SOLDIERS,
  fogRange,
  TRACK_W,
  worldX,
  worldZ,
  type Projector,
} from "./world";

export type View3d = {
  resize(w: number, h: number): void;
  /** Draws the run or the boss clash; the scene is only read. */
  render(scene: Extract<Scene, { kind: "run" | "boss" }>): void;
  /** Projects with the camera of the last render. */
  project: Projector;
};

/** Track length drawn ahead of and behind the army (world units); it runs on into the fog. */
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

/** A cheap fixed pseudo-random number in [0, 1) per figure index, for its stride phase. */
const phaseOf = (k: number): number => {
  const x = Math.sin(k * 12.9898 + 4.1414) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * An animated crowd of figures: laid out by `crowdLayout`, bobbing as it runs.
 * New figures scale in at the edge; lost ones fall back and shrink away.
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
  const pos = new Vector3();
  const scl = new Vector3();
  const rot = new Euler();
  const q = new Quaternion();
  const m = new Matrix4();

  return {
    mesh,
    /** Places the crowd centred at world (cx, 0, cz) at animation time `now` (s); `dt` eases layout changes. */
    update(army: number, cx: number, cz: number, now: number, dt: number) {
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
        const x = cx + (cur[2 * k] as number);
        const z = cz + (cur[2 * k + 1] as number);
        const stride = (now * STRIDE_HZ + phaseOf(k)) * Math.PI * 2;
        if (alive[k]) {
          const g = Math.min(1, (now - (bornAt[k] as number)) / GROW_S);
          // ease out with a little overshoot, so a new figure pops in
          const s = 1 + 2.2 * (g - 1) ** 3 + 1.2 * (g - 1) ** 2;
          pos.set(x, Math.abs(Math.sin(stride)) * HOP, z);
          rot.set(-LEAN, 0, Math.sin(stride) * SWAY);
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
  const fog = new Fog(LOOK.sky, 1, 2);
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
  const army = createCrowd("soldier");
  scene.add(army.mesh);

  let w = 1;
  let h = 1;
  let runDist = 0;
  // animation time: stands still while the run is paused
  let clock = 0;
  let last = performance.now();
  const v = new Vector3();
  return {
    resize(cw, ch) {
      w = cw;
      h = ch;
      renderer.setSize(cw, ch, false);
      const range = fogRange(fitCamera(camera, cw / ch).pose);
      fog.near = range.near;
      fog.far = range.far;
    },
    render(s) {
      const now = performance.now();
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const paused = s.kind === "run" && s.paused;
      if (!paused) clock += dt;
      runDist = s.run.dist;
      layDashes(runDist);
      fx.begin();
      if (s.kind === "run") {
        walls.update(s.run);
        squads.update(s.run, clock);
        props.update(s.run);
      }
      fx.end();
      army.update(s.run.army, worldX(s.run.x), 0, clock, paused ? 0 : dt);
      renderer.render(scene, camera);
    },
    project(x, dist, height) {
      v.set(worldX(x), height, worldZ(dist, runDist)).project(camera);
      if (v.z > 1) return null;
      return { x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h };
    },
  };
}
