import { describe, expect, it } from "vitest";
import { clipLoss, crowdWidth } from "../../src/core/crowd";
import { CROWD_MAX_W, CROWD_MIN_W } from "../../src/core/tuning";

describe("crowdWidth", () => {
  it("follows clamp(0.06, 0.03·√army, 0.30)", () => {
    expect(crowdWidth(1)).toBe(CROWD_MIN_W);
    expect(crowdWidth(4)).toBeCloseTo(0.06, 9);
    expect(crowdWidth(25)).toBeCloseTo(0.15, 9);
    expect(crowdWidth(100)).toBeCloseTo(0.3, 9);
    expect(crowdWidth(10_000)).toBe(CROWD_MAX_W);
  });

  it("never shrinks as the army grows", () => {
    for (let a = 1; a < 300; a++)
      expect(crowdWidth(a + 1)).toBeGreaterThanOrEqual(crowdWidth(a));
  });
});

describe("clipLoss", () => {
  const wall = [{ left: 0.4, right: 0.6 }];

  it("is 0 with no overlap, including when touching an edge", () => {
    expect(clipLoss(50, 0.2, 0.2, wall)).toBe(0);
    expect(clipLoss(50, 0.3, 0.2, wall)).toBe(0); // right edge at 0.4
    expect(clipLoss(50, 0.7, 0.2, wall)).toBe(0); // left edge at 0.6
  });

  it("is ceil(army × overlap / w)", () => {
    // crowd [0.25, 0.45] overlaps 0.05 of 0.2 → 25% of 10 = 2.5 → 3
    expect(clipLoss(10, 0.35, 0.2, wall)).toBe(3);
    // a sliver still costs one soldier
    expect(clipLoss(100, 0.3001, 0.2, wall)).toBe(1);
  });

  it("sums overlap across several solids and never exceeds the army", () => {
    const two = [
      { left: 0, right: 0.45 },
      { left: 0.55, right: 1 },
    ];
    // crowd [0.4, 0.6]: 0.05 + 0.05 of 0.2 → half of 20
    expect(clipLoss(20, 0.5, 0.2, two)).toBe(10);
    expect(clipLoss(7, 0.5, 0.2, [{ left: 0, right: 1 }])).toBe(7);
  });
});
