import { HORDE_DEFAULTS, HORDE_K, type HordeTuning } from "../core/tuning";

/** Tuned horde settings live on this device only; absent means the defaults. */
export const HORDE_KEY = "kanji-runner:horde";

/** What the panel edits: the biggest pack's head count and the pack's look and kill time. */
export type HordeSettings = {
  /** Enemies in the biggest pack (the slider is logarithmic). */
  count: number;
  /** Figure size, a share of a soldier. */
  scale: number;
  /** Seconds to kill a pack at the expected army. */
  killSeconds: number;
  /** The far (funnel-mouth) width, a share of the track. */
  width: number;
};

/** Slider ranges; also the bounds a save must be within. */
export const HORDE_LIMITS = {
  count: { min: 200, max: 20000 },
  scale: { min: 0.4, max: 1.5 },
  killSeconds: { min: 0.5, max: 3 },
  width: { min: 0.3, max: 1 },
} as const;

export const DEFAULT_HORDE_SETTINGS: HordeSettings = {
  count: HORDE_DEFAULTS.packMax,
  scale: HORDE_DEFAULTS.hordeScale,
  killSeconds: HORDE_DEFAULTS.killSeconds,
  width: HORDE_DEFAULTS.packWidth,
};

/**
 * The tuning a run is built with. `count` is the biggest pack (packMax). The
 * default K and cap reach the cap at an expected army of about 67 (the late
 * packs of a normal run), so K scales with the count by the same ratio and
 * the late packs hit the cap (a saved 200 gets K = 3, as before).
 */
export function hordeTuning(s: HordeSettings): HordeTuning {
  return {
    hordeK: (HORDE_K * s.count) / HORDE_DEFAULTS.packMax,
    packMax: s.count,
    killSeconds: s.killSeconds,
    packWidth: s.width,
    hordeScale: s.scale,
  };
}

const KEYS = Object.keys(HORDE_LIMITS) as (keyof HordeSettings)[];

/** The saved settings, or null (the defaults) when missing, malformed or out of range. Never throws. */
export function loadHorde(
  store: Pick<Storage, "getItem">,
): HordeSettings | null {
  try {
    const raw = store.getItem(HORDE_KEY);
    if (raw === null) return null;
    const v: unknown = JSON.parse(raw);
    if (typeof v !== "object" || v === null) return null;
    const out: Partial<HordeSettings> = {};
    for (const k of KEYS) {
      const n = (v as Record<string, unknown>)[k];
      const { min, max } = HORDE_LIMITS[k];
      if (typeof n !== "number" || !Number.isFinite(n) || n < min || n > max)
        return null;
      out[k] = n;
    }
    return out as HordeSettings;
  } catch {
    return null;
  }
}

/** Saves the settings, or clears them for null; ignores storage errors. */
export function saveHorde(
  store: Pick<Storage, "setItem" | "removeItem">,
  settings: HordeSettings | null,
): void {
  try {
    if (settings) store.setItem(HORDE_KEY, JSON.stringify(settings));
    else store.removeItem(HORDE_KEY);
  } catch {
    // blocked or full storage: the tuning lasts this session only
  }
}
