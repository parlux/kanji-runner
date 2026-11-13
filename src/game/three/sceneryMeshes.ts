import {
  BackSide,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Euler,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Points,
  PointsMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
  type Scene,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  builtLooks,
  DRIFT_WRAP,
  FENCE_STEP,
  LOOKS,
  petalX,
  petalY,
  petalZ,
  wrap,
  wrapZ,
  type Petal,
  type Look,
  type LookId,
  type Part,
  type Shape,
} from "./scenery";

/**
 * Meshes for the scenery looks in `scenery.ts`: every built look is made once,
 * one instanced mesh per shape and layer, and shown by visibility. `update`
 * scrolls the props and drifts the backdrop by writing instance translations
 * in place (no allocation per frame). Plus the gradient sky dome.
 */

/** Sky dome radius: inside the camera's far plane, centred on the camera. */
const SKY_R = 360;
/** Light every cloud puff gives off, on top of the sun's. */
const CLOUD_GLOW = 0x8a96a8;
/** Petals: a blossom pink, this big (world units). */
const PETAL_COLOUR = 0xff9ec0;
const PETAL_SIZE = 0.25;
/** Props beyond the haze are parked out of sight this far down. */
const PARKED_Y = -1e4;

/** Each shape's unit geometry, made once and shared by every look. */
function shapeGeometry(shape: Shape): BufferGeometry {
  switch (shape) {
    case "trunk":
      // base at y = 0
      return new CylinderGeometry(0.22, 0.3, 1.4, 5).translate(0, 0.7, 0);
    case "crown":
    case "bush":
      return new IcosahedronGeometry(1, 0);
    case "pine":
      return new ConeGeometry(1.3, 3.2, 6);
    case "fence": {
      // a post and two rails, the rails one section long towards −Z
      const post = new BoxGeometry(0.18, 0.9, 0.18).translate(0, 0.45, 0);
      const rail = (y: number) =>
        new BoxGeometry(0.08, 0.1, FENCE_STEP).translate(0, y, -FENCE_STEP / 2);
      return mergeGeometries([post, rail(0.7), rail(0.4)]);
    }
    case "hill":
    case "puff":
      return new IcosahedronGeometry(1, 1);
    case "box":
      // a unit box standing on y = 0
      return new BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    case "roof":
      // a four-sided pyramid on y = 0, its edges square with a box's
      return new ConeGeometry(1, 1, 4)
        .rotateY(Math.PI / 4)
        .translate(0, 0.5, 0);
    case "peak":
      return new ConeGeometry(1, 1, 7);
    case "sun":
      return new CircleGeometry(1, 32);
  }
}

type Layer = {
  mesh: InstancedMesh;
  /** Each instance's starting Z and resting Y (props) or starting X and drift (backdrop). */
  a: Float32Array;
  b: Float32Array;
};

/** One instanced mesh for `parts` (all one shape), coloured per instance. */
function instanced(
  geometry: BufferGeometry,
  material: MeshLambertMaterial,
  parts: Part[],
): InstancedMesh {
  const mesh = new InstancedMesh(geometry, material, parts.length);
  const m = new Matrix4();
  const q = new Quaternion();
  const e = new Euler();
  const p = new Vector3();
  const s = new Vector3();
  const c = new Color();
  parts.forEach((part, i) => {
    q.setFromEuler(e.set(0, part.rot, 0));
    m.compose(
      p.set(part.x, part.y, part.z),
      q,
      s.set(part.sx, part.sy, part.sz),
    );
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, c.setHex(part.colour));
  });
  // instances move every frame: the mesh's bounds would go stale
  mesh.frustumCulled = false;
  return mesh;
}

const byShape = (parts: Part[]): Map<Shape, Part[]> => {
  const out = new Map<Shape, Part[]>();
  for (const p of parts) {
    const list = out.get(p.shape) ?? [];
    list.push(p);
    out.set(p.shape, list);
  }
  return out;
};

type PetalLayer = { petals: Petal[]; points: Points };
type LookMeshes = {
  group: Group;
  props: Layer[];
  drifting: Layer[];
  petals: PetalLayer | null;
};

export type Scenery = {
  /** Shows look `id` (hiding the others) and returns it. */
  show(id: LookId): Look;
  /**
   * Scrolls the shown look's props to the army at `runDist` (hidden past
   * world Z `cullZ`), drifts its backdrop by `clock` (s), and centres the sky
   * on the camera at `eye`.
   */
  update(runDist: number, clock: number, cullZ: number, eye: Vector3): void;
};

/** Builds the sky dome and every built look into `scene`, all hidden until `show`. */
export function createScenery(scene: Scene): Scenery {
  const skyGeo = new SphereGeometry(SKY_R, 32, 16);
  const skyCols = new Float32Array(skyGeo.getAttribute("position").count * 3);
  skyGeo.setAttribute("color", new BufferAttribute(skyCols, 3));
  const sky = new Mesh(
    skyGeo,
    new MeshBasicMaterial({
      vertexColors: true,
      side: BackSide,
      fog: false,
      depthWrite: false,
    }),
  );
  // drawn first, behind everything
  sky.renderOrder = -1;
  scene.add(sky);

  const paintSky = ({ top, horizon, below }: Look["sky"]): void => {
    const t = new Color(top);
    const h = new Color(horizon);
    const b = new Color(below);
    const c = new Color();
    const pos = skyGeo.getAttribute("position");
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / SKY_R;
      if (y >= 0) c.copy(h).lerp(t, Math.pow(Math.min(1, y * 3.2), 0.7));
      else c.copy(h).lerp(b, Math.min(1, -y * 6));
      c.toArray(skyCols, i * 3);
    }
    skyGeo.getAttribute("color").needsUpdate = true;
  };

  const geometries = new Map<Shape, BufferGeometry>();
  const geometry = (shape: Shape): BufferGeometry => {
    let g = geometries.get(shape);
    if (!g) geometries.set(shape, (g = shapeGeometry(shape)));
    return g;
  };
  const fogged = new MeshLambertMaterial({ flatShading: true });
  const clear = new MeshLambertMaterial({ flatShading: true, fog: false });
  // clouds glow a little, so their shaded undersides stay light
  const glowing = new MeshLambertMaterial({
    flatShading: true,
    fog: false,
    emissive: CLOUD_GLOW,
  });

  const petalMaterial = new PointsMaterial({
    color: PETAL_COLOUR,
    size: PETAL_SIZE,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });

  const looks = new Map<LookId, LookMeshes>();
  for (const id of builtLooks()) {
    const look = LOOKS[id];
    if (!look) continue;
    const { props, backdrop, petals } = look.layout();
    const group = new Group();
    group.visible = false;
    const meshes: LookMeshes = {
      group,
      props: [],
      drifting: [],
      petals: null,
    };
    for (const [shape, parts] of byShape(props)) {
      const mesh = instanced(geometry(shape), fogged, parts);
      group.add(mesh);
      meshes.props.push({
        mesh,
        a: Float32Array.from(parts, (p) => p.z),
        b: Float32Array.from(parts, (p) => p.y),
      });
    }
    for (const [shape, parts] of byShape(backdrop)) {
      const mesh = instanced(
        geometry(shape),
        shape === "puff" || shape === "sun" ? glowing : clear,
        parts,
      );
      group.add(mesh);
      if (parts.some((p) => p.drift !== 0))
        meshes.drifting.push({
          mesh,
          a: Float32Array.from(parts, (p) => p.x),
          b: Float32Array.from(parts, (p) => p.drift),
        });
    }
    if (petals.length > 0) {
      const geo = new BufferGeometry();
      geo.setAttribute(
        "position",
        new BufferAttribute(new Float32Array(petals.length * 3), 3),
      );
      const points = new Points(geo, petalMaterial);
      points.frustumCulled = false;
      group.add(points);
      meshes.petals = { petals, points };
    }
    scene.add(group);
    looks.set(id, meshes);
  }

  let shown: LookMeshes | null = null;
  return {
    show(id) {
      const look = LOOKS[id];
      const meshes = looks.get(id);
      if (!look || !meshes) throw new Error(`Scenery look not built: ${id}`);
      if (shown) shown.group.visible = false;
      shown = meshes;
      shown.group.visible = true;
      paintSky(look.sky);
      return look;
    },
    update(runDist, clock, cullZ, eye) {
      sky.position.copy(eye);
      if (!shown) return;
      for (const { mesh, a, b } of shown.props) {
        const e = mesh.instanceMatrix.array;
        for (let i = 0; i < a.length; i++) {
          const z = wrapZ(a[i] as number, runDist);
          e[i * 16 + 13] = z < cullZ ? PARKED_Y : (b[i] as number);
          e[i * 16 + 14] = z;
        }
        mesh.instanceMatrix.needsUpdate = true;
      }
      if (shown.petals) {
        const { petals, points } = shown.petals;
        const pos = points.geometry.getAttribute("position");
        const e = pos.array as Float32Array;
        for (let i = 0; i < petals.length; i++) {
          const p = petals[i] as Petal;
          e[i * 3] = petalX(p, clock);
          e[i * 3 + 1] = petalY(p, clock);
          e[i * 3 + 2] = petalZ(p, runDist);
        }
        pos.needsUpdate = true;
      }
      for (const { mesh, a, b } of shown.drifting) {
        const e = mesh.instanceMatrix.array;
        for (let i = 0; i < a.length; i++)
          e[i * 16 + 12] = wrap(
            (a[i] as number) + clock * (b[i] as number),
            -DRIFT_WRAP,
            2 * DRIFT_WRAP,
          );
        mesh.instanceMatrix.needsUpdate = true;
      }
    },
  };
}
