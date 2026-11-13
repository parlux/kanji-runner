import { installCss } from "./camerasettings";
import { HORDE_LIMITS, type HordeSettings } from "../storage/horde";

/** The horde tuning panel (dev tool): a bottom sheet of sliders in the camera panel's look. */

type Field = {
  key: keyof HordeSettings;
  label: string;
  step: number;
  /** Slider position (0..1 for the log count) to value, and back. */
  toValue: (t: number) => number;
  toSlider: (v: number) => number;
  show: (v: number) => string;
  lo: number;
  hi: number;
};

const L = HORDE_LIMITS;
/** Three significant digits, so the log slider lands on round counts. */
const round3 = (n: number): number => Number(n.toPrecision(3));
const linear = (
  key: Exclude<keyof HordeSettings, "count">,
  label: string,
  step: number,
  digits: number,
  unit: string,
): Field => ({
  key,
  label,
  step,
  lo: L[key].min,
  hi: L[key].max,
  toValue: (t) => t,
  toSlider: (v) => v,
  show: (v) => `${v.toFixed(digits)}${unit}`,
});

const FIELDS: Field[] = [
  {
    key: "count",
    label: "Enemies (biggest pack)",
    step: 0.001,
    lo: 0,
    hi: 1,
    toValue: (t) =>
      Math.min(
        L.count.max,
        Math.max(
          L.count.min,
          round3(L.count.min * (L.count.max / L.count.min) ** t),
        ),
      ),
    toSlider: (v) =>
      Math.log(v / L.count.min) / Math.log(L.count.max / L.count.min),
    show: (v) => v.toLocaleString("en-US"),
  },
  linear("scale", "Figure size", 0.05, 2, "×"),
  linear("killSeconds", "Kill time", 0.1, 1, " s"),
  linear("width", "Pack width (far)", 0.05, 2, ""),
];

let panelEl: HTMLElement | null = null;

/** Whether the horde panel is showing (it swallows game input). */
export const hordePanelOpen = (): boolean => panelEl !== null;

/**
 * Opens the panel. `defaults` is what Reset returns to; `current` the saved
 * settings or null. Each change calls `onChange` with the settings, Reset with
 * null. The run in progress is unchanged: the next run is built with them.
 */
export function openHordePanel(opts: {
  defaults: HordeSettings;
  current: HordeSettings | null;
  onChange: (settings: HordeSettings | null) => void;
  onClose: () => void;
}): void {
  if (panelEl) return;
  installCss();
  let state: HordeSettings = opts.current ?? opts.defaults;
  const root = document.createElement("div");
  root.className = "kr-cam";
  for (const type of ["pointerdown", "pointerup", "click", "touchstart"])
    root.addEventListener(type, (e) => e.stopPropagation());
  const box = document.createElement("div");
  box.className = "panel";
  const title = document.createElement("h2");
  title.textContent = "Horde (from the next run)";
  title.onclick = () => root.classList.toggle("top");
  box.append(title);

  const inputs: { f: Field; input: HTMLInputElement; value: HTMLElement }[] =
    [];
  const sync = (
    f: Field,
    input: HTMLInputElement,
    value: HTMLElement,
  ): void => {
    input.value = String(f.toSlider(state[f.key]));
    value.textContent = f.show(state[f.key]);
  };
  for (const f of FIELDS) {
    const label = document.createElement("label");
    const name = document.createElement("span");
    name.textContent = f.label;
    const value = document.createElement("b");
    label.append(name, value);
    const input = document.createElement("input");
    input.type = "range";
    input.min = String(f.lo);
    input.max = String(f.hi);
    input.step = String(f.step);
    sync(f, input, value);
    input.addEventListener("input", () => {
      state = { ...state, [f.key]: f.toValue(Number(input.value)) };
      value.textContent = f.show(state[f.key]);
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
    for (const { f, input, value } of inputs) sync(f, input, value);
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
