import { bossWon } from "../core/boss";
import { crowdWidth } from "../core/crowd";
import { gateReached, type RunState } from "../core/sim";
import { streakTier, type StreakTier } from "../core/scoring";
import { SESSION_LINE_MAX_LINES } from "../core/tuning";
import { KANJI } from "../core/kanji";
import { missedItems } from "../core/run";
import {
  levelName,
  levelProgress,
  maxLevel,
  UNLOCK_SHARE,
  type LevelCard,
} from "../core/progression";
import {
  endLevelCard,
  studyOffered,
  type BossResult,
  type Scene,
  type Session,
} from "./scenes";
import type { SyncStatus } from "../sync/sync";
import {
  startLayout,
  endLayout,
  syncAlert,
  syncLabel,
  type Rect,
} from "./start";
import {
  sessionTokens,
  wrapTokens,
  type PanelToken,
  type SessionLog,
} from "../core/session";
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
import { renderBossText, renderTrackText } from "./three/overlay";
import { fitSize, FONT, outlinedText, text, TEXT_COLORS } from "./labels";

/** How long (in track distance) a clip-loss pop-up stays up. */
const CLIP_POPUP_DIST = 0.8;
/** How long (in track distance) answer feedback stays up. */
const ANSWER_FEEDBACK_DIST = 1.0;
/** How long (in track distance) a crate's "+N" and its recruits running in last. */
const CRATE_POPUP_DIST = 0.8;
const COLORS = {
  bg: "#111",
  track: "#1d2230",
  wall: "#5a6478",
  wallEdge: "#8892a8",
  opening: "rgba(90, 140, 255, 0.18)",
  text: TEXT_COLORS.text,
  dim: TEXT_COLORS.dim,
  soldier: "#ffcf4a",
  enemy: "#e0457b",
  good: "#5fd38d",
  bad: "#ff6b6b",
  hazard: "#c24b4b",
  crate: "#9a6b3a",
  crateEdge: "#d9a865",
  crateDark: TEXT_COLORS.outline,
  hazardEdge: "#ff8a7a",
  goodFill: "rgba(95, 211, 141, 0.35)",
  chargeLine: "#ffb347",
  banner: "rgba(20, 24, 36, 0.85)",
  enemyBullet: "#ff9bbd",
  bullet: "#fff3b0",
  badFill: "rgba(255, 107, 107, 0.35)",
  /** The empty part of the end screen's level bar, on its panel. */
  barTrack: "#2c3345",
};

type Ctx = CanvasRenderingContext2D;

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

function button(
  ctx: Ctx,
  r: Rect,
  label: string,
  size: number,
  fill = COLORS.track,
): void {
  ctx.fillStyle = fill;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = COLORS.wallEdge;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(r.x + 0.75, r.y + 0.75, r.w - 1.5, r.h - 1.5);
  text(ctx, label, r.x + r.w / 2, r.y + r.h / 2, size);
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

/** The missed list's rows never get thinner than this because of the session line. */
const MISSED_MIN_ROW_H = 20;
/** Widest a missed item's prompt is drawn on the end screen (px); only words reach it. */
const MISSED_PROMPT_MAX_W = 132;
/** The end screen's side margin (px). */
const END_PAD = 20;
const SESSION_ITEM_PX = 16;
const SESSION_LABEL_PX = 14;
const SESSION_LINE_H = 20;
const SESSION_GAP = 5;

/** Text at (x, y), vertically centred, optionally bold, shrunk to `maxW`. */
function put(
  ctx: Ctx,
  s: string,
  x: number,
  y: number,
  size: number,
  color: string,
  align: CanvasTextAlign = "center",
  bold = false,
  maxW = Infinity,
): number {
  const font = (px: number): string =>
    `${bold ? "bold " : ""}${Math.round(px)}px ${FONT}`;
  ctx.font = font(size);
  const width = ctx.measureText(s).width;
  if (width > maxW) ctx.font = font((size * maxW) / width);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(s, x, y);
  return Math.min(width, maxW);
}

function panel(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.fillStyle = COLORS.track;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

/**
 * The end screen, top to bottom: result, level card, stat tiles, missed rows,
 * the session line, then the buttons. Short screens get tighter gaps; the
 * missed rows shrink to the space left.
 */
function renderEnd(
  ctx: Ctx,
  w: number,
  h: number,
  run: RunState,
  boss: BossResult | null,
  session: Session,
): void {
  const compact = h < 760;
  const gap = compact ? 10 : 18;
  const inner = w - 2 * END_PAD;
  let y = compact ? 22 : 40;

  // result
  const won = boss?.won ?? false;
  const title = !boss ? "Army wiped out" : won ? "Boss defeated!" : "Boss wins";
  const titlePx = Math.min(36, w / 9);
  put(
    ctx,
    title,
    w / 2,
    y + 22,
    titlePx,
    won ? COLORS.good : COLORS.bad,
    "center",
    true,
    inner,
  );
  y += 50;
  if (!boss) {
    const { gate, of } = gateReached(run);
    const sub = `The boss was never reached · gate ${gate} of ${of}`;
    put(ctx, sub, w / 2, y + 13, 16, COLORS.dim, "center", false, inner);
  } else {
    const tie = run.army === boss.size ? " · a tie is a loss" : "";
    const sub = `Army ${run.army} vs boss ${boss.size}${tie}`;
    put(ctx, sub, w / 2, y + 13, 22, COLORS.text, "center", true, inner);
  }
  y += 26 + gap;

  y = renderLevelCard(ctx, w, y, compact, endLevelCard(session)) + gap;
  y = renderStatTiles(ctx, w, y, compact, run) + gap;

  // the session line sits just above the buttons; the missed rows fill what's between
  const buttons = endLayout(w, h, studyOffered(run, boss, session));
  const listTop = y + 24;
  const misses = missedItems(
    run.rows,
    run.results,
    run.track.charges,
    session.wk?.kanji ?? KANJI,
  );
  const line = (maxLines: number) =>
    session.log ? layoutSessionLine(ctx, inner, session.log, maxLines) : null;
  const sessionTop = (l: ReturnType<typeof line>): number =>
    buttons.play.y - gap - (l ? l.lines.length * SESSION_LINE_H : 0);
  let sl = line(SESSION_LINE_MAX_LINES);
  const pitch = (l: ReturnType<typeof line>): number =>
    (sessionTop(l) - gap - listTop) / Math.max(1, misses.length);
  if (sl && sl.lines.length > 1 && pitch(sl) < MISSED_MIN_ROW_H) sl = line(1);

  // the session line follows the list, never lower than just above the buttons
  let listBottom = y + 54;
  if (misses.length === 0) {
    put(ctx, "No misses!", w / 2, y + 26, 26, COLORS.good, "center", true);
  } else {
    put(
      ctx,
      `Missed (${misses.length})`,
      END_PAD,
      y + 8,
      14,
      COLORS.dim,
      "left",
    );
    const p = Math.min(64, pitch(sl));
    const rowGap = Math.min(8, p * 0.15);
    const rowH = p - rowGap;
    misses.forEach((m, i) => {
      const top = listTop + p * i;
      renderMissedRow(ctx, w, top, rowH, m);
    });
    listBottom = listTop + p * misses.length - rowGap;
  }
  if (sl)
    renderSessionLine(
      ctx,
      Math.min(listBottom + gap, sessionTop(sl)),
      sl.lines,
      sl.hidden,
    );
  renderEndButtons(ctx, buttons);
}

/** The level card: level and learned count, the bar, "+N learned this run" (dim at +0) and what's left to unlock. Returns its bottom. */
function renderLevelCard(
  ctx: Ctx,
  w: number,
  top: number,
  compact: boolean,
  card: LevelCard,
): number {
  const pad = compact ? 12 : 16;
  const step = compact ? 8 : 10;
  const x = END_PAD;
  const cw = w - 2 * END_PAD;
  // a row of the characters learned this run, when there are any
  const charsH = card.learnedNow.length ? (compact ? 28 : 32) : 0;
  const h = 2 * pad + 22 + step + 14 + step + 16 + charsH;
  panel(ctx, x, top, cw, h, 12);
  const left = x + 14;
  const right = x + cw - 14;
  let y = top + pad + 11;
  const name = levelName(card.level);
  const nameW = put(ctx, name, left, y, 18, COLORS.text, "left", true, cw / 2);
  const learned = `${card.learned} of ${card.total} learned`;
  put(
    ctx,
    learned,
    right,
    y,
    14,
    COLORS.dim,
    "right",
    false,
    right - left - nameW - 12,
  );

  // the bar: learned before the run, learned this run (faded), the unlock mark
  y += 11 + step;
  const bw = right - left;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(left, y, bw, 14, 7);
  ctx.fillStyle = COLORS.barTrack;
  ctx.fill();
  ctx.clip();
  if (card.total) {
    const before = (bw * (card.learned - card.gained)) / card.total;
    ctx.fillStyle = COLORS.good;
    ctx.beginPath();
    ctx.roundRect(left, y, before, 14, 7);
    ctx.fill();
    ctx.fillStyle = COLORS.goodFill;
    ctx.fillRect(left + before, y, (bw * card.gained) / card.total, 14);
  }
  ctx.restore();
  if (!card.last) {
    ctx.fillStyle = COLORS.soldier;
    ctx.fillRect(left + bw * UNLOCK_SHARE - 1, y - 4, 2, 22);
  }

  y += 14 + step + 8;
  const gainedNote =
    card.unlocked !== null
      ? `${levelName(card.unlocked)} unlocked!`
      : `+${card.gained} learned this run`;
  const noteW = put(
    ctx,
    gainedNote,
    left,
    y,
    13,
    card.unlocked === null && card.gained === 0 ? COLORS.dim : COLORS.good,
    "left",
    card.unlocked !== null,
    bw / 2,
  );
  const next = levelName(card.level + 1);
  const unlock = card.last
    ? "Last level"
    : card.toUnlock > 0
      ? `${card.toUnlock} more to unlock ${next}`
      : `${next} unlocks next run`;
  put(
    ctx,
    unlock,
    right,
    y,
    13,
    card.last ? COLORS.dim : COLORS.soldier,
    "right",
    false,
    bw - noteW - 12,
  );
  if (charsH) renderLearnedNow(ctx, card.learnedNow, left, right, y + charsH);
  return top + h;
}

/** Learned-this-run characters in a row from `left`; what doesn't fit becomes "+N". */
function renderLearnedNow(
  ctx: Ctx,
  chars: readonly string[],
  left: number,
  right: number,
  y: number,
): void {
  const size = 22;
  const gap = 10;
  ctx.font = `${size}px ${FONT}`;
  const widths = chars.map((c) => ctx.measureText(c).width);
  let x = left;
  for (let i = 0; i < chars.length; i++) {
    const rest = chars.length - i - 1;
    // keep room for the "+N" tail whenever something would be left out
    const tail = rest ? ctx.measureText(`+${rest}`).width + gap : 0;
    const cw = widths[i] ?? size;
    if (x + cw + tail > right && i > 0) {
      put(ctx, `+${chars.length - i}`, x, y, 16, COLORS.dim, "left");
      return;
    }
    put(ctx, chars[i] ?? "", x, y, size, COLORS.good, "left");
    x += cw + gap;
  }
}

/** Accuracy, gates right and best streak, three tiles in a row. Returns their bottom. */
function renderStatTiles(
  ctx: Ctx,
  w: number,
  top: number,
  compact: boolean,
  run: RunState,
): number {
  const correct = run.results.filter(Boolean).length;
  const answered = run.results.length;
  const accuracy = answered ? Math.round((correct / answered) * 100) : 0;
  const tiles: [string, string, string][] = [
    [`${accuracy}%`, "Accuracy", COLORS.text],
    [`${correct}/${answered}`, "Gates right", COLORS.text],
    [String(run.bestStreak), "Best streak", COLORS.soldier],
  ];
  const th = compact ? 54 : 64;
  const tw = (w - 2 * END_PAD - 16) / 3;
  tiles.forEach(([value, label, color], i) => {
    const x = END_PAD + i * (tw + 8);
    panel(ctx, x, top, tw, th, 10);
    put(
      ctx,
      value,
      x + tw / 2,
      top + th * 0.4,
      22,
      color,
      "center",
      true,
      tw - 12,
    );
    put(
      ctx,
      label,
      x + tw / 2,
      top + th * 0.76,
      12,
      COLORS.dim,
      "center",
      false,
      tw - 8,
    );
  });
  return top + th;
}

/** One missed gate as a rounded row: gate number, prompt, answers, a "charge" tag. */
function renderMissedRow(
  ctx: Ctx,
  w: number,
  top: number,
  rowH: number,
  m: ReturnType<typeof missedItems>[number],
): void {
  const x = END_PAD;
  const rw = w - 2 * END_PAD;
  panel(ctx, x, top, rw, rowH, Math.min(10, rowH / 2));
  const y = top + rowH / 2;
  // fonts fill a thin row: on a tight list they stay readable rather than to scale
  const size = Math.min(30, rowH * 0.85);
  const small = Math.min(13, rowH * 0.7);
  put(ctx, String(m.q), x + 14, y, small, COLORS.dim, "left");
  const promptX = x + 14 + 18 + 14;
  // a long word shrinks to MISSED_PROMPT_MAX_W and pushes its answer right
  const promptW = put(
    ctx,
    m.prompt,
    promptX,
    y,
    size,
    COLORS.text,
    "left",
    false,
    MISSED_PROMPT_MAX_W,
  );
  let right = x + rw - 14;
  if (m.charge) {
    ctx.font = `${Math.round(small)}px ${FONT}`;
    const tagW = ctx.measureText("charge").width + 12;
    const tagH = Math.min(rowH - 2, small + 8);
    ctx.strokeStyle = COLORS.chargeLine;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(
      right - tagW + 0.5,
      y - tagH / 2 + 0.5,
      tagW - 1,
      tagH - 1,
      6,
    );
    ctx.stroke();
    put(ctx, "charge", right - tagW / 2, y, small, COLORS.chargeLine);
    right -= tagW + 10;
  }
  const answerX = Math.max(promptX + 44, promptX + promptW + 14);
  const answer = m.answers.join(" · ");
  put(
    ctx,
    answer,
    answerX,
    y,
    Math.min(20, rowH * 0.7),
    COLORS.good,
    "left",
    false,
    Math.max(1, right - answerX),
  );
}

/** The session line wrapped to `maxLines` across `avail` px. */
function layoutSessionLine(
  ctx: Ctx,
  avail: number,
  log: SessionLog,
  maxLines: number,
) {
  const measure = (t: PanelToken): number => {
    ctx.font = `${t.kind === "item" ? SESSION_ITEM_PX : SESSION_LABEL_PX}px ${FONT}`;
    return ctx.measureText(t.kind === "item" ? t.entry.prompt : t.s).width;
  };
  return wrapTokens(sessionTokens(log), avail, maxLines, SESSION_GAP, measure);
}

/** "Session · run 3 · fixed 左 玉 · still missing 右 石": fixed this run in good colour. */
function renderSessionLine(
  ctx: Ctx,
  top: number,
  lines: PanelToken[][],
  hidden: number,
): void {
  lines.forEach((tokens, li) => {
    const y = top + SESSION_LINE_H * (li + 0.5);
    let x = END_PAD;
    const draw = (s: string, color: string, size: number): void => {
      x += put(ctx, s, x, y, size, color, "left") + SESSION_GAP;
    };
    for (const t of tokens) {
      if (t.kind === "label") draw(t.s, COLORS.dim, SESSION_LABEL_PX);
      else
        draw(
          t.entry.prompt,
          t.entry.thisRun ? COLORS.good : COLORS.text,
          SESSION_ITEM_PX,
        );
    }
    if (hidden && li === lines.length - 1)
      draw(`+${hidden}`, COLORS.dim, SESSION_LABEL_PX);
  });
}

/** Play again (filled), then Study and Home (outlined). */
function renderEndButtons(ctx: Ctx, l: ReturnType<typeof endLayout>): void {
  const { play } = l;
  ctx.fillStyle = COLORS.good;
  ctx.beginPath();
  ctx.roundRect(play.x, play.y, play.w, play.h, 12);
  ctx.fill();
  ctx.font = `bold 18px ${FONT}`;
  ctx.fillStyle = COLORS.bg;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Play again", play.x + play.w / 2, play.y + play.h / 2);
  const outlined = (r: Rect, label: string): void => {
    ctx.strokeStyle = COLORS.wallEdge;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1, 12);
    ctx.stroke();
    text(ctx, label, r.x + r.w / 2, r.y + r.h / 2, 17);
  };
  if (l.study) outlined(l.study, "Study");
  outlined(l.home, "Home");
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
