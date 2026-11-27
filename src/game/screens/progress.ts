import type { LevelPage, LevelPageItem } from "../../core/levelpage";
import { gainLabel, type Overall, type OverallRow } from "../../core/overall";
import { levelName } from "../../core/progression";
import { truncate } from "../endlist";
import { button, COLORS, panel, put, type Ctx } from "../draw";
import { FONT, fitSize, text } from "../labels";
import {
  clampScroll,
  levelPageLayout,
  progressLayout,
  resolveScroll,
} from "../progress";
import type { Scene } from "../scenes";

/** The progress scene: the level page when one is open, else the overall view. */
export function renderProgress(
  ctx: Ctx,
  w: number,
  h: number,
  scene: Extract<Scene, { kind: "progress" }>,
): void {
  if (scene.page)
    return renderLevelPage(ctx, w, h, scene.page.view, scene.page.scroll);
  renderOverall(ctx, w, h, scene.view, scene.scroll);
}

/** The overall view (SPEC-overall-progress §4): header, coverage, the scrolling group list, Back. */
function renderOverall(
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
  thumb(ctx, w, l, s);
  button(ctx, l.back, "Back", 20);
}

/** A thin scroll thumb at the right edge when the list doesn't fit. */
function thumb(
  ctx: Ctx,
  w: number,
  l: { listTop: number; listBottom: number; maxScroll: number },
  s: number,
): void {
  if (l.maxScroll <= 0) return;
  const track = l.listBottom - l.listTop;
  const th = Math.max(24, (track * track) / (track + l.maxScroll));
  ctx.fillStyle = COLORS.wall;
  ctx.fillRect(w - 6, l.listTop + ((track - th) * s) / l.maxScroll, 3, th);
}

/**
 * The level page (SPEC-run-items §4): title, "11 of 15 learned", the bar with
 * its dim reading-to-go part, the item rows (scrolling), Back. A locked level
 * is drawn dim below the header.
 */
function renderLevelPage(
  ctx: Ctx,
  w: number,
  h: number,
  page: LevelPage,
  scroll: number,
): void {
  const l = levelPageLayout(w, h, page);
  text(ctx, page.title, w / 2, 44, fitSize(ctx, page.title, 24, w - 32));
  const count = `${page.learned} of ${page.total} learned${page.locked ? " · locked" : ""}`;
  text(ctx, count, w / 2, 76, 15, COLORS.dim);
  const share = (n: number) => (page.total ? n / page.total : 0);
  bar(ctx, 20, 94, w - 40, 12, share(page.learned), share(page.readingToGo));

  const s = clampScroll(scroll, l.maxScroll);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, l.listTop, w, l.listBottom - l.listTop);
  ctx.clip();
  if (page.locked) ctx.globalAlpha = 0.45;
  for (const r of l.rows) {
    const y = l.listTop + r.y - s;
    if (y + r.h < l.listTop || y > l.listBottom) continue;
    renderItem(ctx, w, y, r.h, r.item);
  }
  ctx.restore();
  thumb(ctx, w, l, s);
  button(ctx, l.back, "Back", 20);
}

/** An item row: the item large, its reading over its meaning (dim, cut), the stages right, a tick when learned. */
function renderItem(
  ctx: Ctx,
  w: number,
  top: number,
  h: number,
  item: LevelPageItem,
): void {
  const x = 20;
  const rw = w - 40;
  panel(ctx, x, top + 2, rw, h - 4, 8);
  const y = top + h / 2;
  const itemW = put(
    ctx,
    item.key,
    x + 12,
    y,
    24,
    COLORS.text,
    "left",
    false,
    84,
  );
  const right = x + rw - 12;
  const stagesRight = item.learned ? right - 20 : right;
  if (item.learned) tick(ctx, right - 7, y);
  const stagesW = put(
    ctx,
    item.stages,
    stagesRight,
    y,
    12,
    item.learned ? COLORS.good : COLORS.dim,
    "right",
  );
  const midX = x + 12 + Math.max(itemW, 28) + 12;
  const room = stagesRight - stagesW - 10 - midX;
  const lines = [
    item.reading ? { s: item.reading, px: 14, color: COLORS.text } : null,
    item.meaning ? { s: item.meaning, px: 12, color: COLORS.dim } : null,
  ].filter((t) => t !== null);
  lines.forEach((t, i) => {
    ctx.font = `${t.px}px ${FONT}`;
    const shown = truncate(t.s, room, (q) => ctx.measureText(q).width);
    const ly = lines.length === 1 ? y : y + (i === 0 ? -8 : 9);
    if (shown && room >= 24) put(ctx, shown, midX, ly, t.px, t.color, "left");
  });
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

/** A bar: the track, then the share filled green, then `toGo` dim (reading to go). */
function bar(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  share: number,
  toGo = 0,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  ctx.fillStyle = COLORS.barTrack;
  ctx.fill();
  ctx.clip();
  ctx.fillStyle = COLORS.good;
  ctx.fillRect(x, y, w * share, h);
  ctx.fillStyle = COLORS.wall;
  ctx.fillRect(x + w * share, y, w * toGo, h);
  ctx.restore();
}

/** A green tick centred at (x, y). */
export function tick(ctx: Ctx, x: number, y: number): void {
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
