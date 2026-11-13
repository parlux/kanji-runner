import type { KeyValueStore } from "./storage";

/** Whether "Meanings only" is on; this device only, never synced. */
export const MEANING_MODE_KEY = "kanji-runner:meaning-mode";

/** The stored flag; off when missing or unreadable. Never throws. */
export function loadMeaningMode(store: KeyValueStore): boolean {
  try {
    return store.getItem(MEANING_MODE_KEY) === "on";
  } catch {
    return false;
  }
}

/** Writes the flag; ignores storage errors. */
export function saveMeaningMode(store: KeyValueStore, on: boolean): void {
  try {
    store.setItem(MEANING_MODE_KEY, on ? "on" : "off");
  } catch {
    // blocked or full storage: the choice lasts this session only
  }
}
