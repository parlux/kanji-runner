import { describe, expect, it } from "vitest";
import { SPEED_PRESETS } from "../../src/core/tuning";
import {
  loadSpeed,
  nextSpeed,
  saveSpeed,
  SPEED_KEY,
  speedLabel,
} from "../../src/storage/speed";

const memory = (init: Record<string, string> = {}) => {
  const data = { ...init };
  return {
    data,
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
  };
};

describe("speed setting", () => {
  it("defaults to Normal, slower than the old fixed speed", () => {
    expect(loadSpeed(memory())).toBe("normal");
    expect(SPEED_PRESETS.normal).toBeLessThan(SPEED_PRESETS.fast);
    expect(SPEED_PRESETS.fast).toBe(1);
  });

  it("round-trips and ignores unknown values", () => {
    const store = memory();
    saveSpeed(store, "relaxed");
    expect(loadSpeed(store)).toBe("relaxed");
    expect(loadSpeed(memory({ [SPEED_KEY]: "warp" }))).toBe("normal");
  });

  it("never throws on blocked storage", () => {
    const blocked = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(loadSpeed(blocked)).toBe("normal");
    expect(() => saveSpeed(blocked, "fast")).not.toThrow();
  });

  it("cycles Relaxed → Normal → Fast → Relaxed", () => {
    expect(nextSpeed("relaxed")).toBe("normal");
    expect(nextSpeed("normal")).toBe("fast");
    expect(nextSpeed("fast")).toBe("relaxed");
    expect(speedLabel("relaxed")).toBe("Speed: Relaxed");
  });
});
