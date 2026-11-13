import type { Scene } from "three";
import { BOSS_MUZZLE, makeBossMesh } from "./figures";
import { FX_COLOURS, type Fx } from "./fx";
import {
  BOSS_SCALE,
  BOSS_SHOWN,
  BOSS_TOP,
  type BossFight,
  DIST_SCALE,
  worldX,
  worldZ,
} from "./world";

/**
 * The giant boss in 3D: one enemy figure from the factory, standing on the
 * track's centre past the last question. In the gunfight both sides shoot
 * (tracers both ways, hits sparking on its body); then it topples (Victory),
 * stomps forward over where the army stood (Defeated) or stands (Tie).
 */

/** The boss is this much bulkier (wider and deeper) than a scaled-up soldier. */
const BULK = 1.35;
/** Share of the hold the topple takes; then it lies still. */
const TOPPLE_U = 0.6;
/** Stomps per second, and how high each lifts it (world units). */
const STOMP_HZ = 2.5;
const STOMP_LIFT = 0.35;
/** Share of the hold the stomp to the firing stop takes. */
const STOMP_U = 0.85;
/** Sparks flickering on its body while it is hit. */
const HITS = 6;

/** A cheap fixed pseudo-random number in [0, 1). */
const hash01 = (v: number): number => {
  const x = Math.sin(v) * 43758.5453;
  return x - Math.floor(x);
};

/** Where the boss's head top is now, for its HP above it (track distance and height). */
export type BossTop = { dist: number; height: number };

export function createBoss(scene: Scene, fx: Fx) {
  const mesh = makeBossMesh();
  mesh.scale.set(BOSS_SCALE * BULK, BOSS_SCALE, BOSS_SCALE * BULK);
  mesh.visible = false;
  scene.add(mesh);
  const { bullet, enemyBullet, flash } = FX_COLOURS;
  const top: BossTop = { dist: 0, height: BOSS_TOP };

  return {
    /**
     * Places the boss at track distance `at` (its firing stop `stop`) with
     * the army at `runDist` (track x `armyX`, `army` strong), for `fight`
     * (null during the run); returns where its head top is.
     */
    update(
      at: number,
      stop: number,
      runDist: number,
      armyX: number,
      army: number,
      fight: BossFight | null,
      clock: number,
    ): BossTop {
      mesh.visible = at - runDist <= BOSS_SHOWN;
      let dist = at;
      let lift = 0;
      let tip = 0;
      let sway = Math.sin(clock * 1.3) * 0.03;
      const end = fight?.ending;
      if (end?.kind === "topple") {
        // keels over sideways (away from its gun) and a little back, faster and faster, and lies still
        const u = Math.min(1, end.u / TOPPLE_U);
        tip = -0.35 * u * u;
        sway = (Math.PI / 2) * u * u;
      } else if (end?.kind === "stomp") {
        const u = Math.min(1, end.u / STOMP_U);
        dist = at - (at - stop) * u;
        lift = u < 1 ? Math.abs(Math.sin(clock * STOMP_HZ * Math.PI)) : 0;
        lift *= STOMP_LIFT;
        sway = u < 1 ? Math.sin(clock * STOMP_HZ * Math.PI) * 0.08 : 0;
      }
      const bz = worldZ(dist, runDist);
      mesh.position.set(0, lift, bz);
      mesh.rotation.set(tip, 0, sway);
      top.dist = dist + (BOSS_TOP * Math.sin(-tip)) / DIST_SCALE;
      top.height = lift + BOSS_TOP * Math.cos(tip) * Math.cos(sway);

      if (fight?.firing) {
        const ax = worldX(armyX);
        const chest = BOSS_TOP * 0.55;
        // the crowd's fire, from its lanes up into the boss's chest
        const lanes = Math.min(5, 1 + Math.floor(Math.sqrt(army) / 3));
        const half = Math.min(1.2, lanes * 0.25);
        for (let l = 0; l < lanes; l++) {
          const lx = ax + (lanes > 1 ? l / (lanes - 1) - 0.5 : 0) * 2 * half;
          const tx = (l / Math.max(1, lanes - 1) - 0.5) * 0.8;
          fx.stream(
            lx,
            -0.4,
            tx,
            bz,
            7,
            1.6,
            l * 0.37,
            bullet,
            clock,
            1,
            -Infinity,
            0.45,
            chest,
          );
        }
        // the big gun's fire, from the muzzle down into the crowd
        const mx = BOSS_MUZZLE.x * BOSS_SCALE * BULK;
        const my = BOSS_MUZZLE.y * BOSS_SCALE;
        const mz = bz + BOSS_MUZZLE.z * BOSS_SCALE * BULK;
        for (let l = 0; l < 3; l++)
          fx.stream(
            mx,
            mz,
            ax + (l - 1) * 0.6,
            0,
            4,
            1.1,
            l * 0.31,
            enemyBullet,
            clock,
            1,
            -Infinity,
            my,
            0.45,
            2.2,
          );
        // muzzle flash and hits: reshuffled 20× a second
        const frame = Math.floor(clock * 20);
        fx.spark(mx, my, mz + 0.3, 0.5 + 0.4 * hash01(frame * 3.1), flash);
        for (let k = 0; k < HITS; k++) {
          const r = hash01(k * 12.9898 + frame * 78.233);
          const r2 = hash01(k * 4.1414 + frame * 9.13 + 0.5);
          fx.spark(
            (r - 0.5) * 1.2,
            chest + (r2 - 0.5) * 2,
            bz + 1,
            0.3,
            bullet,
          );
        }
        for (let k = 0; k < 3; k++) {
          const r = hash01(k * 7.7 + frame * 31.1);
          fx.spark(ax + (r - 0.5) * 1.5, 0.4, -0.6 - r, 0.35, enemyBullet);
        }
      }
      return top;
    },
  };
}
