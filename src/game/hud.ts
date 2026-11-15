import { bossWon } from "../core/boss";
import { crowdWidth } from "../core/crowd";
import type { RunState } from "../core/sim";
import { streakTier, type StreakTier } from "../core/scoring";
import type { Scene, Session } from "./scenes";
import {
  CROWD_DEPTH,
  DIST_SCALE,
  TRACK_W,
  type Projector,
} from "./three/world";
import { FIGURE_TOP } from "./three/wallLayout";
import { bossFightAt, type BossView } from "./three/bossLayout";
import { type Haze } from "./three/camera";
import { renderBossText, renderTrackText } from "./three/overlay";
import { fitSize, outlinedText, text } from "./labels";
import { COLORS, type Ctx } from "./draw";

/** How long (in track distance) a clip-loss pop-up stays up. */
const CLIP_POPUP_DIST = 0.8;
/** How long (in track distance) answer feedback stays up. */
const ANSWER_FEEDBACK_DIST = 1.0;
/** How long (in track distance) a crate's "+N" and its recruits running in last. */
const CRATE_POPUP_DIST = 0.8;
/** How a streak tier is named in pop-ups and on the HUD. */
const TIER_POPUP: Record<StreakTier, string> = {
  base: "",
  "double-base": "2× base",
  double: "×2",
  triple: "×3",
};

/** What the 3D view gives the overlay: where things are on screen, how hazy, and the boss. */
export type TrackView = { project: Projector; haze: Haze; boss?: BossView };

/** Whether a paused run shows the DOM pause card (never in meaning mode: it shows readings). */
export const hasPauseCard = (run: RunState, session: Session): boolean =>
  run.results.length > 0 && !session.meaning;

/** With `lastPanel`, the DOM pause panel (src/game/pausecard.ts) shows the title and hint. */
export function renderPaused(
  ctx: Ctx,
  w: number,
  h: number,
  lastPanel: boolean,
): void {
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(0, 0, w, h);
  if (!lastPanel) {
    text(ctx, "Paused", w / 2, h / 2 - 20, 40);
    text(ctx, "Tap or P to resume", w / 2, h / 2 + 24, 20, COLORS.dim);
  }
  text(ctx, __BUILD__, w / 2, h - 24, 14, COLORS.dim);
}

/**
 * The 3D run's overlay: the army's count and pop-ups placed on the projected
 * crowd, and the HUD. Outlined, so it reads over the bright scene.
 */
export function renderRunOverlay(
  ctx: Ctx,
  w: number,
  h: number,
  run: RunState,
  { project, haze, boss }: TrackView,
): void {
  if (boss) renderBossText(ctx, boss, project, haze);
  renderTrackText(ctx, run, project, haze);
  const centre = project(run.x, run.dist, 0);
  const half = crowdWidth(run.army) / 2;
  const right = project(run.x + half, run.dist, 0);
  // the crowd's front edge, nearest the camera
  const front = project(
    run.x,
    run.dist - (half * CROWD_DEPTH * TRACK_W) / DIST_SCALE,
    0,
  );
  // the top of the crowd's far edge: the clip loss rises from there, clear of the figures
  const back = project(
    run.x,
    run.dist + (half * CROWD_DEPTH * TRACK_W) / DIST_SCALE,
    FIGURE_TOP,
  );
  if (centre && right && front && back) {
    const radius = Math.max(8, right.x - centre.x);
    // below the crowd's front, kept on screen when a big crowd reaches the bottom
    const countY = Math.min(front.y + 20, h - 16);
    outlinedText(ctx, String(run.army), centre.x, countY, 22);
    renderArmyPopups(
      ctx,
      w,
      run,
      centre.x,
      centre.y,
      radius,
      outlinedText,
      back.y - 16,
    );
  }
  // a crate's payout, left of the crowd as in 2D (its recruits run in, in the scene)
  const gain = run.lastCrate;
  const gt = gain ? (run.dist - gain.dist) / CRATE_POPUP_DIST : 1;
  if (gain && gt >= 0 && gt < 1 && centre && right) {
    const radius = Math.max(8, right.x - centre.x);
    ctx.globalAlpha = 1 - gt;
    outlinedText(
      ctx,
      `+${gain.gain}`,
      Math.max(36, centre.x - radius - 28),
      centre.y - 10 - 24 * gt,
      24,
      COLORS.good,
    );
    ctx.globalAlpha = 1;
  }
  renderHud(ctx, w, run, outlinedText);
}

/** The clash's result over the scene: Victory, Defeated, or a tie (the boss holds). */
function renderBossBanner(
  ctx: Ctx,
  w: number,
  h: number,
  army: number,
  boss: number,
): void {
  const won = bossWon(army, boss);
  const msg = won
    ? "Victory!"
    : army === boss
      ? "Tie: the boss holds"
      : "Defeated";
  ctx.fillStyle = COLORS.banner;
  // above the clash, clear of the survivors
  const by = h * 0.24;
  ctx.fillRect(0, by - 36, w, 72);
  text(
    ctx,
    msg,
    w / 2,
    by,
    fitSize(ctx, msg, 40, w - 32),
    won ? COLORS.good : COLORS.bad,
  );
}

/**
 * The 3D boss fight's overlay: the run's overlay for the army as drawn
 * (running on to the firing stop, losing soldiers per clashAt), the boss's
 * HP, and the result banner once the clash is over. No title: the switch
 * from the run is invisible.
 */
export function renderBossOverlay(
  ctx: Ctx,
  w: number,
  h: number,
  scene: Extract<Scene, { kind: "boss" }>,
  view: TrackView,
): void {
  const fight = bossFightAt(scene.run.army, scene.boss, scene.t);
  const run = {
    ...scene.run,
    dist: view.boss?.armyDist ?? scene.run.dist,
    army: fight.army,
  };
  renderRunOverlay(ctx, w, h, run, view);
  if (fight.ending) renderBossBanner(ctx, w, h, scene.run.army, scene.boss);
}

type Draw = typeof text;

/** The clip loss and answer feedback around the army at (cx, armyY). */
function renderArmyPopups(
  ctx: Ctx,
  w: number,
  run: RunState,
  cx: number,
  armyY: number,
  radius: number,
  draw: Draw = text,
  clipY = armyY - radius * 0.6 - 24,
): void {
  // (frozen once the run is over: not shown while the enemies cheer)
  if (run.lastClip && run.status === "running") {
    const t = (run.dist - run.lastClip.dist) / CLIP_POPUP_DIST;
    if (t < 1) {
      ctx.globalAlpha = 1 - t;
      draw(ctx, `−${run.lastClip.loss}`, cx, clipY - 30 * t, 26, COLORS.bad);
      ctx.globalAlpha = 1;
    }
  }

  if (run.lastAnswer) {
    const a = run.lastAnswer;
    const t = (run.dist - a.dist) / ANSWER_FEEDBACK_DIST;
    if (t < 1) {
      const color = a.correct ? COLORS.good : COLORS.bad;
      // a faint ring that swells and fades, plus the army change
      ctx.globalAlpha = 0.5 * (1 - t);
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, armyY, radius + 8 + 24 * t, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1 - t;
      const sign = a.change >= 0 ? "+" : "−";
      const px = Math.min(cx + radius + 28, w - 36);
      const py = armyY - 10 - 24 * t;
      draw(ctx, `${sign}${Math.abs(a.change)}`, px, py, 24, color);
      // what caused it: the streak's multiplier, or the share lost
      const before = run.army - a.change;
      const tag = a.correct
        ? TIER_POPUP[streakTier(run.streak)]
        : before > 0
          ? `−${Math.round((-a.change / before) * 100)}%`
          : "";
      if (tag) draw(ctx, tag, px, py + 22, 18, color);
      ctx.globalAlpha = 1;
    }
  }
}

/** Question number and streak, top corners. */
function renderHud(
  ctx: Ctx,
  w: number,
  run: RunState,
  draw: Draw = text,
): void {
  // no questions: no question count
  if (run.rows.length > 0)
    draw(
      ctx,
      `${Math.min(run.next + 1, run.rows.length)}/${run.rows.length}`,
      40,
      24,
      16,
      COLORS.dim,
    );
  if (run.streak > 0) {
    // the streak, and what the next right answer pays
    const tier = streakTier(run.streak + 1);
    const hot = tier !== "base";
    draw(ctx, `streak ${run.streak}`, w - 60, 24, 16, COLORS.good);
    if (hot)
      draw(ctx, `next ${TIER_POPUP[tier]}`, w - 60, 44, 16, COLORS.chargeLine);
  }
}
