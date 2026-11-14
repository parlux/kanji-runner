import { hazardSpan, type Saw } from "../../core/track";
import { SAW_W } from "../../core/tuning";
import { TRACK_W, worldX } from "./world";

/** A crate's height and depth (world units); its near face stands at its distance. */
export const CRATE_H = 1.5;
export const CRATE_D = 1.2;
/** Crate and pack burst length (track distance); recruits and their "+N" last CRATE_POPUP_DIST. */
export const SHATTER_DIST = 0.6;
export const CRATE_POPUP_DIST = 0.8;
/** Most recruits drawn running in from a shattered crate. */
export const MAX_RECRUITS = 12;
/** Pieces in a burst. */
export const BURST_PIECES = 14;

/** A track span (x left..right) as a centre and width in world units. */
export function spanWorld(
  left: number,
  right: number,
): { x: number; w: number } {
  return { x: worldX((left + right) / 2), w: (right - left) * TRACK_W };
}

/** A saw's disc centre and radius now, and its rail's centre and length, in world X. */
export function sawPlace(
  h: Saw,
  dist: number,
): { x: number; r: number; railX: number; railW: number } {
  const span = hazardSpan(h, dist);
  return {
    x: worldX((span.left + span.right) / 2),
    r: (SAW_W * TRACK_W) / 2,
    railX: worldX(h.mid),
    railW: (2 * h.amp + SAW_W) * TRACK_W,
  };
}

/**
 * Piece k of a burst `t` (0..1) of the way through, as an offset from the
 * burst's centre (world units) and a size: flung outwards over `spread`,
 * rising then falling, shrinking away.
 */
export function burstPiece(
  k: number,
  t: number,
  spread: number,
): { x: number; y: number; z: number; size: number } {
  const a = k * 2.39996;
  const r = (spread + 2.5 * t) * (0.4 + (0.6 * ((k * 7) % 5)) / 4);
  const up = 1.6 + 0.3 * (k % 3);
  return {
    x: r * Math.cos(a) * t,
    y: up * t - 2.6 * t * t,
    z: r * Math.sin(a) * t,
    size: 0.22 * (1 - t) + 0.05,
  };
}

/** How far (0..1) recruit k of n has run from a shattered crate into the crowd, `t` through its pop-up: staggered. */
export const recruitProgress = (k: number, n: number, t: number): number =>
  Math.min(1, Math.max(0, (t * 1.6 - k / (n * 2)) / 0.8));
