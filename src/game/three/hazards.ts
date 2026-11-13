import { Color, Euler, Matrix4, Quaternion, Vector3, type Scene } from "three";
import { crowdWidth } from "../../core/crowd";
import {
  fireLimit,
  hazardPos,
  isShattered,
  packHeadsLeft,
  packSpan,
  packSurvivors,
  type RunState,
} from "../../core/sim";
import { FIRE_RANGE, PACK_MAX } from "../../core/tuning";
import { makeCrowdMesh } from "./figures";
import { FX_COLOURS, type Fx } from "./fx";
import {
  burstPiece,
  BURST_PIECES,
  CRATE_D,
  CRATE_H,
  CRATE_POPUP_DIST,
  CROWD_DEPTH,
  DIST_SCALE,
  FIGURE_TOP,
  hordeLayout,
  HORDE_SCALE,
  MAX_RECRUITS,
  packFigureScale,
  recruitProgress,
  shapeDistance,
  SHATTER_DIST,
  spanWorld,
  TRACK_W,
  worldX,
  worldZ,
} from "./world";

/**
 * Enemy packs, the crowd's fire at what it targets, kills popping off, the
 * burst of a shattered crate or pack, and recruits running from a shattered
 * crate into the crowd. Drawn from the sim's state as it is now.
 */

/** Most pack figures drawn: every enemy of two full packs (two packs fit within SHAPE_DISTANCE). */
const MAX_PACK_FIGURES = 2 * PACK_MAX;
const COLOURS = {
  enemy: new Color(0xe8456f),
  wood: new Color(0xc08a4a),
  band: new Color(0xf0c27a),
};
const STRIDE_HZ = 2.4;

export function createHazards(scene: Scene, fx: Fx) {
  const enemies = makeCrowdMesh("enemy", MAX_PACK_FIGURES);
  const recruits = makeCrowdMesh("soldier", MAX_RECRUITS);
  scene.add(enemies, recruits);
  const layout = new Float32Array(2 * PACK_MAX);
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
     */
    update(run: RunState, clock: number, fighting: boolean, boss = Infinity) {
      const armyX = worldX(run.x);
      const lanes = Math.min(5, 1 + Math.floor(Math.sqrt(run.army) / 3));
      const half = Math.min(1.2, lanes * 0.25);
      const laneX = (l: number): number =>
        armyX + (lanes > 1 ? l / (lanes - 1) - 0.5 : 0) * 2 * half;
      const { hazards } = run.track;
      let ne = 0;

      for (let i = 0; i < hazards.length; i++) {
        const hz = hazards[i];
        if (hz?.kind !== "pack" || i < run.nextHazard || isShattered(run, i))
          continue;
        const ahead = hazardPos(run, i) - run.dist;
        if (ahead > shapeDistance()) continue;
        const n = packSurvivors(run, i);
        if (n <= 0) continue;
        const span = packSpan(run, i);
        const cx = worldX((span.left + span.right) / 2);
        const cz = worldZ(hazardPos(run, i), run.dist);
        const drawn = hordeLayout(n, span.right - span.left, layout);
        const left = packHeadsLeft(run, i) * (drawn / n);
        for (let k = 0; k < drawn && ne < MAX_PACK_FIGURES; k++) {
          const s = packFigureScale(k, left);
          if (s <= 0) continue;
          const stride = (clock * STRIDE_HZ + k * 0.37) * Math.PI * 2;
          pos.set(
            cx + (layout[2 * k] as number),
            Math.abs(Math.sin(stride)) * 0.07 * HORDE_SCALE,
            cz + (layout[2 * k + 1] as number),
          );
          // facing the army, leaning into the run
          rot.set(-0.18, Math.PI, Math.sin(stride) * 0.1);
          q.setFromEuler(rot);
          scl.setScalar(s * HORDE_SCALE);
          m.compose(pos, q, scl);
          enemies.setMatrixAt(ne++, m);
        }
        if (run.target === i) {
          // enemies popping off the pack's rim
          const r = ((span.right - span.left) * TRACK_W) / 2;
          for (let k = 0; k < 4; k++) {
            const t = (run.dist * 2.5 + k / 4) % 1;
            const a = k * 2.39996 + Math.floor(run.dist * 2.5) * 1.3;
            fx.spark(
              cx + (r + 1.2 * t) * Math.cos(a),
              FIGURE_TOP * 0.6 + 1.4 * t,
              cz + (r + 1.2 * t) * Math.sin(a) * 0.6 * CROWD_DEPTH,
              0.28 * (1 - t),
              COLOURS.enemy,
            );
          }
        }
      }
      enemies.count = ne;
      enemies.instanceMatrix.needsUpdate = true;

      // the crowd's fire: onto its target, otherwise straight ahead (never past the next wall)
      const i = run.target;
      const target = i === null ? undefined : hazards[i];
      if (fighting || run.gateTarget !== null) {
        /* the squads' fight or the wall's opening takes the fire */
      } else if (
        i !== null &&
        (target?.kind === "block" || target?.kind === "pack")
      ) {
        const cw = crowdWidth(run.army);
        const span = target.kind === "block" ? target : packSpan(run, i);
        // aim at the middle of where the crowd and the target overlap
        const lo = Math.max(span.left, run.x - cw / 2);
        const hi = Math.min(span.right, run.x + cw / 2);
        const tx = worldX((lo + hi) / 2);
        const tz = worldZ(hazardPos(run, i), run.dist);
        for (let l = 0; l < lanes; l++)
          fx.stream(laneX(l), -0.4, tx, tz, 6, 1.6, l * 0.37, bullet, clock);
        // hit flash at the impact point
        const f = 0.6 + 0.4 * Math.sin(run.dist * 80);
        fx.spark(tx, 0.5, tz, 0.5 * f, FX_COLOURS.flash);
      } else {
        const wallZ = worldZ(Math.min(fireLimit(run), boss), run.dist);
        for (let l = 0; l < lanes; l++)
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
      }

      // a shattered crate or pack bursts
      const sh = run.lastShatter;
      const dead = sh ? hazards[sh.index] : undefined;
      if (sh && (dead?.kind === "block" || dead?.kind === "pack")) {
        const t = (run.dist - sh.dist) / SHATTER_DIST;
        if (t >= 0 && t < 1) {
          const isCrate = dead.kind === "block";
          const c = isCrate
            ? spanWorld(dead.left, dead.right)
            : { x: worldX(run.packs[sh.index]?.x ?? 0.5), w: 1.2 };
          const cz = worldZ(hazardPos(run, sh.index), run.dist);
          for (let k = 0; k < BURST_PIECES; k++) {
            const p = burstPiece(k, t, c.w / 2);
            fx.spark(
              c.x + p.x,
              Math.max(0.05, (isCrate ? CRATE_H / 2 : 0.4) + p.y),
              cz - (isCrate ? CRATE_D / 2 : 0) + p.z * 0.6,
              p.size,
              isCrate ? (k % 2 ? COLOURS.wood : COLOURS.band) : COLOURS.enemy,
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
