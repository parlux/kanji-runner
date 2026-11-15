import { describe, expect, it } from "vitest";
import { crowdWidth } from "../../src/core/crowd";
import { firepower } from "../../src/core/fire";
import { speedMul, type RunState } from "../../src/core/sim";
import type { Block } from "../../src/core/track";
import { BASE_SPEED, FIRE_RANGE } from "../../src/core/tuning";
import { canBreak, crateAim } from "./bot";
import { range } from "./sim-helpers";

const crate = (left: number, right: number): Block => ({
  kind: "block",
  pos: 10,
  left,
  right,
});

/** All the fire the army could pour into crate 0 before reaching it. */
const fullFire = (s: RunState): number =>
  (firepower(s.army) * Math.min(10 - s.dist, FIRE_RANGE)) /
  (BASE_SPEED * speedMul(s.dist, s.track));

/** Army 20 at the centre, one crate 10 ahead with half the hp full fire would break. */
function facing(block: Block): RunState {
  const s0 = range([block], [1], 20);
  return { ...s0, hp: [fullFire(s0) / 2] };
}

describe("balance bot: crates", () => {
  it("lines up on a crate it can break with the lanes it covers", () => {
    const s = facing(crate(0.2, 0.8));
    const aim = crateAim(s, 0, 0);
    expect(aim).toBeCloseTo(0.5, 9);
    expect(crateAim(s, 0, -0.05)).toBeCloseTo(0.45, 9);
    expect(canBreak(s, 0, aim)).toBe(true);
  });

  it("dodges a crate it overlaps but covers too little of to break (any overlap is not full fire)", () => {
    // a crate a fifth of the crowd's width: a fifth of the fire, not enough
    const w = crowdWidth(20);
    const s = facing(crate(0.5 - w / 10, 0.5 + w / 10));
    expect(canBreak(s, 0, crateAim(s, 0, 0))).toBe(false);
  });

  it("judges where its sloppy aim will put it: off by the offset, it covers less", () => {
    const w = crowdWidth(20);
    const s = facing(crate(0.5 - (0.7 * w) / 2, 0.5 + (0.7 * w) / 2));
    // dead on: 70% of the fire (needs 50% × CRATE_MARGIN)
    expect(canBreak(s, 0, crateAim(s, 0, 0))).toBe(true);
    // a quarter of its width off: 60%, so it dodges
    expect(canBreak(s, 0, crateAim(s, 0, w / 4))).toBe(false);
  });
});
