import {
  CAMERA_LIMITS,
  DEFAULT_CAMERA,
  type CameraSettings,
} from "../game/three/world";

/** Tuned camera settings live on this device only; absent means the default camera. */
export const CAMERA_KEY = "kanji-runner:camera";

/** Loose sanity bounds for saved values: the slider ranges, so anything the sliders gave loads. */
const BOUNDS: Record<keyof CameraSettings, [number, number]> = {
  pitch: [CAMERA_LIMITS.pitch.min, CAMERA_LIMITS.pitch.max],
  distance: [CAMERA_LIMITS.distance.min, CAMERA_LIMITS.distance.max],
  fov: [CAMERA_LIMITS.fov.min, CAMERA_LIMITS.fov.max],
  follow: [CAMERA_LIMITS.follow.min, CAMERA_LIMITS.follow.max],
  smoothing: [CAMERA_LIMITS.smoothing.min, CAMERA_LIMITS.smoothing.max],
  haze: [CAMERA_LIMITS.haze.min, CAMERA_LIMITS.haze.max],
};

const KEYS = Object.keys(BOUNDS) as (keyof CameraSettings)[];

/** The saved settings (haze missing in older saves: the default), or null (the default camera) when missing, malformed or out of range. Never throws. */
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
      const n =
        (v as Record<string, unknown>)[k] ??
        (k === "haze" ? DEFAULT_CAMERA.haze : undefined);
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
