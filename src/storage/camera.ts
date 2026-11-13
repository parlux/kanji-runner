import type { CameraSettings } from "../game/three/world";

/** Tuned camera settings live on this device only; absent means today's camera. */
export const CAMERA_KEY = "kanji-runner:camera";

/** Loose sanity bounds for saved values (the sliders are tighter, per screen). */
const BOUNDS: Record<keyof CameraSettings, [number, number]> = {
  pitch: [8, 45],
  distance: [2, 300],
  fov: [20, 75],
  follow: [0, 1],
  smoothing: [0, 1],
};

const KEYS = Object.keys(BOUNDS) as (keyof CameraSettings)[];

/** The saved settings, or null (today's camera) when missing, malformed or out of range. Never throws. */
export function loadCamera(
  store: Pick<Storage, "getItem">,
): CameraSettings | null {
  try {
    const raw = store.getItem(CAMERA_KEY);
    if (raw === null) return null;
    const v: unknown = JSON.parse(raw);
    if (typeof v !== "object" || v === null) return null;
    const out: Partial<CameraSettings> = {};
    for (const k of KEYS) {
      const n = (v as Record<string, unknown>)[k];
      const [lo, hi] = BOUNDS[k];
      if (typeof n !== "number" || !Number.isFinite(n) || n < lo || n > hi)
        return null;
      out[k] = n;
    }
    return out as CameraSettings;
  } catch {
    return null;
  }
}

/** Saves the settings, or clears them for null; ignores storage errors. */
export function saveCamera(
  store: Pick<Storage, "setItem" | "removeItem">,
  settings: CameraSettings | null,
): void {
  try {
    if (settings) store.setItem(CAMERA_KEY, JSON.stringify(settings));
    else store.removeItem(CAMERA_KEY);
  } catch {
    // blocked or full storage: the tuning lasts this session only
  }
}
