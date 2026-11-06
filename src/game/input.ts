export type Action = "left" | "right" | "confirm" | "pause";

const KEYS: Record<string, Action> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  Enter: "confirm",
  " ": "confirm",
  p: "pause",
  P: "pause",
};

export function bindKeys(onAction: (a: Action) => void): void {
  window.addEventListener("keydown", (e) => {
    const action = KEYS[e.key];
    if (!action) return;
    e.preventDefault();
    if (!e.repeat) onAction(action);
  });
}
