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
  Scene as ThreeScene,
  Vector3,
  WebGLRenderer,
} from "three";
import type { Scene } from "../scenes";
import { fitCamera, LOOK, makeCamera, MAX_DPR, POSE } from "./view";
import {
  DIST_SCALE,
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
  const fog = fogRange(POSE);
  scene.fog = new Fog(LOOK.sky, fog.near, fog.far);

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

  let w = 1;
  let h = 1;
  let runDist = 0;
  const v = new Vector3();
  return {
    resize(cw, ch) {
      w = cw;
      h = ch;
      renderer.setSize(cw, ch, false);
      fitCamera(camera, cw / ch);
    },
    render(s) {
      runDist = s.run.dist;
      layDashes(runDist);
      renderer.render(scene, camera);
    },
    project(x, dist, height) {
      v.set(worldX(x), height, worldZ(dist, runDist)).project(camera);
      if (v.z > 1) return null;
      return { x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h };
    },
  };
}
