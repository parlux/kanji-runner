import { describe, expect, it } from "vitest";
import { defaultAudioSettings } from "../../src/audio/settings";
import {
  muteRect,
  muteTap,
  startLayout,
  startTap,
  toggled,
  toggleTap,
} from "../../src/game/start";

describe("audio controls", () => {
  const [w, h] = [390, 844];
  const l = startLayout(w, h);

  it("has three thumb-sized switches that do not overlap Play or each other", () => {
    expect(l.toggles.map((t) => t.kind)).toEqual(["voice", "sfx", "music"]);
    for (const [i, t] of l.toggles.entries()) {
      expect(t.rect.h).toBeGreaterThanOrEqual(44);
      expect(t.rect.w).toBeGreaterThanOrEqual(44);
      expect(t.rect.y + t.rect.h).toBeLessThanOrEqual(l.play.y);
      const next = l.toggles[i + 1];
      if (next) expect(t.rect.x + t.rect.w).toBeLessThan(next.rect.x);
    }
  });

  it("a tap on a switch hits it and starts nothing", () => {
    for (const t of l.toggles) {
      const x = t.rect.x + t.rect.w / 2;
      const y = t.rect.y + t.rect.h / 2;
      expect(toggleTap(w, h, x, y)).toBe(t.kind);
      expect(startTap(false, w, h, x, y)).toBeNull();
    }
    expect(toggleTap(w, h, l.play.x + 5, l.play.y + 5)).toBeNull();
  });

  it("flips only the tapped switch", () => {
    expect(toggled(defaultAudioSettings(), "sfx")).toEqual({
      ...defaultAudioSettings(),
      sfx: false,
    });
  });

  it("the mute button is at least 44 px, on screen and clear of the HUD corners", () => {
    const r = muteRect(w);
    expect(Math.min(r.w, r.h)).toBeGreaterThanOrEqual(44);
    expect(r.x).toBeGreaterThan(80);
    expect(r.x + r.w).toBeLessThan(w - 110);
    expect(muteTap(w, r.x + 1, r.y + 1)).toBe(true);
    expect(muteTap(w, 10, 10)).toBe(false);
  });
});
