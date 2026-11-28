/** What the player switched on: each kind of sound, and a master mute for runs. */
export type AudioSettings = {
  voice: boolean;
  sfx: boolean;
  music: boolean;
  muted: boolean;
};

/** Its own key: no part of the progress save, and never synced. */
export const AUDIO_KEY = "kanji-runner:audio";

/** The slice of `localStorage` used here, so tests can pass a fake. */
export type SettingsStore = Pick<Storage, "getItem" | "setItem">;

export const defaultAudioSettings = (): AudioSettings => ({
  voice: true,
  sfx: true,
  music: true,
  muted: false,
});

/** Stored settings; a missing, corrupt or unreadable value gives the defaults. Never throws. */
export function loadAudioSettings(store: SettingsStore): AudioSettings {
  const out = defaultAudioSettings();
  try {
    const raw: unknown = JSON.parse(store.getItem(AUDIO_KEY) ?? "null");
    if (typeof raw !== "object" || raw === null) return out;
    const r = raw as Record<string, unknown>;
    for (const k of Object.keys(out) as (keyof AudioSettings)[])
      if (typeof r[k] === "boolean") out[k] = r[k];
  } catch {
    // keep the defaults
  }
  return out;
}

/** Writes the settings. Returns false if storage refused; never throws. */
export function saveAudioSettings(
  store: SettingsStore,
  settings: AudioSettings,
): boolean {
  try {
    store.setItem(AUDIO_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}

/** Whether a kind of sound is heard: switched on and not muted. */
export const audible = (
  s: AudioSettings,
  kind: "voice" | "sfx" | "music",
): boolean => s[kind] && !s.muted;
