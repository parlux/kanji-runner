import {
  BoxGeometry,
  BufferGeometry,
  CapsuleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  IcosahedronGeometry,
  InstancedMesh,
  Mesh,
  MeshLambertMaterial,
} from "three";

/**
 * The one figure factory: every figure in the 3D run (soldiers now; enemies,
 * squads and the giant boss) gets its geometry and material here, so
 * downloaded models can replace them in one place.
 */

export type FigureKind = "soldier" | "enemy";

/** Body and head colours per kind (original; genre-inspired only). */
const COLOURS: Record<FigureKind, { body: number; head: number }> = {
  soldier: { body: 0x2f7dff, head: 0xffe2bd },
  enemy: { body: 0xe8456f, head: 0xffd0c2 },
};

/** Figure proportions (world units): a capsule body and a faceted head. */
const BODY_R = 0.12;
const BODY_LEN = 0.3;
const HEAD_R = 0.1;
const HEAD_Y = BODY_LEN + 2 * BODY_R + HEAD_R * 0.8;

/** A figure's body and head, in figure units, standing on y = 0. */
function figureParts(kind: FigureKind): [BufferGeometry, number][] {
  const body = new CapsuleGeometry(BODY_R, BODY_LEN, 1, 6).toNonIndexed();
  body.translate(0, BODY_LEN / 2 + BODY_R, 0);
  const head = new IcosahedronGeometry(HEAD_R, 0);
  head.translate(0, HEAD_Y, 0);
  return [
    [body, COLOURS[kind].body],
    [head, COLOURS[kind].head],
  ];
}

/** One flat-shaded mesh: the parts merged, coloured per vertex. */
function merge(parts: [BufferGeometry, number][]): BufferGeometry {
  const pos: number[] = [];
  const col: number[] = [];
  const c = new Color();
  for (const [g, colour] of parts) {
    const p = (g.index ? g.toNonIndexed() : g).getAttribute("position");
    c.setHex(colour);
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      col.push(c.r, c.g, c.b);
    }
    g.dispose();
  }
  const merged = new BufferGeometry();
  merged.setAttribute("position", new Float32BufferAttribute(pos, 3));
  merged.setAttribute("color", new Float32BufferAttribute(col, 3));
  merged.computeVertexNormals();
  return merged;
}

const cache = new Map<
  FigureKind,
  { geometry: BufferGeometry; material: MeshLambertMaterial }
>();

/** A crowd of up to `max` figures of one kind, drawn instanced (shared geometry and material). */
export function makeCrowdMesh(kind: FigureKind, max: number): InstancedMesh {
  let parts = cache.get(kind);
  if (!parts) {
    parts = {
      geometry: merge(figureParts(kind)),
      material: new MeshLambertMaterial({
        vertexColors: true,
        flatShading: true,
      }),
    };
    cache.set(kind, parts);
  }
  const mesh = new InstancedMesh(parts.geometry, parts.material, max);
  mesh.count = 0;
  // instances move every frame; the mesh's cached bounds would cull them wrongly
  mesh.frustumCulled = false;
  return mesh;
}

/** Hip height of a horde figure (figure units): its legs swing about it. */
export const HORDE_HIP = 0.2;

/**
 * A horde enemy (figure units, standing on y = 0): the enemy figure on two
 * short legs, about as tall, with a per-vertex `leg` attribute (−1 left,
 * 1 right, 0 body and head) for the shader's stride. 72 triangles.
 */
export function makeHordeGeometry(): BufferGeometry {
  const { body, head } = COLOURS.enemy;
  const len = 0.16;
  const torso = new CapsuleGeometry(BODY_R, len, 1, 6).toNonIndexed();
  torso.translate(0, HORDE_HIP - 0.04 + len / 2 + BODY_R, 0);
  const top = HORDE_HIP - 0.04 + len + 2 * BODY_R;
  const face = new IcosahedronGeometry(HEAD_R, 0);
  face.translate(0, top + HEAD_R * 0.8, 0);
  const legs = [-1, 1].map((side) => {
    const g = new CylinderGeometry(0.035, 0.03, HORDE_HIP + 0.04, 4, 1, true);
    g.translate(side * 0.055, (HORDE_HIP + 0.04) / 2, 0);
    return g.toNonIndexed();
  });
  const sides = [0, 0, -1, 1];
  const counts = [torso, face, ...legs].map(
    (g) => g.getAttribute("position").count,
  );
  const merged = merge([
    [torso, body],
    [face, head],
    [legs[0] as BufferGeometry, body],
    [legs[1] as BufferGeometry, body],
  ]);
  const leg: number[] = [];
  counts.forEach((n, p) => {
    for (let i = 0; i < n; i++) leg.push(sides[p] as number);
  });
  merged.setAttribute("leg", new Float32BufferAttribute(leg, 1));
  return merged;
}

/** The boss's gun metal and its muzzle's glow. */
const GUN = { metal: 0x3b3f4a, muzzle: 0xffb03a } as const;
/** The muzzle of the boss's arm cannon, in figure units (it points at +Z, toward the army). */
export const BOSS_MUZZLE = { x: 0.19, y: 0.34, z: 0.46 } as const;

/**
 * The giant boss, in figure units (scale it up): the enemy figure with two
 * horns and a big arm cannon on its right, pointing forward (+Z).
 */
export function makeBossMesh(): Mesh {
  const { x, y, z } = BOSS_MUZZLE;
  const parts = figureParts("enemy");
  const gun = new CylinderGeometry(0.075, 0.09, z, 7);
  gun.rotateX(Math.PI / 2);
  gun.translate(x, y, z / 2);
  const shoulder = new BoxGeometry(0.14, 0.13, 0.16);
  shoulder.translate(x - 0.03, y + 0.07, 0.02);
  const muzzle = new CylinderGeometry(0.1, 0.1, 0.05, 7);
  muzzle.rotateX(Math.PI / 2);
  muzzle.translate(x, y, z);
  parts.push([gun, GUN.metal], [shoulder, GUN.metal], [muzzle, GUN.muzzle]);
  for (const side of [-1, 1]) {
    const horn = new ConeGeometry(0.03, 0.1, 5);
    horn.rotateZ(-side * 0.5);
    horn.translate(side * 0.06, HEAD_Y + HEAD_R * 0.9, 0);
    parts.push([horn, COLOURS.enemy.head]);
  }
  return new Mesh(
    merge(parts),
    new MeshLambertMaterial({ vertexColors: true, flatShading: true }),
  );
}
