import {
  BufferGeometry,
  CapsuleGeometry,
  Color,
  Float32BufferAttribute,
  IcosahedronGeometry,
  InstancedMesh,
  MeshLambertMaterial,
} from "three";

/**
 * The one figure factory: every figure in the 3D run (soldiers now; enemies,
 * squads and the boss crowd later) gets its geometry and material here, so
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

/** One flat-shaded mesh: body and head merged, coloured per vertex. */
function figureGeometry(kind: FigureKind): BufferGeometry {
  const body = new CapsuleGeometry(BODY_R, BODY_LEN, 1, 6).toNonIndexed();
  body.translate(0, BODY_LEN / 2 + BODY_R, 0);
  const head = new IcosahedronGeometry(HEAD_R, 0);
  head.translate(0, HEAD_Y, 0);
  const parts: [BufferGeometry, number][] = [
    [body, COLOURS[kind].body],
    [head, COLOURS[kind].head],
  ];
  const pos: number[] = [];
  const col: number[] = [];
  const c = new Color();
  for (const [g, colour] of parts) {
    const p = g.getAttribute("position");
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
      geometry: figureGeometry(kind),
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
