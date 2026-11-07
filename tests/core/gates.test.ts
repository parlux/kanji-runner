import { describe, expect, it } from "vitest";
import {
  gateOpenings,
  growOpening,
  nearestOpening,
  openingDistance,
  wallSolids,
  type Opening,
} from "../../src/core/gates";
import { createRng } from "../../src/core/rng";
import { GATE_EDGE_MIN, GATE_MAX_W, GATE_MIN_W } from "../../src/core/tuning";

const width = (o: Opening): number => o.right - o.left;
const total = (os: Opening[]): number => os.reduce((t, o) => t + width(o), 0);
const at = (os: Opening[], i: number): Opening => os[i] as Opening;
const EPS = 1e-9;

/** Every rule a wall's openings must keep, however they were grown. */
function expectValid(os: Opening[], n: number): void {
  const start = gateOpenings(n);
  expect(os).toHaveLength(n);
  expect(total(os)).toBeCloseTo(total(start), 9);
  expect(at(os, 0).left).toBeGreaterThanOrEqual(GATE_EDGE_MIN - EPS);
  expect(at(os, n - 1).right).toBeLessThanOrEqual(1 - GATE_EDGE_MIN + EPS);
  os.forEach((o, j) => {
    expect(width(o)).toBeGreaterThanOrEqual(GATE_MIN_W - EPS);
    expect(width(o)).toBeLessThanOrEqual(GATE_MAX_W + EPS);
    expect(o.centre).toBeCloseTo((o.left + o.right) / 2, 12);
    // the solid between openings never shrinks, so they never overlap
    if (j > 0)
      expect(o.left - at(os, j - 1).right).toBeCloseTo(
        at(start, j).left - at(start, j - 1).right,
        9,
      );
  });
}

describe("growOpening", () => {
  it("widens the opening about its centre and narrows the others by the same total", () => {
    for (const n of [2, 3]) {
      for (let i = 0; i < n; i++) {
        const before = gateOpenings(n);
        const after = growOpening(before, i, 0.02);
        expect(width(at(after, i)) - width(at(before, i))).toBeCloseTo(
          0.02,
          12,
        );
        expect(at(after, i).centre).toBeCloseTo(at(before, i).centre, 12);
        before.forEach((o, j) => {
          if (j !== i)
            expect(width(o) - width(at(after, j))).toBeCloseTo(
              0.02 / (n - 1),
              12,
            );
        });
        expectValid(after, n);
      }
    }
  });

  it("stops at GATE_MAX_W, or when the others are all at GATE_MIN_W", () => {
    const two = growOpening(gateOpenings(2), 0, 10);
    expect(width(at(two, 0))).toBeCloseTo(GATE_MAX_W, 12);
    expect(width(at(two, 1))).toBeCloseTo(0.72 - GATE_MAX_W, 12);
    const three = growOpening(gateOpenings(3), 1, 10);
    expect(width(at(three, 0))).toBeCloseTo(GATE_MIN_W, 12);
    expect(width(at(three, 2))).toBeCloseTo(GATE_MIN_W, 12);
    expect(width(at(three, 1))).toBeCloseTo(0.78 - 2 * GATE_MIN_W, 12);
    expectValid(two, 2);
    expectValid(three, 3);
  });

  it("an edge opening slides inwards once the edge solid is at GATE_EDGE_MIN", () => {
    const os = growOpening(gateOpenings(3), 0, 10);
    expect(at(os, 0).left).toBeCloseTo(GATE_EDGE_MIN, 12);
    expect(at(os, 0).centre).toBeGreaterThan(at(gateOpenings(3), 0).centre);
    expectValid(os, 3);
  });

  it("does nothing for no damage", () => {
    expect(growOpening(gateOpenings(3), 1, 0)).toEqual(gateOpenings(3));
  });

  it("keeps every rule over many random growth sequences (property)", () => {
    for (let seed = 0; seed < 150; seed++) {
      const rng = createRng(seed);
      const n = rng() < 0.5 ? 2 : 3;
      let os = gateOpenings(n);
      let grown = 0;
      for (let k = 0; k < 40; k++) {
        // shoot whichever opening a random crowd position is nearest to
        const i = nearestOpening(os, rng());
        const amount = rng() * 0.03;
        const before = os;
        os = growOpening(os, i, amount);
        const gain = width(at(os, i)) - width(at(before, i));
        // total widening equals total narrowing, never more than asked
        expect(gain).toBeGreaterThanOrEqual(-EPS);
        expect(gain).toBeLessThanOrEqual(amount + EPS);
        const capped =
          width(at(os, i)) >= GATE_MAX_W - EPS ||
          os.every((o, j) => j === i || width(o) <= GATE_MIN_W + EPS);
        if (!capped) expect(gain).toBeCloseTo(amount, 9);
        grown += gain;
        expectValid(os, n);
      }
      expect(grown).toBeGreaterThan(0);
    }
  });
});

describe("nearestOpening with unequal widths", () => {
  it("is 0 inside an opening and measured to the nearer edge outside", () => {
    const o = { left: 0.2, right: 0.5 };
    expect(openingDistance(o, 0.3)).toBe(0);
    expect(openingDistance(o, 0.1)).toBeCloseTo(0.1, 12);
    expect(openingDistance(o, 0.6)).toBeCloseTo(0.1, 12);
  });

  it("picks the opening the centre is inside, whatever the widths (property)", () => {
    for (let seed = 0; seed < 200; seed++) {
      const rng = createRng(seed);
      const n = rng() < 0.5 ? 2 : 3;
      let os = gateOpenings(n);
      for (let k = 0; k < 10; k++)
        os = growOpening(os, Math.floor(rng() * n), rng() * 0.05);
      os.forEach((o, j) => {
        const x = o.left + rng() * width(o);
        expect(nearestOpening(os, x)).toBe(j);
      });
    }
  });

  it("on solid wall, picks by distance to edges, not centres", () => {
    // a wide left opening and a narrow right one
    const os = growOpening(gateOpenings(2), 0, 0.12);
    const [a, b] = [at(os, 0), at(os, 1)];
    const x = a.right + 0.4 * (b.left - a.right);
    // nearer b's centre than a's, but nearer a's edge
    expect(Math.abs(b.centre - x)).toBeLessThan(Math.abs(a.centre - x));
    expect(nearestOpening(os, x)).toBe(0);
  });
});

describe("wallSolids with unequal widths", () => {
  it("are the complement of the openings", () => {
    const os = growOpening(gateOpenings(3), 0, 0.1);
    const solids = wallSolids(os);
    expect(solids).toHaveLength(4);
    const solid = solids.reduce((t, r) => t + r.right - r.left, 0);
    expect(solid + total(os)).toBeCloseTo(1, 12);
    os.forEach((o, j) => {
      expect(solids[j]?.right).toBe(o.left);
      expect(solids[j + 1]?.left).toBe(o.right);
    });
  });
});
