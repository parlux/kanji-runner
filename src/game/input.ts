import { createDrag } from "./drag";

/**
 * `left`/`right` (`leftTen`/`rightTen` step 10)/`back`/`place` drive the start
 * screen's placement picker; `study` opens the study screen from the end screen;
 * `progress` (a tap on the start screen's level block) opens the overall view.
 */
export type Action =
  | "confirm"
  | "pause"
  | "left"
  | "right"
  | "leftTen"
  | "rightTen"
  | "back"
  | "place"
  | "study"
  | "progress";

const KEYS: Record<string, Action> = {
  Enter: "confirm",
  " ": "confirm",
  p: "pause",
  P: "pause",
  Escape: "back",
  PageDown: "leftTen",
  PageUp: "rightTen",
  s: "study",
  S: "study",
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
  // no click after a touch: a tap that opens a panel would otherwise click
  // whatever the panel put under the finger (Study's own Back button)
  el.addEventListener("touchend", (e) => e.preventDefault());
  return drag.take;
}

/**
 * Binds vertical scrolling on `el`: a pointer drag and the wheel call
 * `onScroll` with the px to move the content up (positive = further down).
 */
export function bindScroll(
  el: HTMLElement,
  onScroll: (dy: number) => void,
): void {
  let active: { id: number; y: number } | null = null;
  el.addEventListener("pointerdown", (e) => {
    active ??= { id: e.pointerId, y: e.clientY };
  });
  el.addEventListener("pointermove", (e) => {
    if (active?.id !== e.pointerId) return;
    onScroll(active.y - e.clientY);
    active.y = e.clientY;
  });
  const end = (e: PointerEvent): void => {
    if (active?.id === e.pointerId) active = null;
  };
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);
  el.addEventListener(
    "wheel",
    (e) => onScroll(e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY),
    { passive: true },
  );
}
