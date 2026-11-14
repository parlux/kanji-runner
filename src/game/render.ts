import { bossWon } from "../core/boss";
import { crowdWidth } from "../core/crowd";
import type { RunState } from "../core/sim";
import { streakTier, type StreakTier } from "../core/scoring";
import { KANJI } from "../core/kanji";
import {
  levelName,
  levelProgress,
  maxLevel,
  UNLOCK_SHARE,
} from "../core/progression";
import type { Scene, Session } from "./scenes";
import type { SyncStatus } from "../sync/sync";
import { startLayout, syncAlert, syncLabel, type Rect } from "./start";
import {
  CROWD_DEPTH,
  DIST_SCALE,
  FIGURE_TOP,
  TRACK_W,
  bossFightAt,
  type BossView,
  type Haze,
  type Projector,
} from "./three/world";
import { renderEnd } from "./screens/end";
import { renderBossText, renderTrackText } from "./three/overlay";
import { fitSize, FONT, outlinedText, text } from "./labels";
import { button, COLORS, type Ctx } from "./draw";

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

export function render(
  ctx: Ctx,
  w: number,
  h: number,
  scene: Scene,
  session: Session,
  sync: SyncStatus = "disabled",
  view3d?: TrackView,
  /** The other mode's unlocked level, for the mode switch; null hides it. */
  otherLevel: number | null = null,
  /** False when WebGL is unavailable: the start screen says so and Play does nothing. */
  canPlay = true,
): void {
  // with a 3D view, the run and boss are drawn behind this canvas: draw only the overlay
  if (view3d && scene.kind === "run") {
    ctx.clearRect(0, 0, w, h);
    renderRunOverlay(ctx, w, h, scene.run, view3d);
    if (scene.paused) renderPaused(ctx, w, h, hasPauseCard(scene.run, session));
    return;
  }
  if (view3d && scene.kind === "boss") {
    ctx.clearRect(0, 0, w, h);
    return renderBossOverlay(ctx, w, h, scene, view3d);
  }
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, w, h);
  if (scene.kind === "start")
    return renderStart(
      ctx,
      w,
      h,
      session,
      scene.pick,
      sync,
      otherLevel,
      canPlay,
    );
  if (scene.kind === "end")
    return renderEnd(ctx, w, h, scene.run, scene.boss, session);
  // a run or boss clash without the 3D view is never entered: only the backdrop
}

/** Whether a paused run shows the DOM pause card (never in meaning mode: it shows readings). */
const hasPauseCard = (run: RunState, session: Session): boolean =>
  run.results.length > 0 && !session.meaning;

/** With `lastPanel`, the DOM pause panel (src/game/pausecard.ts) shows the title and hint. */
function renderPaused(
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
  text(ctx, `build ${__BUILD__}`, w / 2, h - 24, 14, COLORS.dim);
}

/**
 * The 3D run's overlay: the army's count and pop-ups placed on the projected
 * crowd, and the HUD. Outlined, so it reads over the bright scene.
 */
function renderRunOverlay(
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

function renderStart(
  ctx: Ctx,
  w: number,
  h: number,
  session: Session,
  pick: number | undefined,
  sync: SyncStatus,
  otherLevel: number | null,
  canPlay: boolean,
): void {
  if (pick !== undefined) return renderPicker(ctx, w, h, session, pick);
  const l = startLayout(w, h);
  renderGear(ctx, l.settings);
  // sync shows only when it needs attention; meaning mode never syncs
  if (!session.meaning && syncAlert(sync)) renderSyncLabel(ctx, w, h, sync);
  text(ctx, "Kanji Runner", w / 2, h * 0.17, Math.min(52, w / 8));
  renderModeSwitch(ctx, w, h, session, otherLevel);
  renderLevel(ctx, w, h * 0.46, session);
  unlockedNote(ctx, w, h * 0.46 + 92, session, 22);
  renderPlay(ctx, l.play);
  if (!canPlay) {
    const msg = "This device can't run the 3D game";
    text(
      ctx,
      msg,
      w / 2,
      l.play.y - 24,
      fitSize(ctx, msg, 17, w - 32),
      COLORS.bad,
    );
  }
  if (!session.wk) {
    const label = "I already know some…";
    const cy = l.place.y + l.place.h / 2;
    text(ctx, label, w / 2, cy, 15, COLORS.dim);
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = COLORS.dim;
    ctx.fillRect(w / 2 - tw / 2, cy + 10, tw, 1);
  }
  // the about line: the kanji data's licence requires this credit
  text(
    ctx,
    "Kanji data: KANJIDIC2, KRADFILE · © EDRDG, CC BY-SA 4.0",
    w / 2,
    h - 32,
    fitSize(
      ctx,
      "Kanji data: KANJIDIC2, KRADFILE · © EDRDG, CC BY-SA 4.0",
      11,
      w - 32,
    ),
    COLORS.dim,
  );
  text(ctx, `build ${__BUILD__}`, w / 2, h - 11, 10, COLORS.dim);
}

const ON_FILL = "#2f6b48";

/** The settings gear: a toothed ring, dim. */
function renderGear(ctx: Ctx, r: Rect): void {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = COLORS.dim;
  for (let i = 0; i < 8; i++) {
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-2.5, -11, 5, 6);
  }
  ctx.beginPath();
  ctx.arc(0, 0, 7.5, 0, Math.PI * 2);
  ctx.arc(0, 0, 3.5, 0, Math.PI * 2, true);
  ctx.fill("evenodd");
  ctx.restore();
}

/** Normal / Meanings only, each half with its mode's level; the current one filled. */
function renderModeSwitch(
  ctx: Ctx,
  w: number,
  h: number,
  session: Session,
  otherLevel: number | null,
): void {
  const l = startLayout(w, h);
  const level = session.progress.unlockedLevel;
  const halves = [
    {
      r: l.modeNormal,
      name: "Normal",
      on: !session.meaning,
      level: session.meaning ? otherLevel : level,
    },
    {
      r: l.modeMeaning,
      name: "Meanings only",
      on: session.meaning,
      level: session.meaning ? level : otherLevel,
    },
  ];
  const outer = {
    x: l.modeNormal.x,
    y: l.modeNormal.y,
    w: l.modeNormal.w + l.modeMeaning.w,
    h: l.modeNormal.h,
  };
  ctx.fillStyle = COLORS.track;
  ctx.beginPath();
  ctx.roundRect(outer.x, outer.y, outer.w, outer.h, 12);
  ctx.fill();
  ctx.strokeStyle = COLORS.wall;
  ctx.lineWidth = 1;
  ctx.stroke();
  for (const half of halves) {
    const { r } = half;
    if (half.on) {
      ctx.fillStyle = ON_FILL;
      ctx.beginPath();
      ctx.roundRect(r.x + 4, r.y + 4, r.w - 8, r.h - 8, 9);
      ctx.fill();
    }
    const color = half.on ? COLORS.text : COLORS.dim;
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    const size = fitSize(ctx, half.name, 16, r.w - 16);
    if (half.level === null) text(ctx, half.name, cx, cy, size, color);
    else {
      text(ctx, half.name, cx, cy - 9, size, color);
      text(ctx, levelName(half.level), cx, cy + 12, 12, color);
    }
  }
  const sub = session.meaning
    ? "Kanji → English meanings"
    : "Kana, readings and meanings";
  text(ctx, sub, w / 2, outer.y + outer.h + 20, 13, COLORS.dim);
}

/** The big green Play button. */
function renderPlay(ctx: Ctx, r: Rect): void {
  ctx.fillStyle = COLORS.good;
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, 14);
  ctx.fill();
  ctx.font = `bold 22px ${FONT}`;
  ctx.fillStyle = COLORS.bg;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Play", r.x + r.w / 2, r.y + r.h / 2);
}

const SYNC_DOT: Record<SyncStatus, string> = {
  synced: COLORS.good,
  offline: COLORS.dim,
  login: COLORS.chargeLine,
  disabled: COLORS.dim,
};

/** A small pill, top right by the gear: a status dot and Offline / Log in. */
function renderSyncLabel(
  ctx: Ctx,
  w: number,
  h: number,
  status: SyncStatus,
): void {
  const label = syncLabel(status);
  if (label === null) return;
  const r = startLayout(w, h).sync;
  ctx.strokeStyle = COLORS.wall;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1, r.h / 2);
  ctx.stroke();
  const cy = r.y + r.h / 2;
  ctx.fillStyle = SYNC_DOT[status];
  ctx.beginPath();
  ctx.arc(r.x + 20, cy, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = `15px ${FONT}`;
  ctx.fillStyle = status === "login" ? COLORS.text : COLORS.dim;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(label, r.x + 34, cy);
}

/** "Kanji 2 unlocked!" after a run that unlocked a level. */
function unlockedNote(
  ctx: Ctx,
  w: number,
  y: number,
  session: Session,
  size = 30,
): void {
  if (session.unlocked === null) return;
  const msg = `${levelName(session.unlocked)} unlocked!`;
  text(ctx, msg, w / 2, y, fitSize(ctx, msg, size, w - 48), COLORS.good);
}

/** "I already know up to …": −/+ to choose, Apply or Cancel. */
function renderPicker(
  ctx: Ctx,
  w: number,
  h: number,
  session: Session,
  pick: number,
): void {
  const l = startLayout(w, h);
  ctx.fillStyle = COLORS.banner;
  ctx.fillRect(l.panel.x, l.panel.y, l.panel.w, l.panel.h);
  text(ctx, "I already know up to", w / 2, l.panel.y + 32, 20, COLORS.dim);
  // meaning mode has no kana levels: its lowest pick (Katakana) means none
  const none = pick < (session.meaning ? 2 : 0);
  const name = none ? "Nothing yet" : levelName(pick);
  const cy = l.minus.y + l.minus.h / 2;
  text(
    ctx,
    name,
    w / 2,
    cy,
    fitSize(ctx, name, 30, l.plus.x - l.minus.x - l.minus.w - 8),
  );
  button(ctx, l.minus, "−", 32);
  button(ctx, l.plus, "+", 32);
  const unlocked = session.progress.unlockedLevel;
  const target = pick + 1;
  const note =
    target < unlocked
      ? `Lowers your level from ${levelName(unlocked)}`
      : `Start at ${levelName(target)}`;
  text(
    ctx,
    note,
    w / 2,
    cy + l.minus.h / 2 + 26,
    16,
    target < unlocked ? COLORS.chargeLine : COLORS.dim,
  );
  button(ctx, l.apply, "Apply", 22, ON_FILL);
  button(ctx, l.cancel, "Cancel", 18);
  text(
    ctx,
    "←/→ choose · Enter apply · Esc cancel",
    w / 2,
    l.cancel.y + l.cancel.h + 28,
    14,
    COLORS.dim,
  );
}

/** Current level, a learned bar with the unlock mark, and what it unlocks. */
function renderLevel(ctx: Ctx, w: number, y: number, session: Session): void {
  const level = session.progress.unlockedLevel;
  const p = levelProgress(session.progress, level, session.kana, KANJI);
  text(ctx, levelName(level), w / 2, y, 30);
  const bw = Math.min(300, w - 64);
  const bx = (w - bw) / 2;
  const by = y + 28;
  const bh = 12;
  ctx.fillStyle = COLORS.track;
  ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = COLORS.good;
  if (p.total) ctx.fillRect(bx, by, (bw * p.learned) / p.total, bh);
  ctx.fillStyle = COLORS.text;
  ctx.fillRect(bx + bw * UNLOCK_SHARE - 1, by - 4, 2, bh + 8);
  const unlocks =
    level >= maxLevel(KANJI)
      ? "last level"
      : p.learned >= p.needed
        ? `${levelName(level + 1)} unlocks next run`
        : `${p.needed} needed for ${levelName(level + 1)}`;
  const line = `${p.learned}/${p.total} learned · ${unlocks}`;
  text(
    ctx,
    line,
    w / 2,
    by + bh + 20,
    fitSize(ctx, line, 15, w - 32),
    COLORS.dim,
  );
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
function renderBossOverlay(
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
