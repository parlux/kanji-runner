import { createDrag } from "./drag";

/** `left`/`right`/`back`/`place` drive the start screen's placement picker. */
export type Action = "confirm" | "pause" | "left" | "right" | "back" | "place";

const KEYS: Record<string, Action> = {
  Enter: "confirm",
  " ": "confirm",
  p: "pause",
  P: "pause",
  Escape: "back",
};

/**
 * Binds keys. Returns the held steering axis: -1 (←), 0 or 1 (→). ←/→ also
 * fire `left`/`right` on every press and auto-repeat, for the start screen.
 */
export function bindKeys(onAction: (a: Action) => void): () => number {
  const held = { left: false, right: false };
  const setHeld = (key: string, down: boolean): boolean => {
    if (key === "ArrowLeft") held.left = down;
    else if (key === "ArrowRight") held.right = down;
    else return false;
    return true;
  };
  window.addEventListener("keydown", (e) => {
    if (setHeld(e.key, true)) {
      e.preventDefault();
      return onAction(e.key === "ArrowLeft" ? "left" : "right");
    }
    const action = KEYS[e.key];
    if (!action) return;
    e.preventDefault();
    if (!e.repeat) onAction(action);
  });
  window.addEventListener("keyup", (e) => {
    setHeld(e.key, false);
  });
  // a key released while the window is unfocused never fires keyup
  window.addEventListener("blur", () => {
    held.left = held.right = false;
  });
  return () => (held.right ? 1 : 0) - (held.left ? 1 : 0);
}

/**
 * Binds pointer drag on `el`. A tap fires `onTap` with its position in `el`.
 * Returns a function that takes the target movement (track units)
 * accumulated since its last call.
 */
export function bindDrag(
  el: HTMLElement,
  onTap: (x: number, y: number) => void,
): () => number {
  const drag = createDrag(() => el.clientWidth);
  el.addEventListener("pointerdown", (e) => {
    el.setPointerCapture(e.pointerId);
    drag.down(e.pointerId, e.clientX, e.clientY, e.timeStamp);
  });
  el.addEventListener("pointermove", (e) => drag.move(e.pointerId, e.clientX));
  el.addEventListener("pointerup", (e) => {
    if (drag.up(e.pointerId, e.clientX, e.clientY, e.timeStamp)) {
      const r = el.getBoundingClientRect();
      onTap(e.clientX - r.left, e.clientY - r.top);
    }
  });
  el.addEventListener("pointercancel", (e) => drag.cancel(e.pointerId));
  return drag.take;
}
