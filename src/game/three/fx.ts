import {
  BoxGeometry,
  Color,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Quaternion,
  Vector3,
  type Scene,
} from "three";

/**
 * Bullet tracers and sparks, shared by every source of fire (the crowd's
 * stream, the squads' firefight, kills and bursts). Call `begin`, then any
 * number of `stream` / `spark`, then `end`, once per frame. Over the caps,
 * extras are dropped.
 */

const MAX_TRACERS = 120;
const MAX_SPARKS = 80;
const TRACER_LEN = 0.6;
const TRACER_Y = 0.45;

export const FX_COLOURS = {
  bullet: new Color(0xffe14d),
  enemyBullet: new Color(0xff5c9a),
  flash: new Color(0xffffff),
};

export function createFx(scene: Scene) {
  const tracers = new InstancedMesh(
    new BoxGeometry(0.09, 0.09, TRACER_LEN),
    new MeshBasicMaterial(),
    MAX_TRACERS,
  );
  const sparks = new InstancedMesh(
    new BoxGeometry(1, 1, 1),
    new MeshBasicMaterial(),
    MAX_SPARKS,
  );
  for (const mesh of [tracers, sparks]) {
    mesh.count = 0;
    mesh.frustumCulled = false;
    scene.add(mesh);
  }
  const m = new Matrix4();
  const pos = new Vector3();
  const scl = new Vector3();
  const q = new Quaternion();
  const from = new Vector3();
  const dir = new Vector3();
  const fwd = new Vector3(0, 0, 1);
  let nt = 0;
  let ns = 0;

  return {
    begin() {
      nt = 0;
      ns = 0;
    },
    /**
     * `count` tracers flying from (ax, az) to (bx, bz) in world units, `speed`
     * lengths per second, `offset` apart in phase. `fade` (0..1 of the way
     * along) is where a tracer starts shrinking to nothing; `minZ` drops those
     * beyond it (never past a wall).
     */
    stream(
      ax: number,
      az: number,
      bx: number,
      bz: number,
      count: number,
      speed: number,
      offset: number,
      colour: Color,
      clock: number,
      fade = 1,
      minZ = -Infinity,
    ) {
      from.set(ax, TRACER_Y, az);
      dir.set(bx - ax, 0, bz - az);
      const len = dir.length();
      if (len < 1e-6) return;
      dir.multiplyScalar(1 / len);
      q.setFromUnitVectors(fwd, dir);
      for (let k = 0; k < count && nt < MAX_TRACERS; k++) {
        const t = (k / count + clock * speed + offset) % 1;
        pos.copy(from).addScaledVector(dir, len * t);
        if (pos.z < minZ) continue;
        const s = fade < 1 ? Math.min(1, (1 - t) / (1 - fade)) : 1;
        scl.set(s, s, s);
        m.compose(pos, q, scl);
        tracers.setMatrixAt(nt, m);
        tracers.setColorAt(nt++, colour);
      }
    },
    /** A cube of side `size` centred at (x, y, z). */
    spark(x: number, y: number, z: number, size: number, colour: Color) {
      if (ns >= MAX_SPARKS || size <= 0) return;
      pos.set(x, y, z);
      scl.set(size, size, size);
      q.identity();
      m.compose(pos, q, scl);
      sparks.setMatrixAt(ns, m);
      sparks.setColorAt(ns++, colour);
    },
    end() {
      tracers.count = nt;
      sparks.count = ns;
      for (const mesh of [tracers, sparks]) {
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
    },
  };
}

export type Fx = ReturnType<typeof createFx>;
