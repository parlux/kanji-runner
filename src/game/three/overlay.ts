import { isCharge } from "../../core/track";
import {
  crateReward,
  hazardPos,
  isShattered,
  packSurvivors,
  rowOpenings,
  viewOf,
  type ChargeView,
  type RunState,
} from "../../core/sim";
import {
  drawLabel,
  fitSize,
  mixHex,
  outlinedText,
  PROMPT_MARGIN,
  TEXT_COLORS,
  type Tint,
} from "../labels";
import {
  BOSS_TOP,
  type BossView,
  CRATE_H,
  FIGURE_TOP,
  HAZE_COLOUR,
  SHAPE_DISTANCE,
  type Haze,
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

const HAZE_HEX = `#${HAZE_COLOUR.toString(16).padStart(6, "0")}`;

/** Text colours mixed toward the haze by `amount`, as the fog does to the object. */
const hazed =
  (amount: number): Tint =>
  (c) =>
    mixHex(c, HAZE_HEX, amount);

/** Gap (in wall heights) between a wall's top and its prompt. */
const PROMPT_GAP = 0.15;
/** A squad's count is this many times the projected wall height at the squad. */
const COUNT_K = 0.5;
const REWARD_COLOUR = "#5fd38d";
const TAG_COLOURS = { join: "#3fbf6f", fight: "#ff5a5a" } as const;
/** A crate's hit points and reward are this many times its projected height (with a floor). */
const CRATE_HP_K = 0.6;
const CRATE_REWARD_K = 0.45;
const CRATE_TEXT_MIN_PX = 14;
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
  haze: Haze,
  alpha: number,
): number {
  let top = Infinity;
  for (const q of c.squads) {
    const p = squadPlace(run.dist, run.x, c, q);
    if (!p || p.merge >= 1) continue;
    const a = alpha * p.shown * (1 - p.merge);
    const tint = hazed(haze(p.dist, FIGURE_TOP));
    const at = project(p.x, p.dist, FIGURE_TOP + 0.3);
    const size = COUNT_K * wallPx(project, p.x, p.dist);
    if (a <= 0 || !at || size <= 0) continue;
    ctx.globalAlpha = a;
    const colour = p.friendly ? TEXT_COLORS.text : TAG_COLOURS.fight;
    outlinedText(
      ctx,
      String(p.standing),
      at.x,
      at.y - size / 2,
      size,
      colour,
      tint,
    );
    top = Math.min(top, at.y - size);
    if (p.tag) {
      outlinedText(
        ctx,
        TAGS[p.tag],
        at.x,
        at.y - size * 1.6,
        size * 0.8,
        TAG_COLOURS[p.tag],
        tint,
      );
      top = Math.min(top, at.y - size * 2);
    }
  }
  ctx.globalAlpha = 1;
  return top;
}

/**
 * The 3D run's track text, projected with the live camera: wall prompts and
 * answer labels (labels fitted to their opening's projected width), crate hit
 * points and rewards, pack and squad counts. Sized by projected height, so it
 * shrinks with distance, hazed toward the fog colour with its object from SHAPE_DISTANCE in, far objects first (walls and
 * hazards interleaved by distance). A passed wall's labels fade and its
 * prompt is gone, as in 2D.
 */
export function renderTrackText(
  ctx: Ctx,
  run: RunState,
  project: Projector,
  haze: Haze,
): void {
  const { questions, hazards } = run.track;
  // squads are drawn only from the view model, never from the rows
  const view = run.track.charges.length ? viewOf(run) : null;
  let w = run.rows.length - 1;
  let h = hazards.length - 1;
  while (w >= 0 || h >= 0) {
    const wallAt = w >= 0 ? (questions[w] ?? Infinity) : -Infinity;
    const hazardAt = h >= 0 ? hazardPos(run, h) : -Infinity;
    if (w >= 0 && wallAt >= hazardAt)
      renderWall(ctx, run, project, haze, view, w--);
    else renderHazardText(ctx, run, project, haze, h--);
  }
}

/** A crate's hit points on its face and its reward above, or a pack's count above it. */
function renderHazardText(
  ctx: Ctx,
  run: RunState,
  project: Projector,
  haze: Haze,
  i: number,
): void {
  const hz = run.track.hazards[i];
  if (!hz || hz.kind === "saw") return;
  const pos = hazardPos(run, i);
  const ahead = pos - run.dist;
  if (ahead < -WALL_BEHIND || ahead > SHAPE_DISTANCE) return;
  if (hz.kind === "pack") {
    if (i < run.nextHazard || isShattered(run, i)) return;
    const n = packSurvivors(run, i);
    const x = run.packs[i]?.x ?? 0.5;
    const at = project(x, pos, FIGURE_TOP + 0.3);
    const size = COUNT_K * wallPx(project, x, pos);
    if (n <= 0 || !at || size <= 0) return;
    outlinedText(
      ctx,
      String(n),
      at.x,
      at.y - size / 2,
      size,
      TAG_COLOURS.fight,
      hazed(haze(pos, FIGURE_TOP)),
    );
    return;
  }
  const hp = run.hp[i] ?? 0;
  if (hp <= 0 || isShattered(run, i)) return;
  const cx = (hz.left + hz.right) / 2;
  const foot = project(cx, pos, 0);
  const top = project(cx, pos, CRATE_H);
  const mid = project(cx, pos, CRATE_H / 2);
  if (!foot || !top || !mid) return;
  const px = foot.y - top.y;
  // a floor keeps near crates readable on a phone, but never beyond the crate's own height
  const hpSize = Math.min(px, Math.max(CRATE_TEXT_MIN_PX, CRATE_HP_K * px));
  const rewardSize = Math.min(
    px,
    Math.max(CRATE_TEXT_MIN_PX, CRATE_REWARD_K * px),
  );
  const tint = hazed(haze(pos, CRATE_H / 2));
  outlinedText(
    ctx,
    String(Math.ceil(hp - (run.damage[i] ?? 0))),
    mid.x,
    mid.y,
    hpSize,
    undefined,
    tint,
  );
  outlinedText(
    ctx,
    `+${crateReward(hp)}`,
    top.x,
    top.y - rewardSize * 0.65,
    rewardSize,
    REWARD_COLOUR,
    tint,
  );
}

function renderWall(
  ctx: Ctx,
  run: RunState,
  project: Projector,
  haze: Haze,
  view: ReturnType<typeof viewOf> | null,
  i: number,
): void {
  const pos = run.track.questions[i] ?? Infinity;
  const ahead = pos - run.dist;
  if (ahead < -WALL_BEHIND || ahead > SHAPE_DISTANCE) return;
  const row = run.rows[i];
  if (!row) return;
  const passed = i < run.next;
  const fade = passed
    ? 1 - Math.min(1, Math.max(0, -ahead) / PASSED_LABEL_FADE_DIST)
    : 1;
  // a charge's squads stand beyond the wall (drawn first), their counts above them
  const charge = isCharge(run.track, i)
    ? view?.charges.find((c) => c.row === i)
    : undefined;
  const squadTop = charge
    ? renderSquadText(ctx, run, charge, project, haze, 1)
    : Infinity;
  // one haze for the prompt and every label: they come out of the haze together
  const tint = hazed(haze(pos, WALL_H / 2));
  if (fade <= 0) return;
  const px = wallPx(project, 0.5, pos);
  if (px <= 0) return;
  ctx.globalAlpha = fade;
  const answered = i === run.next - 1 ? run.lastAnswer : null;
  rowOpenings(run, i).forEach((o, j) => {
    // the one run through goes at once, so it never covers the army
    if (passed && answered?.choice === j) return;
    const c = project(o.centre, pos, WALL_H / 2);
    const l = project(o.left, pos, WALL_H / 2);
    const r = project(o.right, pos, WALL_H / 2);
    if (!c || !l || !r) return;
    const label = row.options[j] ?? "";
    drawLabel(ctx, label, c.x, c.y, LABEL_K * px, r.x - l.x - 6, true, tint);
  });
  ctx.globalAlpha = 1;
  if (passed) return;
  // the prompt sits above the wall, and above any squads beyond it
  const top = project(0.5, pos, WALL_H * (1 + PROMPT_GAP));
  const size = PROMPT_K * px;
  if (!top) return;
  const y = Math.min(top.y, squadTop - 0.15 * size) - size / 2;
  // a long word shrinks to the wall's projected width; a single character is never touched
  const lft = project(0, pos, WALL_H);
  const rgt = project(1, pos, WALL_H);
  const fitted =
    lft && rgt && rgt.x > lft.x
      ? fitSize(ctx, row.prompt, size, rgt.x - lft.x - PROMPT_MARGIN)
      : size;
  outlinedText(ctx, row.prompt, top.x, y, fitted, undefined, tint);
}

/** The boss's HP is this many times its projected height (with a floor); its bar this wide and tall. */
const BOSS_HP_K = 0.32;
const BOSS_HP_MIN_PX = 14;
const BOSS_BAR_W = 0.9;
const BOSS_BAR_H = 0.07;
const BAR_COLOURS = { back: "#2a1f2e", fill: "#ff4a6a", edge: "#ffffff" };

/**
 * The boss's HP above its head, from SHAPE_DISTANCE in: a big number and a
 * bar draining with it, sized by its projected height and hazed with it.
 */
export function renderBossText(
  ctx: Ctx,
  boss: BossView,
  project: Projector,
  haze: Haze,
): void {
  if (boss.dist - boss.armyDist > SHAPE_DISTANCE || boss.alpha <= 0) return;
  const foot = project(0.5, boss.dist, 0);
  const head = project(0.5, boss.dist, BOSS_TOP);
  const top = project(0.5, boss.dist, boss.height);
  if (!foot || !head || !top) return;
  const px = foot.y - head.y;
  if (px <= 0) return;
  const tint = hazed(haze(boss.dist, boss.height));
  const size = Math.max(BOSS_HP_MIN_PX, BOSS_HP_K * px);
  const barW = BOSS_BAR_W * px;
  const barH = Math.max(3, BOSS_BAR_H * px);
  const barY = top.y - 0.12 * px - barH;
  const share = boss.size > 0 ? Math.max(0, boss.hp / boss.size) : 0;
  ctx.globalAlpha = boss.alpha;
  ctx.fillStyle = tint(BAR_COLOURS.back);
  ctx.fillRect(top.x - barW / 2, barY, barW, barH);
  ctx.fillStyle = tint(BAR_COLOURS.fill);
  ctx.fillRect(top.x - barW / 2, barY, barW * share, barH);
  ctx.strokeStyle = tint(BAR_COLOURS.edge);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(top.x - barW / 2, barY, barW, barH);
  outlinedText(
    ctx,
    String(boss.hp),
    top.x,
    barY - size * 0.6,
    size,
    TAG_COLOURS.fight,
    tint,
  );
  ctx.globalAlpha = 1;
}
