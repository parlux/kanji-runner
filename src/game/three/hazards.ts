import { Color, Euler, Matrix4, Quaternion, Vector3, type Scene } from "three";
import { crowdWidth } from "../../core/crowd";
import { fireLimit, hazardPos, packSpan, type RunState } from "../../core/sim";
import { FIRE_RANGE } from "../../core/tuning";
import { makeCrowdMesh } from "./figures";
import { FX_COLOURS, type Fx } from "./fx";
import { createHorde } from "./horde";
import { createKills } from "./kills";
import {
  burstPiece,
  BURST_PIECES,
  CRATE_D,
  CRATE_H,
  CRATE_POPUP_DIST,
  CROWD_DEPTH,
  DIST_SCALE,
  MAX_RECRUITS,
  recruitProgress,
  SHATTER_DIST,
  spanWorld,
  TRACK_W,
  worldX,
  worldZ,
} from "./world";

/**
 * Enemy packs and their kill effects, the crowd's fire at what it targets,
 * the burst of a shattered crate, and recruits running from a shattered
 * crate into the crowd. Drawn from the sim's state as it is now.
 */

const COLOURS = {
  wood: new Color(0xc08a4a),
  band: new Color(0xf0c27a),
};
const STRIDE_HZ = 2.4;

export function createHazards(scene: Scene, fx: Fx) {
  const kills = createKills();
  const horde = createHorde(scene, kills);
  scene.add(kills.pieces, kills.rings);
  const recruits = makeCrowdMesh("soldier", MAX_RECRUITS);
  scene.add(recruits);
  const m = new Matrix4();
  const pos = new Vector3();
  const scl = new Vector3();
  const rot = new Euler();
  const q = new Quaternion();
  const { bullet } = FX_COLOURS;
  return {
    /**
     * Places packs, fire and bursts for the run as it is now; `fighting` is a
     * squad firefight or the boss fight (it takes the fire). Fire straight
     * ahead stops at the next wall, or at the boss (track distance `boss`).
     * `cheer`: seconds since the enemies wiped the army out (−1 before).
     */
    update(
      run: RunState,
      clock: number,
      fighting: boolean,
      boss = Infinity,
      cheer = -1,
    ) {
      const armyX = worldX(run.x);
      const lanes = Math.min(5, 1 + Math.floor(Math.sqrt(run.army) / 3));
      const half = Math.min(1.2, lanes * 0.25);
      const laneX = (l: number): number =>
        armyX + (lanes > 1 ? l / (lanes - 1) - 0.5 : 0) * 2 * half;
      const { hazards } = run.track;
      horde.update(run, clock, cheer);
      kills.update(run, clock);
      // the crowd's fire: straight ahead from each lane (never past the next
      // wall); the lanes that face its target stop there
      const i = run.target;
      const target = i === null ? undefined : hazards[i];
      const wallZ = worldZ(Math.min(fireLimit(run), boss), run.dist);
      const straight = (l: number): void =>
        fx.stream(
          laneX(l),
          -0.4,
          laneX(l),
          -FIRE_RANGE * DIST_SCALE,
          8,
          1.2,
          l * 0.37,
          bullet,
          clock,
          0.65,
          wallZ,
        );
      if (fighting || run.gateTarget !== null || run.status !== "running") {
        /* the squads' fight or the wall's opening takes the fire; a dead army fires nothing */
      } else if (
        i !== null &&
        (target?.kind === "block" || target?.kind === "pack")
      ) {
        const cw = crowdWidth(run.army);
        const span = target.kind === "block" ? target : packSpan(run, i);
        const lo = Math.max(span.left, run.x - cw / 2);
        const hi = Math.min(span.right, run.x + cw / 2);
        const tz = worldZ(hazardPos(run, i), run.dist);
        // a crate takes all the fire (aimed at the overlap); a pack only the lanes that face it
        const tx = worldX((lo + hi) / 2);
        for (let l = 0; l < lanes; l++) {
          const x = laneX(l);
          if (target.kind === "block")
            fx.stream(x, -0.4, tx, tz, 6, 1.6, l * 0.37, bullet, clock);
          else if (
            x >= worldX(span.left) - 0.3 &&
            x <= worldX(span.right) + 0.3
          )
            fx.stream(x, -0.4, x, tz, 6, 1.6, l * 0.37, bullet, clock);
          else straight(l);
        }
        // hit flash at the impact point (a pack's hits flash where its rows die: kills.ts)
        if (target.kind === "block") {
          const f = 0.6 + 0.4 * Math.sin(run.dist * 80);
          fx.spark(tx, 0.5, tz, 0.5 * f, FX_COLOURS.flash);
        }
      } else for (let l = 0; l < lanes; l++) straight(l);

      // a shattered crate bursts (a pack's final burst: kills.ts)
      const sh = run.lastShatter;
      const dead = sh ? hazards[sh.index] : undefined;
      if (sh && dead?.kind === "block") {
        const t = (run.dist - sh.dist) / SHATTER_DIST;
        if (t >= 0 && t < 1) {
          const c = spanWorld(dead.left, dead.right);
          const cz = worldZ(hazardPos(run, sh.index), run.dist);
          for (let k = 0; k < BURST_PIECES; k++) {
            const p = burstPiece(k, t, c.w / 2);
            fx.spark(
              c.x + p.x,
              Math.max(0.05, CRATE_H / 2 + p.y),
              cz - CRATE_D / 2 + p.z * 0.6,
              p.size,
              k % 2 ? COLOURS.wood : COLOURS.band,
            );
          }
        }
      }

      // recruits run from the shattered crate into the crowd
      let nr = 0;
      const cr = run.lastCrate;
      if (cr && sh && dead?.kind === "block" && sh.dist === cr.dist) {
        const t = (run.dist - cr.dist) / CRATE_POPUP_DIST;
        const n = Math.min(MAX_RECRUITS, cr.gain);
        if (t >= 0 && t < 1) {
          const from = spanWorld(dead.left, dead.right);
          const fz = worldZ(dead.pos, run.dist) - CRATE_D / 2;
          const r = (crowdWidth(run.army) * TRACK_W) / 2;
          for (let k = 0; k < n; k++) {
            const u = recruitProgress(k, n, t);
            if (u >= 1) continue;
            const a = k * 2.39996;
            const tx = armyX + r * 0.5 * Math.cos(a);
            const tz = r * 0.3 * CROWD_DEPTH * Math.sin(a);
            const bob =
              Math.abs(Math.sin((clock * STRIDE_HZ + k * 0.37) * Math.PI * 2)) *
              0.07;
            pos.set(
              from.x + (tx - from.x) * u + 0.6 * Math.cos(a) * (1 - u),
              bob,
              fz + (tz - fz) * u,
            );
            // running back into the crowd, facing the way it runs
            rot.set(0.18, Math.PI, 0);
            q.setFromEuler(rot);
            scl.setScalar(1);
            m.compose(pos, q, scl);
            recruits.setMatrixAt(nr++, m);
          }
        }
      }
      recruits.count = nr;
      recruits.instanceMatrix.needsUpdate = true;
    },
  };
}
