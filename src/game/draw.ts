import type { Rect } from "./start";
import { FONT, text, TEXT_COLORS } from "./labels";

/** Shared drawing helpers and colours for the 2D overlay and screens. */

export const COLORS = {
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

export type Ctx = CanvasRenderingContext2D;

/** The end screen's side margin (px). */
export const END_PAD = 20;

export function button(
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

/** Text at (x, y), vertically centred, optionally bold, shrunk to `maxW`. */
export function put(
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

export function panel(
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
