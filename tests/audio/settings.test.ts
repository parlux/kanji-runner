import { describe, expect, it } from "vitest";
import {
  AUDIO_KEY,
  audible,
  defaultAudioSettings,
  loadAudioSettings,
  saveAudioSettings,
  type SettingsStore,
} from "../../src/audio/settings";

function fakeStore(
  initial?: string,
): SettingsStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set(AUDIO_KEY, initial);
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  };
}

describe("audio settings", () => {
  it("defaults to everything on, not muted", () => {
    expect(loadAudioSettings(fakeStore())).toEqual({
      voice: true,
      sfx: true,
      music: true,
      muted: false,
    });
  });

  it("round-trips", () => {
    const store = fakeStore();
    const s = { voice: false, sfx: true, music: false, muted: true };
    expect(saveAudioSettings(store, s)).toBe(true);
    expect(loadAudioSettings(store)).toEqual(s);
  });

  it("falls back to defaults on bad JSON or the wrong shape", () => {
    for (const bad of ["{oops", "null", "[1]", "7", '"x"'])
      expect(loadAudioSettings(fakeStore(bad))).toEqual(defaultAudioSettings());
  });

  it("keeps good fields and defaults bad ones", () => {
    const s = loadAudioSettings(fakeStore('{"voice":false,"sfx":"no"}'));
    expect(s).toEqual({ ...defaultAudioSettings(), voice: false });
  });

  it("never throws when storage does", () => {
    const broken: SettingsStore = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("full");
      },
    };
    expect(loadAudioSettings(broken)).toEqual(defaultAudioSettings());
    expect(saveAudioSettings(broken, defaultAudioSettings())).toBe(false);
  });

  it("is audible only when on and not muted", () => {
    const s = { ...defaultAudioSettings(), music: false };
    expect(audible(s, "voice")).toBe(true);
    expect(audible(s, "music")).toBe(false);
    expect(audible({ ...s, muted: true }, "voice")).toBe(false);
  });
});
