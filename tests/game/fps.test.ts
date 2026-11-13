import { describe, expect, it } from "vitest";
import { createFpsMeter, fpsParam } from "../../src/game/three/fps";

describe("?fps readout", () => {
  it("is on only with the flag", () => {
    expect(fpsParam("?fps")).toBe(true);
    expect(fpsParam("?scenery=country&fps")).toBe(true);
    expect(fpsParam("")).toBe(false);
    expect(fpsParam("?scenery=country")).toBe(false);
  });

  it("averages the frame rate over about the last second", () => {
    const meter = createFpsMeter();
    expect(meter.tick(0)).toBe(0);
    let fps = 0;
    for (let t = 1; t <= 120; t++) fps = meter.tick((t * 1000) / 60);
    expect(fps).toBeCloseTo(60, 5);
    // slows to 30 fps: after a second it reads 30
    for (let t = 1; t <= 31; t++) fps = meter.tick(2000 + (t * 1000) / 30);
    expect(fps).toBeCloseTo(30, 0);
  });
});
