import { describe, expect, it } from "vitest";
import { createDrag, TAP_MAX_MS } from "../../src/game/drag";
import { DRAG_GAIN } from "../../src/core/tuning";

const W = 400;

describe("drag", () => {
  it("touching down without moving yields no movement", () => {
    const d = createDrag(() => W);
    d.down(1, 300, 500, 0);
    expect(d.take()).toBe(0);
  });

  it("is relative: movement × DRAG_GAIN per screen width", () => {
    const d = createDrag(() => W);
    d.down(1, 300, 500, 0);
    d.move(1, 340);
    d.move(1, 320);
    expect(d.take()).toBeCloseTo((20 / W) * DRAG_GAIN);
    expect(d.take()).toBe(0);
  });

  it("ignores a second pointer while one is steering", () => {
    const d = createDrag(() => W);
    d.down(1, 100, 500, 0);
    d.down(2, 200, 500, 0);
    d.move(2, 300);
    expect(d.take()).toBe(0);
  });

  it("a short, still touch is a tap; a drag or long press is not", () => {
    const d = createDrag(() => W);
    d.down(1, 100, 100, 0);
    expect(d.up(1, 102, 101, 100)).toBe(true);
    d.down(1, 100, 100, 0);
    d.move(1, 150);
    expect(d.up(1, 150, 100, 100)).toBe(false);
    d.down(1, 100, 100, 0);
    expect(d.up(1, 100, 100, TAP_MAX_MS + 1)).toBe(false);
  });
});
