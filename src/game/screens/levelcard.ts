import { levelName, type LevelCard } from "../../core/progression";
import { COLORS, END_PAD, panel, put, type Ctx } from "../draw";
import { FONT } from "../labels";
import { kindLine, unlockLine } from "../levelcopy";

/** The level card: level and learned count, the bar, "+N learned this run" (dim at +0) and what's left to unlock. Returns its bottom. */
export function renderLevelCard(
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
  const kinds = kindLine(card);
  const kindsH = kinds ? 18 : 0;
  const h = 2 * pad + 22 + step + 14 + step + 16 + kindsH + charsH;
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

  // the bar: learned before the run, learned this run (faded)
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
    // met but not yet read: dim, right after the learned part
    ctx.fillStyle = COLORS.wall;
    ctx.fillRect(
      left + (bw * card.learned) / card.total,
      y,
      (bw * card.readingToGo) / card.total,
      14,
    );
  }
  ctx.restore();

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
  const unlock = unlockLine(card.level, card.toUnlock, card.last);
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
  if (kinds) {
    y += 18;
    put(ctx, kinds, left, y, 13, COLORS.dim, "left", false, bw);
  }
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
