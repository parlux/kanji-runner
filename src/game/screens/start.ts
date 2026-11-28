import type { AudioSettings } from "../../audio/settings";
import { VOICE_CREDIT } from "../../audio/voice";
import { levelName, levelProgress, maxLevel } from "../../core/progression";
import { KANJI } from "../../core/kanji";
import { levelWords, type Session } from "../scenes";
import type { SyncStatus } from "../../sync/sync";
import { startLayout, syncAlert, syncLabel, type Rect } from "../start";
import { button, COLORS, type Ctx } from "../draw";
import { fitSize, FONT, text } from "../labels";
import { groupedLevelName, unlockLine } from "../levelcopy";

export function renderStart(
  ctx: Ctx,
  w: number,
  h: number,
  session: Session,
  pick: number | undefined,
  sync: SyncStatus,
  otherLevel: number | null,
  canPlay: boolean,
  audio: AudioSettings,
): void {
  if (pick !== undefined) return renderPicker(ctx, w, h, session, pick);
  const l = startLayout(w, h);
  renderGear(ctx, l.settings);
  // sync shows only when it needs attention; meaning mode never syncs
  if (!session.meaning && syncAlert(sync)) renderSyncLabel(ctx, w, h, sync);
  text(ctx, "Kanji Runner", w / 2, h * 0.17, Math.min(52, w / 8));
  renderModeSwitch(ctx, w, h, session, otherLevel);
  renderLevel(ctx, w, h * 0.46, session);
  unlockedNote(ctx, w, h * 0.46 + 118, session, 22);
  renderToggles(ctx, w, h, audio);
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
  // the about lines: the voice's terms and the kanji data's licence ask for these credits
  text(ctx, `Voice: ${VOICE_CREDIT}`, w / 2, h - 50, 11, COLORS.dim);
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
  text(ctx, __BUILD__, w / 2, h - 11, 10, COLORS.dim);
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

const TOGGLE_NAMES = { voice: "Voice", sfx: "Sound", music: "Music" };

/** Voice / Sound / Music: a pill each, filled green when on. */
function renderToggles(
  ctx: Ctx,
  w: number,
  h: number,
  audio: AudioSettings,
): void {
  for (const { kind, rect: r } of startLayout(w, h).toggles) {
    const on = audio[kind];
    ctx.fillStyle = on ? ON_FILL : COLORS.track;
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 12);
    ctx.fill();
    ctx.strokeStyle = on ? COLORS.good : COLORS.wall;
    ctx.lineWidth = 1;
    ctx.stroke();
    const color = on ? COLORS.text : COLORS.dim;
    text(ctx, TOGGLE_NAMES[kind], r.x + r.w / 2, r.y + 19, 16, color);
    text(ctx, on ? "On" : "Off", r.x + r.w / 2, r.y + 39, 12, color);
  }
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
  button(ctx, l.minusTen, "−10", 20);
  button(ctx, l.plusTen, "+10", 20);
  button(ctx, l.apply, "Apply", 22, ON_FILL);
  button(ctx, l.cancel, "Cancel", 18);
  const keys = "←/→ choose · PgDn/PgUp ±10 · Enter apply · Esc cancel";
  const keysY = l.cancel.y + l.cancel.h + 28;
  text(ctx, keys, w / 2, keysY, fitSize(ctx, keys, 14, w - 32), COLORS.dim);
}

/** Group and level, a learned bar with its dim reading-to-go part, the counts and "Progress ›". */
function renderLevel(ctx: Ctx, w: number, y: number, session: Session): void {
  const level = session.progress.unlockedLevel;
  const p = levelProgress(
    session.progress,
    level,
    session.kana,
    KANJI,
    levelWords(session),
    session.meaning,
  );
  const name = groupedLevelName(level);
  text(ctx, name, w / 2, y, fitSize(ctx, name, 30, w - 32));
  const bw = Math.min(300, w - 64);
  const bx = (w - bw) / 2;
  const by = y + 28;
  const bh = 12;
  ctx.fillStyle = COLORS.track;
  ctx.fillRect(bx, by, bw, bh);
  if (p.total) {
    ctx.fillStyle = COLORS.good;
    ctx.fillRect(bx, by, (bw * p.learned) / p.total, bh);
    ctx.fillStyle = COLORS.wall;
    ctx.fillRect(
      bx + (bw * p.learned) / p.total,
      by,
      (bw * p.readingToGo) / p.total,
      bh,
    );
  }
  const line = `${p.learned}/${p.total} learned · ${unlockLine(level, p.total - p.learned, level >= maxLevel(KANJI))}`;
  text(
    ctx,
    line,
    w / 2,
    by + bh + 20,
    fitSize(ctx, line, 15, w - 32),
    COLORS.dim,
  );
  text(ctx, "Progress ›", w / 2, by + bh + 46, 14, COLORS.soldier);
}
