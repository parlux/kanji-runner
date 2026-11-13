import { describe, expect, it } from "vitest";
import { CAMERA_KEY, loadCamera, saveCamera } from "../../src/storage/camera";
import {
  DEFAULT_CAMERA,
  type CameraSettings,
} from "../../src/game/three/world";

const memory = (init: Record<string, string> = {}) => {
  const data = { ...init };
  return {
    data,
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
    removeItem: (k: string) => {
      Reflect.deleteProperty(data, k);
    },
  };
};

const tuned: CameraSettings = {
  pitch: 20,
  distance: 14,
  fov: 50,
  follow: 0.6,
  smoothing: 0.3,
  haze: 15,
};

describe("camera settings storage", () => {
  it("has no settings (the default camera) when nothing is saved", () => {
    expect(loadCamera(memory())).toBeNull();
  });

  it("round-trips, and clears with null", () => {
    const store = memory();
    saveCamera(store, tuned);
    expect(loadCamera(store)).toEqual(tuned);
    saveCamera(store, null);
    expect(loadCamera(store)).toBeNull();
  });

  it("falls back to the default camera on bad data", () => {
    const bad = [
      "not json",
      "null",
      "[]",
      "42",
      "{}",
      JSON.stringify({ ...tuned, pitch: 2 }),
      JSON.stringify({ ...tuned, smoothing: 2.5 }),
      JSON.stringify({ ...tuned, haze: 3 }),
      JSON.stringify({ ...tuned, haze: 40 }),
      JSON.stringify({ ...tuned, follow: 1.5 }),
      JSON.stringify({ ...tuned, fov: "50" }),
      JSON.stringify({ ...tuned, distance: null }),
      JSON.stringify({ ...tuned, smoothing: -1 }),
    ];
    for (const v of bad)
      expect(loadCamera(memory({ [CAMERA_KEY]: v }))).toBeNull();
  });

  it("accepts the wider ranges", () => {
    const wide = { ...tuned, pitch: 3, distance: 60, smoothing: 2, haze: 21 };
    expect(loadCamera(memory({ [CAMERA_KEY]: JSON.stringify(wide) }))).toEqual(
      wide,
    );
  });

  it("loads older saves without a haze setting, with the default haze", () => {
    const old: Partial<CameraSettings> = { ...tuned };
    delete old.haze;
    expect(loadCamera(memory({ [CAMERA_KEY]: JSON.stringify(old) }))).toEqual({
      ...tuned,
      haze: DEFAULT_CAMERA.haze,
    });
  });

  it("never throws on a blocked store", () => {
    const blocked = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(loadCamera(blocked)).toBeNull();
    expect(() => saveCamera(blocked, tuned)).not.toThrow();
  });
});
