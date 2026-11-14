import { gateReached, type RunState } from "../../core/sim";
import { SESSION_LINE_MAX_LINES } from "../../core/tuning";
import { KANJI } from "../../core/kanji";
import { missedItems } from "../../core/run";
import {
  sessionTokens,
  wrapTokens,
  type PanelToken,
  type SessionLog,
} from "../../core/session";
import {
  endLevelCard,
  studyOffered,
  type BossResult,
  type Session,
} from "../scenes";
import { endLayout, type Rect } from "../start";
import { COLORS, END_PAD, panel, put, type Ctx } from "../draw";
import { FONT, text } from "../labels";
import { renderLevelCard } from "./levelcard";

/** The missed list's rows never get thinner than this because of the session line. */
const MISSED_MIN_ROW_H = 20;
/** Widest a missed item's prompt is drawn on the end screen (px); only words reach it. */
const MISSED_PROMPT_MAX_W = 132;
const SESSION_ITEM_PX = 16;
const SESSION_LABEL_PX = 14;
const SESSION_LINE_H = 20;
const SESSION_GAP = 5;

/**
 * The end screen, top to bottom: result, level card, stat tiles, missed rows,
 * the session line, then the buttons. Short screens get tighter gaps; the
 * missed rows shrink to the space left.
 */
export function renderEnd(
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
