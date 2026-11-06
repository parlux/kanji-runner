export type Action = "confirm" | "pause";

const KEYS: Record<string, Action> = {
  Enter: "confirm",
  " ": "confirm",
  p: "pause",
  P: "pause",
};

/** Binds keys. Returns the held steering axis: -1 (←), 0 or 1 (→). */
export function bindKeys(onAction: (a: Action) => void): () => number {
  const held = { left: false, right: false };
  const setHeld = (key: string, down: boolean): boolean => {
    if (key === "ArrowLeft") held.left = down;
    else if (key === "ArrowRight") held.right = down;
    else return false;
    return true;
  };
  window.addEventListener("keydown", (e) => {
    if (setHeld(e.key, true)) return e.preventDefault();
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
