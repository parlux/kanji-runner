/** Keys of removed dev tools (tuned camera, camera gear, tuned horde): dropped on load so a phone plays the code defaults. */
export const LEGACY_KEYS = [
  "kanji-runner:camera",
  "kanji-runner:camera-gear",
  "kanji-runner:horde",
] as const;

/** Removes the legacy keys; ignores storage errors. */
export function removeLegacyKeys(store: Pick<Storage, "removeItem">): void {
  for (const key of LEGACY_KEYS) {
    try {
      store.removeItem(key);
    } catch {
      // blocked storage: nothing to clean
    }
  }
}
