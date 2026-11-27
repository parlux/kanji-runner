import { DRAG_GAIN } from "../core/tuning";

/** A touch shorter than this, that never moved TAP_MAX_MOVE px or more from where it started, is a tap. */
export const TAP_MAX_MS = 250;
export const TAP_MAX_MOVE = 8;

/**
 * Pure relative-drag tracker. Only the first pointer down steers. Movement is
 * accumulated in track units until taken, so touching down never moves the crowd.
 */
export function createDrag(screenWidth: () => number) {
  let active: {
    id: number;
    x0: number;
    y0: number;
    x: number;
    t0: number;
    /** Moved TAP_MAX_MOVE or more at some point: a drag (a scroll), never a tap. */
    far: boolean;
  } | null = null;
  let pending = 0;

  return {
    down(id: number, x: number, y: number, t: number): void {
      if (!active) active = { id, x0: x, y0: y, x, t0: t, far: false };
    },
    /** `y` (when given) counts toward the tap's movement; steering uses `x` only. */
    move(id: number, x: number, y = active?.y0 ?? 0): void {
      if (active?.id !== id) return;
      if (Math.hypot(x - active.x0, y - active.y0) >= TAP_MAX_MOVE)
        active.far = true;
      pending += ((x - active.x) / screenWidth()) * DRAG_GAIN;
      active.x = x;
    },
    /** Returns true when the release completes a tap. */
    up(id: number, x: number, y: number, t: number): boolean {
      if (active?.id !== id) return false;
      const a = active;
      active = null;
      return (
        !a.far &&
        t - a.t0 < TAP_MAX_MS &&
        Math.hypot(x - a.x0, y - a.y0) < TAP_MAX_MOVE
      );
    },
    cancel(id: number): void {
      if (active?.id === id) active = null;
    },
    /** Track-unit target movement since the last call. */
    take(): number {
      const dx = pending;
      pending = 0;
      return dx;
    },
  };
}
