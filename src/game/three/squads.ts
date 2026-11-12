import { Euler, Matrix4, Quaternion, Vector3, type Scene } from "three";
import { rowOpenings, viewOf, type RunState } from "../../core/sim";
import { makeCrowdMesh } from "./figures";
import { FX_COLOURS, type Fx } from "./fx";
import {
  crowdLayout,
  SHAPE_DISTANCE,
  squadPlace,
  WALL_BEHIND,
  worldX,
  worldZ,
} from "./world";

/**
 * Squad charges and fire in 3D: enemy figures standing beyond each opening
 * of a charge, the firefight when one is run into (tracers both ways, figures
 * dropping, or the squad turning friendly and running into the army), and the
 * stream onto the edges of an opening being shot.
 */

/** Most squad figures drawn at once (enemy and friendly). */
const MAX_FIGURES = 80;
/** Most friendly (joining) squad figures drawn at once. */
const MAX_SQUAD = 20;
/** Share of the fight (after the reveal) a shot figure takes to topple. */
const DROP_U = 0.15;
/** Squad figures are drawn this much larger than soldiers, so they read at a distance (as in 2D). */
const SQUAD_SCALE = 1.3;

export function createSquads(scene: Scene, fx: Fx) {
  const enemies = makeCrowdMesh("enemy", MAX_FIGURES);
  const friends = makeCrowdMesh("soldier", MAX_SQUAD);
  scene.add(enemies, friends);
  const layout = new Float32Array(2 * MAX_SQUAD);
  const m = new Matrix4();
  const pos = new Vector3();
  const scl = new Vector3();
  const rot = new Euler();
  const q = new Quaternion();
  const { bullet, enemyBullet } = FX_COLOURS;

  return {
    /** Places squads and fire for the run as it is now; `clock` (s) animates. */
    update(run: RunState, clock: number): boolean {
      let ne = 0;
      let nf = 0;
      const armyX = worldX(run.x);
      const lanes = Math.min(5, 1 + Math.floor(Math.sqrt(run.army) / 3));
      const half = Math.min(1.2, lanes * 0.25);
      const laneX = (l: number): number =>
        armyX + (lanes > 1 ? l / (lanes - 1) - 0.5 : 0) * 2 * half;

      let fighting = false;
      // squads are drawn only from the view model; build it only near a charge
      let near = false;
      for (const i of run.track.charges) {
        const ahead = (run.track.questions[i] ?? Infinity) - run.dist;
        if (ahead >= -WALL_BEHIND - 2 && ahead <= SHAPE_DISTANCE) near = true;
      }
      for (const c of near ? viewOf(run).charges : []) {
        const ahead = c.pos - run.dist;
        if (ahead < -WALL_BEHIND - 2) continue;
        if (ahead > SHAPE_DISTANCE) break;
        for (const s of c.squads) {
          const p = squadPlace(run.dist, run.x, c, s);
          if (!p || p.dist - run.dist > SHAPE_DISTANCE) continue;
          const cx = worldX(p.x);
          const cz = worldZ(p.dist, run.dist);
          const n = crowdLayout(s.count, layout);
          const mesh = p.friendly ? friends : enemies;
          for (let k = 0; k < n; k++) {
            if (p.friendly ? nf >= MAX_SQUAD : ne >= MAX_FIGURES) break;
            let size = SQUAD_SCALE * p.shown * (1 - 0.4 * p.merge);
            let fall = 0;
            if (k >= p.standing) {
              // shot: topples backwards and sinks away
              fall = (p.u - (1 - (k + 0.5) / s.count)) / DROP_U;
              if (fall >= 1) continue;
              fall = Math.max(0, fall);
              size *= 1 - fall * 0.5;
            }
            if (size <= 0) continue;
            const bob = Math.abs(Math.sin(clock * 5 + k * 1.7)) * 0.04;
            pos.set(
              cx + SQUAD_SCALE * (layout[2 * k] as number),
              bob - 0.2 * fall,
              cz - SQUAD_SCALE * (layout[2 * k + 1] as number) - fall * 0.6,
            );
            // enemies face the army; friends run with it
            rot.set(
              p.friendly ? -0.18 : -fall * 1.4,
              p.friendly ? 0 : Math.PI,
              0,
            );
            q.setFromEuler(rot);
            scl.setScalar(size);
            m.compose(pos, q, scl);
            mesh.setMatrixAt(p.friendly ? nf++ : ne++, m);
          }
          if (p.fight === null || p.friendly) continue;
          // the firefight: the army shoots at the squad, the squad back
          fighting = true;
          for (let l = 0; l < lanes; l++)
            fx.stream(laneX(l), -0.4, cx, cz, 6, 1.6, l * 0.37, bullet, clock);
          if (p.standing > 0) {
            const back = p.tag ? 4 : 2;
            for (let l = 0; l < back; l++) {
              const ox = (back > 1 ? l / (back - 1) - 0.5 : 0) * 0.8;
              fx.stream(
                cx + ox,
                cz,
                armyX + ox,
                0,
                5,
                1.3,
                l * 0.29,
                enemyBullet,
                clock,
              );
            }
          }
        }
      }

      // the opening being shot: the stream splits onto its two edges
      const gate =
        run.gateTarget === null || fighting
          ? undefined
          : rowOpenings(run, run.next)[run.gateTarget];
      const wallPos = run.track.questions[run.next];
      if (gate && wallPos !== undefined) {
        const wz = worldZ(wallPos, run.dist);
        const edges = [worldX(gate.left), worldX(gate.right)];
        for (let l = 0; l < Math.max(2, lanes); l++)
          fx.stream(
            laneX(l % lanes),
            -0.4,
            edges[l % 2] as number,
            wz,
            6,
            1.6,
            l * 0.37,
            bullet,
            clock,
          );
      }

      enemies.count = ne;
      friends.count = nf;
      enemies.instanceMatrix.needsUpdate = true;
      friends.instanceMatrix.needsUpdate = true;
      return fighting;
    },
  };
}
