import { CAMERA_LIMITS, type CameraSettings } from "./three/world";

/** The camera tuning panel (dev tool): a bottom sheet of sliders, styled like the pause card. */

const CSS = `
.kr-cam { position: fixed; inset: 0; z-index: 8; display: flex; flex-direction: column;
  justify-content: flex-end; align-items: center; padding: 12px;
  font: 16px system-ui, sans-serif; color: #f2f2f2; background: transparent;
  touch-action: none; pointer-events: auto; }
.kr-cam > .panel { box-sizing: border-box; width: 100%; max-width: 480px; padding: 8px 14px;
  background: rgba(29,34,48,0.72); border: 1px solid #5a6478; display: flex;
  flex-direction: column; gap: 2px; touch-action: manipulation; }
.kr-cam.top { justify-content: flex-start; }
.kr-cam h2 { margin: 0 0 2px; font-size: 20px; font-weight: 600; text-align: center; }
.kr-cam label { display: flex; justify-content: space-between; font-size: 14px; color: #9aa3b5; }
.kr-cam label b { color: #f2f2f2; font-weight: 600; font-variant-numeric: tabular-nums; }
.kr-cam input[type=range] { width: 100%; height: 30px; margin: 0; accent-color: #5fd38d; }
.kr-cam input[type=range]::-webkit-slider-thumb { width: 28px; height: 28px; }
.kr-cam input[type=range]::-moz-range-thumb { width: 28px; height: 28px; }
.kr-cam .row { display: flex; gap: 10px; margin-top: 4px; }
.kr-cam button { flex: 1; height: 40px; font: 600 16px system-ui, sans-serif; color: #f2f2f2;
  background: #1d2230; border: 1px solid #5a6478; }
.kr-gear { position: fixed; left: 12px; top: 56px; width: 44px; height: 44px; z-index: 6;
  font-size: 24px; line-height: 1; color: #f2f2f2; background: rgba(29,34,48,0.85);
  border: 1px solid #5a6478; border-radius: 8px; padding: 0; }
`;

type Field = {
  key: keyof CameraSettings;
  label: string;
  unit: string;
  step: number;
  digits: number;
  range: () => [number, number];
};

const FIELDS: Field[] = [
  {
    key: "pitch",
    label: "Pitch",
    unit: "°",
    step: 0.5,
    digits: 1,
    range: () => [CAMERA_LIMITS.pitch.min, CAMERA_LIMITS.pitch.max],
  },
  {
    key: "distance",
    label: "Distance",
    unit: "",
    step: 0.1,
    digits: 1,
    range: () => [CAMERA_LIMITS.distance.min, CAMERA_LIMITS.distance.max],
  },
  {
    key: "fov",
    label: "FOV",
    unit: "°",
    step: 0.5,
    digits: 1,
    range: () => [CAMERA_LIMITS.fov.min, CAMERA_LIMITS.fov.max],
  },
  {
    key: "follow",
    label: "Follow",
    unit: "",
    step: 0.05,
    digits: 2,
    range: () => [CAMERA_LIMITS.follow.min, CAMERA_LIMITS.follow.max],
  },
  {
    key: "smoothing",
    label: "Smoothing",
    unit: " s",
    step: 0.05,
    digits: 2,
    range: () => [CAMERA_LIMITS.smoothing.min, CAMERA_LIMITS.smoothing.max],
  },
  {
    key: "haze",
    label: "Haze (distance)",
    unit: "",
    step: 0.5,
    digits: 1,
    range: () => [CAMERA_LIMITS.haze.min, CAMERA_LIMITS.haze.max],
  },
];

let panelEl: HTMLElement | null = null;
let gearEl: HTMLButtonElement | null = null;

const installCss = (): void => {
  if (document.getElementById("kr-cam-css")) return;
  const style = document.createElement("style");
  style.id = "kr-cam-css";
  style.textContent = CSS;
  document.head.append(style);
};

/** Whether the camera panel is showing (it swallows game input). */
export const cameraPanelOpen = (): boolean => panelEl !== null;

/**
 * Opens the panel. `defaults` is the default camera as settings (what Reset
 * returns to); `current` the saved settings or null. Each change calls
 * `onChange` with the new settings, Reset with null.
 */
export function openCameraPanel(opts: {
  defaults: CameraSettings;
  current: CameraSettings | null;
  onChange: (settings: CameraSettings | null) => void;
  onClose: () => void;
}): void {
  if (panelEl) return;
  installCss();
  let state: CameraSettings = opts.current ?? opts.defaults;
  const root = document.createElement("div");
  root.className = "kr-cam";
  // nothing under the panel hears a tap or drag
  for (const type of ["pointerdown", "pointerup", "click", "touchstart"])
    root.addEventListener(type, (e) => e.stopPropagation());
  const box = document.createElement("div");
  box.className = "panel";
  const title = document.createElement("h2");
  title.textContent = "Camera (tap to move)";
  title.onclick = () => root.classList.toggle("top");
  box.append(title);

  const inputs: { f: Field; input: HTMLInputElement; value: HTMLElement }[] =
    [];
  const show = (f: Field, value: HTMLElement, n: number): void => {
    value.textContent = `${n.toFixed(f.digits)}${f.unit}`;
  };
  for (const f of FIELDS) {
    const [lo, hi] = f.range();
    const label = document.createElement("label");
    const name = document.createElement("span");
    name.textContent = f.label;
    const value = document.createElement("b");
    label.append(name, value);
    const input = document.createElement("input");
    input.type = "range";
    input.min = String(lo);
    input.max = String(hi);
    input.step = String(f.step);
    input.value = String(state[f.key]);
    show(f, value, Number(input.value));
    input.addEventListener("input", () => {
      state = { ...state, [f.key]: Number(input.value) };
      show(f, value, Number(input.value));
      opts.onChange(state);
    });
    inputs.push({ f, input, value });
    box.append(label, input);
  }

  const row = document.createElement("div");
  row.className = "row";
  const reset = document.createElement("button");
  reset.textContent = "Reset";
  reset.onclick = () => {
    state = opts.defaults;
    for (const { f, input, value } of inputs) {
      input.value = String(state[f.key]);
      show(f, value, state[f.key]);
    }
    opts.onChange(null);
  };
  const close = document.createElement("button");
  close.textContent = "Close";
  close.onclick = () => {
    root.remove();
    panelEl = null;
    opts.onClose();
  };
  row.append(reset, close);
  box.append(row);
  root.append(box);
  document.body.append(root);
  panelEl = root;
}

/**
 * Shows the gear that opens the panel (start screen, paused run), or hides it.
 * Call every frame; the button is made once.
 */
export function syncCameraGear(visible: boolean, onTap: () => void): void {
  if (!gearEl) {
    installCss();
    gearEl = document.createElement("button");
    gearEl.className = "kr-gear";
    gearEl.textContent = "⚙";
    gearEl.setAttribute("aria-label", "Camera settings");
    for (const type of ["pointerdown", "pointerup", "touchstart"])
      gearEl.addEventListener(type, (e) => e.stopPropagation());
    document.body.append(gearEl);
  }
  gearEl.onclick = (e) => {
    e.stopPropagation();
    onTap();
  };
  gearEl.style.display = visible && !panelEl ? "block" : "none";
}
