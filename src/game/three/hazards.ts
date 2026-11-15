import { Color, Euler, Matrix4, Quaternion, Vector3, type Scene } from "three";
import { crowdWidth } from "../../core/crowd";
import { laneHits } from "../../core/fire";
import { hazardPos } from "../../core/horde";
import type { RunState } from "../../core/sim";
import { threats } from "../../core/shooting";
import { fireLimit } from "../../core/state";
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
  MAX_RECRUITS,
  recruitProgress,
  SHATTER_DIST,
  spanWorld,
} from "./hazardLayout";
import {
  CROWD_DEPTH,
  DIST_SCALE,
  TRACK_W,
  trackX,
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
      // the crowd's fire: every lane straight ahead; it stops at the first
      // crate or pack over its x (laneHits), else flies on to the range end,
      // never past the next wall (or the boss), which also takes the free share
      const limit = Math.min(fireLimit(run), boss);
      const wallZ = worldZ(limit, run.dist);
      if (!fighting && run.status === "running") {
        const xs = Array.from({ length: lanes }, (_, l) => trackX(laneX(l)));
        const hits = laneHits(
          threats(run),
          run.nextHazard,
          run.dist,
          xs,
          limit,
        );
        const flash = new Map<number, { sum: number; n: number }>();
        for (let l = 0; l < lanes; l++) {
          const hit = hits[l] ?? null;
          const x = laneX(l);
          if (!hit) {
            fx.stream(
              x,
              -0.4,
              x,
              -FIRE_RANGE * DIST_SCALE,
              8,
              1.2,
              l * 0.37,
              bullet,
              clock,
              0.65,
              wallZ,
            );
            continue;
          }
          const tz = worldZ(hit.pos, run.dist);
          fx.stream(x, -0.4, x, tz, 6, 1.6, l * 0.37, bullet, clock);
          // a crate's hit flash sits where its lanes hit it (a pack's: kills.ts)
          if (hazards[hit.index]?.kind === "block") {
            const f = flash.get(hit.index) ?? { sum: 0, n: 0 };
            flash.set(hit.index, { sum: f.sum + x, n: f.n + 1 });
          }
        }
        const f = 0.6 + 0.4 * Math.sin(run.dist * 80);
        for (const [i, { sum, n }] of flash)
          fx.spark(
            sum / n,
            0.5,
            worldZ(hazardPos(run, i), run.dist),
            0.5 * f,
            FX_COLOURS.flash,
          );
      }

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
