import { DEFAULT_SPEED, SPEED_PRESETS, type SpeedPreset } from "../core/tuning";
import type { KeyValueStore } from "./storage";

/** The speed preset lives on this device only; it is not synced. */
export const SPEED_KEY = "kanji-runner:speed";

const ORDER = Object.keys(SPEED_PRESETS) as SpeedPreset[];

const isPreset = (v: unknown): v is SpeedPreset =>
  typeof v === "string" && (ORDER as string[]).includes(v);

/** The stored preset, or the default when missing, unknown or unreadable. Never throws. */
export function loadSpeed(store: KeyValueStore): SpeedPreset {
  try {
    const v = store.getItem(SPEED_KEY);
    return isPreset(v) ? v : DEFAULT_SPEED;
  } catch {
    return DEFAULT_SPEED;
  }
}

/** Writes the preset; ignores storage errors. */
export function saveSpeed(store: KeyValueStore, speed: SpeedPreset): void {
  try {
    store.setItem(SPEED_KEY, speed);
  } catch {
    // blocked or full storage: the choice lasts this session only
  }
}

/** The next preset in Relaxed → Normal → Fast → Relaxed order. */
export function nextSpeed(speed: SpeedPreset): SpeedPreset {
  return ORDER[(ORDER.indexOf(speed) + 1) % ORDER.length] ?? DEFAULT_SPEED;
}

/** The button label for a preset. */
export function speedLabel(speed: SpeedPreset): string {
  return `Speed: ${speed.charAt(0).toUpperCase()}${speed.slice(1)}`;
}
