import { isCharge } from "../../core/track";
import {
  rowOpenings,
  viewOf,
  type ChargeView,
  type RunState,
} from "../../core/sim";
import { VIEW_DISTANCE } from "../../core/tuning";
import { drawLabel, outlinedText, TEXT_COLORS } from "../labels";
import {
  FIGURE_TOP,
  fogAlpha,
  squadPlace,
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
/** A squad's count is this many times the projected wall height at the squad. */
const COUNT_K = 0.5;
const TAG_COLOURS = { join: "#3fbf6f", fight: "#ff5a5a" } as const;
const TAGS = { join: "JOINS YOU", fight: "FIGHTS BACK" } as const;

/**
 * A charge's squad counts (and, in the firefight, the outcome tag) above
 * the squads; returns the topmost screen y they reach (Infinity if none).
 */
function renderSquadText(
  ctx: Ctx,
  run: RunState,
  c: ChargeView,
  project: Projector,
  alpha: number,
): number {
  let top = Infinity;
  for (const q of c.squads) {
    const p = squadPlace(run.dist, run.x, c, q);
    if (!p || p.merge >= 1) continue;
    const a = alpha * p.shown * fogAlpha(p.dist - run.dist) * (1 - p.merge);
    const at = project(p.x, p.dist, FIGURE_TOP + 0.3);
    const size = COUNT_K * wallPx(project, p.x, p.dist);
    if (a <= 0 || !at || size <= 0) continue;
    ctx.globalAlpha = a;
    const colour = p.friendly ? TEXT_COLORS.text : TAG_COLOURS.fight;
    outlinedText(ctx, String(p.standing), at.x, at.y - size / 2, size, colour);
    top = Math.min(top, at.y - size);
    if (p.tag) {
      outlinedText(
        ctx,
        TAGS[p.tag],
        at.x,
        at.y - size * 1.6,
        size * 0.8,
        TAG_COLOURS[p.tag],
      );
      top = Math.min(top, at.y - size * 2);
    }
  }
  ctx.globalAlpha = 1;
  return top;
}

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
  // squads are drawn only from the view model, never from the rows
  const view = run.track.charges.length ? viewOf(run) : null;
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
    // a charge's squads stand beyond the wall (drawn first), their counts above them
    const charge = isCharge(run.track, i)
      ? view?.charges.find((c) => c.row === i)
      : undefined;
    const squadTop = charge
      ? renderSquadText(ctx, run, charge, project, 1)
      : Infinity;
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
    ctx.globalAlpha = 1;
    if (passed) continue;
    // the prompt sits above the wall, and above any squads beyond it
    const top = project(0.5, pos, WALL_H * (1 + PROMPT_GAP));
    const size = PROMPT_K * px;
    if (!top) continue;
    const y = Math.min(top.y, squadTop - 0.15 * size) - size / 2;
    ctx.globalAlpha = alpha;
    outlinedText(ctx, row.prompt, top.x, y, size);
    ctx.globalAlpha = 1;
  }
}
