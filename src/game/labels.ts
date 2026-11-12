/** Text drawing shared by the 2D renderer and the 3D overlay: fitting, wrapped answer labels, outlined text. */

type Ctx = CanvasRenderingContext2D;

export const FONT = `"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic", system-ui, sans-serif`;
/** Text colours: normal, dimmed (okurigana), and the outline behind outlined text. */
export const TEXT_COLORS = {
  text: "#f2f2f2",
  dim: "#9aa3b5",
  outline: "#4a3220",
};

/** Maps a colour (#rrggbb) to what is drawn, e.g. mixed toward a haze colour. */
export type Tint = (colour: string) => string;

/** `a` mixed toward `b` by `t` (0 = a, 1 = b); both #rrggbb. */
export function mixHex(a: string, b: string, t: number): string {
  const ch = (c: string, i: number): number =>
    parseInt(c.slice(1 + 2 * i, 3 + 2 * i), 16);
  let out = "#";
  for (let i = 0; i < 3; i++) {
    const v = Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * t);
    out += v.toString(16).padStart(2, "0");
  }
  return out;
}

/** Smallest a question prompt is drawn (px), however far away its wall is. */
export const PROMPT_MIN_PX = 34;
/** Smallest an answer label is drawn (px), unless it must shrink to fit its opening. */
export const LABEL_MIN_PX = 18;

/** `size`, or smaller if needed so `s` fits in `maxWidth`. */
export function fitSize(
  ctx: Ctx,
  s: string,
  size: number,
  maxWidth: number,
): number {
  ctx.font = `${Math.round(size)}px ${FONT}`;
  const width = ctx.measureText(s).width;
  return width > maxWidth ? (size * maxWidth) / width : size;
}

/** Below this an answer label wraps to two lines rather than shrinking further. */
export const LABEL_FLOOR_PX = 14;

/** A label split into runs: kun'yomi okurigana あ(げる) is greyed. */
export function labelRuns(s: string): { s: string; color: string }[] {
  const m = /^(.*?)(\(.+\))$/.exec(s);
  if (!m) return [{ s, color: TEXT_COLORS.text }];
  return [
    { s: m[1] as string, color: TEXT_COLORS.text },
    { s: m[2] as string, color: TEXT_COLORS.dim },
  ].filter((r) => r.s);
}

const LATIN = /[a-z]/i;
const KANA = /[぀-ゟ]/;

/**
 * Ways to put a label on two lines: at a space or hyphen, or before
 * okurigana brackets; with `inWord`, also inside a word (at least 3
 * letters each side, hyphenated) or between kana outside the brackets.
 */
function labelSplits(s: string, inWord: boolean): [string, string][] {
  const out: [string, string][] = [];
  const bracket = s.indexOf("(");
  for (let i = 1; i < s.length; i++) {
    const prev = s[i - 1] as string;
    const c = s[i] as string;
    if (prev === " " || prev === "-" || c === "(")
      out.push([s.slice(0, i).trimEnd(), s.slice(i)]);
    else if (!inWord) continue;
    else if (LATIN.test(prev) && LATIN.test(c)) {
      if (i >= 3 && s.length - i >= 3)
        out.push([`${s.slice(0, i)}-`, s.slice(i)]);
    } else if (KANA.test(prev) && KANA.test(c) && (bracket < 0 || i < bracket))
      out.push([s.slice(0, i), s.slice(i)]);
  }
  return out;
}

/**
 * Lines and font size for an answer label in an opening `maxWidth` px wide:
 * one line at `size` if it fits, else shrunk to fit. If that would go below
 * LABEL_FLOOR_PX, the two-line split that allows the largest size, trying
 * natural breaks first and breaking inside a word only if those still fall
 * below the floor.
 */
export function labelLayout(
  ctx: Ctx,
  s: string,
  size: number,
  maxWidth: number,
): { lines: string[]; size: number } {
  let best = { lines: [s], size: fitSize(ctx, s, size, maxWidth) };
  for (const inWord of [false, true]) {
    if (best.size >= LABEL_FLOOR_PX) break;
    for (const [a, b] of labelSplits(s, inWord)) {
      const two = Math.min(
        fitSize(ctx, a, size, maxWidth),
        fitSize(ctx, b, size, maxWidth),
        // two lines must still fit in the wall's height
        size * 0.78,
      );
      if (two > best.size) best = { lines: [a, b], size: two };
    }
  }
  return best;
}

/**
 * An answer label centred on (x, y), on one or two lines, okurigana greyed;
 * with `outline`, edged in dark so it reads over a bright scene. Returns the
 * size (px) it was drawn at.
 */
export function drawLabel(
  ctx: Ctx,
  s: string,
  x: number,
  y: number,
  size: number,
  maxWidth: number,
  outline = false,
  tint: Tint = (c) => c,
): number {
  const { lines, size: px } = labelLayout(ctx, s, size, maxWidth);
  const lineH = px * 1.1;
  lines.forEach((line, n) => {
    const ly = y + (n - (lines.length - 1) / 2) * lineH;
    const runs = labelRuns(line);
    ctx.font = `${Math.round(px)}px ${FONT}`;
    const widths = runs.map((r) => ctx.measureText(r.s).width);
    let left = x - widths.reduce((a, b) => a + b, 0) / 2;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    runs.forEach((r, k) => {
      if (outline) {
        ctx.strokeStyle = tint(TEXT_COLORS.outline);
        ctx.lineWidth = 3;
        ctx.lineJoin = "round";
        ctx.strokeText(r.s, left, ly);
      }
      ctx.fillStyle = tint(r.color);
      ctx.fillText(r.s, left, ly);
      left += widths[k] as number;
    });
  });
  return px;
}

export function text(
  ctx: Ctx,
  s: string,
  x: number,
  y: number,
  size: number,
  color = TEXT_COLORS.text,
): void {
  ctx.font = `${Math.round(size)}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(s, x, y);
}

/** Text with a dark outline, readable over busy art. */
export function outlinedText(
  ctx: Ctx,
  s: string,
  x: number,
  y: number,
  size: number,
  color = TEXT_COLORS.text,
  tint: Tint = (c) => c,
): void {
  ctx.font = `${Math.round(size)}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.strokeStyle = tint(TEXT_COLORS.outline);
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  ctx.strokeText(s, x, y);
  ctx.fillStyle = tint(color);
  ctx.fillText(s, x, y);
}
