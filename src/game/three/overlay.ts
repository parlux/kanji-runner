import type { RunState } from "../../core/sim";
import { rowOpenings } from "../../core/sim";
import { VIEW_DISTANCE } from "../../core/tuning";
import { drawLabel, outlinedText } from "../labels";
import {
  fogAlpha,
  LABEL_K,
  PASSED_LABEL_FADE_DIST,
  PROMPT_K,
  WALL_BEHIND,
  WALL_H,
  wallPx,
  type Projector,
} from "./world";

type Ctx = CanvasRenderingContext2D;

/** Gap (in wall heights) between a wall's top and its prompt. */
const PROMPT_GAP = 0.15;

/**
 * The 3D run's wall text, projected with the live camera: answer labels
 * centred in each opening and fitted to its projected width, the prompt
 * above the wall. Sized by the wall's projected height (so it shrinks with
 * distance, with no minimum), faded in with the fog, far walls first. A
 * passed wall's labels fade and its prompt is gone, as in 2D.
 */
export function renderWallText(
  ctx: Ctx,
  run: RunState,
  project: Projector,
): void {
  const { questions } = run.track;
  for (let i = run.rows.length - 1; i >= 0; i--) {
    const pos = questions[i] ?? Infinity;
    const ahead = pos - run.dist;
    if (ahead < -WALL_BEHIND) break;
    if (ahead > VIEW_DISTANCE) continue;
    const row = run.rows[i];
    if (!row) continue;
    const passed = i < run.next;
    const fade = passed
      ? 1 - Math.min(1, Math.max(0, -ahead) / PASSED_LABEL_FADE_DIST)
      : 1;
    const alpha = fogAlpha(ahead) * fade;
    if (alpha <= 0) continue;
    const px = wallPx(project, 0.5, pos);
    if (px <= 0) continue;
    ctx.globalAlpha = alpha;
    const answered = i === run.next - 1 ? run.lastAnswer : null;
    rowOpenings(run, i).forEach((o, j) => {
      // the one run through goes at once, so it never covers the army
      if (passed && answered?.choice === j) return;
      const c = project(o.centre, pos, WALL_H / 2);
      const l = project(o.left, pos, WALL_H / 2);
      const r = project(o.right, pos, WALL_H / 2);
      if (!c || !l || !r) return;
      const label = row.options[j] ?? "";
      drawLabel(ctx, label, c.x, c.y, LABEL_K * px, r.x - l.x - 6, true);
    });
    if (!passed) {
      const top = project(0.5, pos, WALL_H * (1 + PROMPT_GAP));
      const size = PROMPT_K * px;
      if (top) outlinedText(ctx, row.prompt, top.x, top.y - size / 2, size);
    }
    ctx.globalAlpha = 1;
  }
}
