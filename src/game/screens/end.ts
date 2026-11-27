import { gateReached, type RunState } from "../../core/sim";
import {
  endItems,
  endLevelCard,
  studyOffered,
  type BossResult,
  type Session,
} from "../scenes";
import {
  answerText,
  changeText,
  type EndEntry,
  endGap,
  endListArea,
  endListLayout,
  rowTone,
  truncate,
} from "../endlist";
import { clampScroll } from "../progress";
import { endLayout, type Rect } from "../start";
import { COLORS, END_PAD, panel, put, type Ctx } from "../draw";
import { FONT, text } from "../labels";
import { renderLevelCard } from "./levelcard";
import { tick } from "./progress";

/**
 * The end screen, top to bottom: result, level card, the item list (scrolls
 * when long), then the buttons. Short screens get tighter gaps and rows.
 */
export function renderEnd(
  ctx: Ctx,
  w: number,
  h: number,
  run: RunState,
  boss: BossResult | null,
  session: Session,
  scroll = 0,
): void {
  const compact = h < 760;
  const gap = endGap(h);
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

  const card = endLevelCard(session);
  renderLevelCard(ctx, w, y, compact, card);
  const study = studyOffered(run, boss, session);
  const { top, bottom } = endListArea(w, h, card, study);
  const list = endListLayout(top, bottom, endItems(run, session), compact);
  const offset = clampScroll(scroll, list.maxScroll);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, top, w, bottom - top);
  ctx.clip();
  for (const l of list.labels) {
    const ly = top + l.y - offset;
    if (ly + 10 >= top && ly - 10 <= bottom)
      put(ctx, l.text, END_PAD + 2, ly, 12, COLORS.dim, "left");
  }
  for (const r of list.rows) {
    const ry = top + r.y - offset;
    if (ry + r.h >= top && ry <= bottom)
      renderItemRow(ctx, w, ry, r.h, r.entry);
  }
  ctx.restore();
  if (list.maxScroll > 0) renderScrollBar(ctx, w, list, offset);
  renderEndButtons(ctx, endLayout(w, h, study));
}

/** A thin bar at the list's right edge showing where the view sits in a long list. */
function renderScrollBar(
  ctx: Ctx,
  w: number,
  list: ReturnType<typeof endListLayout>,
  offset: number,
): void {
  const view = list.bottom - list.top;
  const barH = Math.max(24, (view * view) / list.content);
  const barY = list.top + (offset / list.maxScroll) * (view - barH);
  ctx.fillStyle = COLORS.wallEdge;
  ctx.beginPath();
  ctx.roundRect(w - 8, barY, 3, barH, 1.5);
  ctx.fill();
}

/**
 * One item as a rounded row: the item large on the left, its meaning dim (cut
 * with "…"), on the right this run's change if it was met (good / bad tones),
 * else its stages (bright while missing, dim when learned); learned rows dim
 * with a tick. A missed reading's right answer on a second dim line.
 */
function renderItemRow(
  ctx: Ctx,
  w: number,
  top: number,
  rowH: number,
  entry: EndEntry,
): void {
  const x = END_PAD;
  const rw = w - 2 * END_PAD;
  const { met } = entry;
  const learned = entry.section === "learned";
  const answer = met ? answerText(met) : "";
  const mainH = answer ? rowH - 16 : rowH;
  panel(ctx, x, top, rw, rowH, Math.min(8, mainH / 2));
  const y = top + mainH / 2;
  const dim =
    learned || (entry.section === "also" && met?.change === "same" && !answer);
  const itemPx = Math.min(22, mainH * 0.8);
  const itemW = put(
    ctx,
    entry.key,
    x + 10,
    y,
    itemPx,
    dim ? COLORS.dim : COLORS.text,
    "left",
    false,
    78,
  );
  // right: the tick when learned, then this run's change or the stages
  let right = x + rw - 10;
  if (learned) {
    tick(ctx, right - 7, y);
    right -= 22;
  }
  const change = met ? changeText(met) : entry.stages;
  const two = met ? met.gates.length > 1 : change.includes("·");
  const changePx = Math.min(two ? 11 : 13, mainH * 0.6);
  const tone = met ? COLORS[rowTone(met)] : learned ? COLORS.dim : COLORS.text;
  ctx.font = `${Math.round(changePx)}px ${FONT}`;
  const changeW = ctx.measureText(change).width;
  put(ctx, change, right, y, changePx, tone, "right");
  // the meaning fills what's left between them; dropped when it would crowd
  const meaningX = x + 10 + itemW + 10;
  const room = right - changeW - 10 - meaningX;
  const meaningPx = Math.min(13, mainH * 0.6);
  ctx.font = `${Math.round(meaningPx)}px ${FONT}`;
  const shown = truncate(entry.meaning, room, (t) => ctx.measureText(t).width);
  if (shown && room >= 24)
    put(ctx, shown, meaningX, y, meaningPx, COLORS.dim, "left");
  if (answer)
    put(
      ctx,
      answer,
      x + 10,
      top + mainH + 6,
      12,
      COLORS.dim,
      "left",
      false,
      rw - 20,
    );
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
