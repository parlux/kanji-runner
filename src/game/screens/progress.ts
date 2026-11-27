import { gainLabel, type Overall, type OverallRow } from "../../core/overall";
import { levelName } from "../../core/progression";
import { button, COLORS, put, type Ctx } from "../draw";
import { FONT, fitSize, text } from "../labels";
import { progressLayout, resolveScroll } from "../progress";

/** The overall view (SPEC-overall-progress §4): header, coverage, the scrolling group list, Back. */
export function renderProgress(
  ctx: Ctx,
  w: number,
  h: number,
  view: Overall,
  scroll: number | null,
): void {
  const l = progressLayout(w, h, view);
  text(ctx, view.title, w / 2, 44, fitSize(ctx, view.title, 24, w - 32));
  const count = `${view.learned.toLocaleString("en-US")} of ${view.all.toLocaleString("en-US")} kanji learned`;
  text(ctx, count, w / 2, 76, 15, COLORS.dim);
  const bw = w - 40;
  bar(ctx, 20, 94, bw, 12, view.all ? view.learned / view.all : 0);
  if (view.coverage !== null) renderCoverage(ctx, w, view);

  const s = resolveScroll(scroll, l.maxScroll);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, l.listTop, w, l.listBottom - l.listTop);
  ctx.clip();
  for (const r of l.rows) {
    const y = l.listTop + r.y - s;
    if (y + r.h < l.listTop || y > l.listBottom) continue;
    renderRow(ctx, w, y, r.h, r.row);
  }
  ctx.restore();
  // a thin scroll thumb when the list doesn't fit
  if (l.maxScroll > 0) {
    const track = l.listBottom - l.listTop;
    const thumb = Math.max(24, (track * track) / (track + l.maxScroll));
    ctx.fillStyle = COLORS.wall;
    ctx.fillRect(
      w - 6,
      l.listTop + ((track - thumb) * s) / l.maxScroll,
      3,
      thumb,
    );
  }
  button(ctx, l.back, "Back", 20);
}

/** "You can read 34% of the kanji in travel text", the % bold; under it, dim, what the current level adds. */
function renderCoverage(ctx: Ctx, w: number, view: Overall): void {
  const parts = [
    { s: "You can read ", bold: false },
    { s: `${Math.round((view.coverage ?? 0) * 100)}%`, bold: true },
    { s: " of the kanji in travel text", bold: false },
  ];
  const font = (px: number, bold: boolean) =>
    `${bold ? "bold " : ""}${px}px ${FONT}`;
  const widthAt = (px: number) =>
    parts.reduce((sum, p) => {
      ctx.font = font(px, p.bold);
      return sum + ctx.measureText(p.s).width;
    }, 0);
  let px = 16;
  if (widthAt(px) > w - 32) px = Math.floor((px * (w - 32)) / widthAt(px));
  let x = (w - widthAt(px)) / 2;
  const y = 136;
  for (const p of parts) {
    ctx.font = font(px, p.bold);
    ctx.fillStyle = p.bold ? COLORS.good : COLORS.text;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(p.s, x, y);
    x += ctx.measureText(p.s).width;
  }
  if (view.gain !== null) {
    const note = `Finishing ${levelName(view.level)} adds ${gainLabel(view.gain)}`;
    text(ctx, note, w / 2, y + 26, 14, COLORS.dim);
  }
}

/** A group row (a panel: name, range, finished/levels, bar) or an indented level row. */
function renderRow(
  ctx: Ctx,
  w: number,
  y: number,
  h: number,
  row: OverallRow,
): void {
  ctx.save();
  if (row.dim) ctx.globalAlpha = 0.45;
  if (row.kind === "group") {
    ctx.fillStyle = COLORS.track;
    ctx.beginPath();
    ctx.roundRect(20, y + 3, w - 40, h - 6, 10);
    ctx.fill();
    const left = 34;
    const right = w - 34;
    const done = row.finished === row.levels;
    const count = `${row.finished}/${row.levels}`;
    const countW = put(
      ctx,
      count,
      done ? right - 20 : right,
      y + 19,
      14,
      COLORS.dim,
      "right",
    );
    if (done) tick(ctx, right - 7, y + 19);
    const nameW = put(
      ctx,
      row.name,
      left,
      y + 19,
      16,
      COLORS.text,
      "left",
      row.open,
      (right - left) * 0.6,
    );
    put(
      ctx,
      row.range,
      left + nameW + 10,
      y + 19,
      13,
      COLORS.dim,
      "left",
      false,
      right - left - nameW - countW - 40,
    );
    bar(ctx, left, y + 34, right - left, 6, row.finished / row.levels);
  } else {
    const left = 44;
    const right = w - 34;
    const done = row.total > 0 && row.learned === row.total;
    put(ctx, row.name, left, y + 15, 15, COLORS.text, "left");
    put(
      ctx,
      `${row.learned}/${row.total}`,
      done ? right - 20 : right,
      y + 15,
      14,
      COLORS.dim,
      "right",
    );
    if (done) tick(ctx, right - 7, y + 15);
    bar(
      ctx,
      left,
      y + 28,
      right - left,
      5,
      row.total ? row.learned / row.total : 0,
    );
  }
  ctx.restore();
}

/** A bar: the track, then the share filled green. */
function bar(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  share: number,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  ctx.fillStyle = COLORS.barTrack;
  ctx.fill();
  ctx.clip();
  ctx.fillStyle = COLORS.good;
  ctx.fillRect(x, y, w * share, h);
  ctx.restore();
}

/** A green tick centred at (x, y). */
function tick(ctx: Ctx, x: number, y: number): void {
  ctx.strokeStyle = COLORS.good;
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(x - 6, y);
  ctx.lineTo(x - 2, y + 4);
  ctx.lineTo(x + 6, y - 5);
  ctx.stroke();
}
