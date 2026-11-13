import { describe, expect, it } from "vitest";
import { createRunState } from "../../src/core/sim";
import { buildTrack } from "../../src/core/track";
import { ROWS_PER_RUN, VIEW_DISTANCE } from "../../src/core/tuning";
import { mixHex } from "../../src/game/labels";
import { renderTrackText } from "../../src/game/three/overlay";
import {
  HAZE_COLOUR,
  hazeFor,
  projectorFor,
  SHAPE_DISTANCE,
  WALL_H,
} from "../../src/game/three/world";
import { cameraFor } from "../../src/game/three/view";
import { kanaRun } from "../core/kana-run";

type Draw = { s: string; fill: string; stroke: string };

/** A context that records each fillText with the colours then set. */
function recorder(): { ctx: CanvasRenderingContext2D; draws: Draw[] } {
  const draws: Draw[] = [];
  const ctx = {
    fillStyle: "",
    strokeStyle: "",
    globalAlpha: 1,
    measureText: (s: string) => ({ width: s.length * 10 }),
    strokeText() {},
    fillText(s: string) {
      draws.push({
        s,
        fill: String(ctx.fillStyle),
        stroke: String(ctx.strokeStyle),
      });
    },
  } as unknown as CanvasRenderingContext2D;
  return { ctx, draws };
}

const hex = `#${HAZE_COLOUR.toString(16).padStart(6, "0")}`;

describe("track text haze", () => {
  const w = 390;
  const h = 844;
  const fit = cameraFor(null);
  const run = createRunState(kanaRun(1), buildTrack(1, ROWS_PER_RUN));
  const wall = run.track.questions[0] as number;

  /** Text drawn with the army so that the first wall is `ahead` in front. */
  const drawAt = (ahead: number): Draw[] => {
    const r = { ...run, dist: wall - ahead };
    const { ctx, draws } = recorder();
    renderTrackText(
      ctx,
      r,
      projectorFor(fit, w, h, r.dist),
      hazeFor(fit.pose, r.dist),
    );
    return draws.filter(
      (d) => d.s === run.rows[0]?.prompt || run.rows[0]?.options.includes(d.s),
    );
  };

  it("draws the gate's text between VIEW_DISTANCE and SHAPE_DISTANCE, hazy", () => {
    for (const ahead of [
      1.9 * VIEW_DISTANCE,
      1.5 * VIEW_DISTANCE,
      1.1 * VIEW_DISTANCE,
    ]) {
      const d = drawAt(ahead);
      expect(d.length).toBeGreaterThan(1);
      expect(d.some((x) => x.fill !== "#f2f2f2")).toBe(true);
    }
  });

  it("draws nothing beyond SHAPE_DISTANCE, and plain text near the army", () => {
    expect(drawAt(SHAPE_DISTANCE + 1)).toEqual([]);
    for (const x of drawAt(0.5))
      expect(["#f2f2f2", "#9aa3b5"]).toContain(x.fill);
  });

  it("gives the prompt and every label one haze, equal to the wall's", () => {
    const ahead = 1.4 * VIEW_DISTANCE;
    const amount = hazeFor(fit.pose, wall - ahead)(wall, WALL_H / 2);
    expect(amount).toBeGreaterThan(0);
    for (const x of drawAt(ahead)) {
      expect(x.stroke).toBe(mixHex("#4a3220", hex, amount));
      expect([
        mixHex("#f2f2f2", hex, amount),
        mixHex("#9aa3b5", hex, amount),
      ]).toContain(x.fill);
    }
  });
});
