import {
  BoxGeometry,
  Color,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PlaneGeometry,
  type Scene,
} from "three";
import { rowOpenings, wallSolids, type RunState } from "../../core/sim";
import { VIEW_DISTANCE } from "../../core/tuning";
import { TRACK_W, WALL_BEHIND, WALL_H, WALL_T, worldX, worldZ } from "./world";

/**
 * The run's walls in 3D: solid pieces between the openings, a translucent
 * pane in each opening (neutral, or green / red once answered), and glowing
 * edges on the opening being shot. Drawn from the sim's openings as they are
 * now, so they widen as the sim grows them.
 */

/** Most walls drawn at once (rows from just behind the camera to VIEW_DISTANCE). */
const MAX_WALLS = 6;
const WALL_COLOUR = 0x8c7fd0;
const TRIM_COLOUR = 0x6a5bb8;
const TRIM_H = 0.12;
const PANE = { neutral: 0x6aa6ff, good: 0x4fd07f, bad: 0xff5a5a } as const;
const PANE_OPACITY = 0.45;
const GLOW_COLOUR = 0xffc400;
const GLOW_W = 0.3;

export function createWalls(scene: Scene) {
  const box = new BoxGeometry(1, 1, 1);
  const pieces = new InstancedMesh(
    box,
    new MeshLambertMaterial({ color: WALL_COLOUR }),
    MAX_WALLS * 4,
  );
  const trims = new InstancedMesh(
    box,
    new MeshLambertMaterial({ color: TRIM_COLOUR }),
    MAX_WALLS * 4,
  );
  const panes = new InstancedMesh(
    new PlaneGeometry(1, 1),
    new MeshBasicMaterial({
      transparent: true,
      opacity: PANE_OPACITY,
      depthWrite: false,
    }),
    MAX_WALLS * 3,
  );
  const glowMat = new MeshBasicMaterial({ color: GLOW_COLOUR });
  const glowBase = new Color(GLOW_COLOUR);
  const white = new Color(0xffffff);
  const glows = new InstancedMesh(box, glowMat, 2);
  for (const mesh of [pieces, trims, panes, glows]) {
    mesh.count = 0;
    mesh.frustumCulled = false;
    scene.add(mesh);
  }
  // panes are see-through: draw them after the solid things behind them
  panes.renderOrder = 1;
  const m = new Matrix4();
  const c = new Color();

  return {
    /** Places the visible rows' walls for the run as it is now. */
    update(run: RunState) {
      let np = 0;
      let nt = 0;
      let nw = 0;
      let ng = 0;
      let rows = 0;
      const { questions } = run.track;
      for (let i = run.rows.length - 1; i >= 0; i--) {
        const ahead = (questions[i] ?? Infinity) - run.dist;
        if (ahead < -WALL_BEHIND) break;
        // never a row beyond the visibility horizon
        if (ahead > VIEW_DISTANCE || rows >= MAX_WALLS) continue;
        rows++;
        const z = worldZ(questions[i] as number, run.dist) - WALL_T / 2;
        const openings = rowOpenings(run, i);
        for (const s of wallSolids(openings)) {
          const width = (s.right - s.left) * TRACK_W;
          if (width <= 0) continue;
          const x = worldX((s.left + s.right) / 2);
          m.makeScale(width, WALL_H, WALL_T).setPosition(x, WALL_H / 2, z);
          pieces.setMatrixAt(np++, m);
          m.makeScale(width + 0.02, TRIM_H, WALL_T + 0.04).setPosition(
            x,
            WALL_H,
            z,
          );
          trims.setMatrixAt(nt++, m);
        }
        const answered = i === run.next - 1 ? run.lastAnswer : null;
        openings.forEach((o, j) => {
          const width = (o.right - o.left) * TRACK_W;
          m.makeScale(width, WALL_H, 1).setPosition(
            worldX(o.centre),
            WALL_H / 2,
            z,
          );
          panes.setMatrixAt(nw, m);
          c.setHex(
            answered?.choice === j
              ? answered.correct
                ? PANE.good
                : PANE.bad
              : PANE.neutral,
          );
          panes.setColorAt(nw++, c);
          // the opening being shot glows at both edges as they are pushed apart
          if (i === run.next && run.gateTarget === j)
            for (const ex of [o.left, o.right]) {
              m.makeScale(GLOW_W, WALL_H + 0.3, WALL_T + 0.1).setPosition(
                worldX(ex),
                WALL_H / 2,
                z,
              );
              glows.setMatrixAt(ng++, m);
            }
        });
      }
      pieces.count = np;
      trims.count = nt;
      panes.count = nw;
      glows.count = ng;
      // flickers between gold and white as the edges are hit
      glowMat.color.lerpColors(
        glowBase,
        white,
        0.5 + 0.5 * Math.sin(run.dist * 80),
      );
      for (const mesh of [pieces, trims, panes, glows])
        mesh.instanceMatrix.needsUpdate = true;
      if (panes.instanceColor) panes.instanceColor.needsUpdate = true;
    },
  };
}
