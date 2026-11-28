import { describe, expect, it } from "vitest";
import { dueAt, nearness, overdueBy } from "../../src/core/schedule";
import { GAP_BY_BOX } from "../../src/core/tuning";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = 1_000 * DAY;

describe("due, overdue and nearness", () => {
  it("gaps by box: 0, 0, 1 h, 1 day, 4 days, 14 days", () => {
    expect(GAP_BY_BOX).toEqual([0, 0, HOUR, DAY, 4 * DAY, 14 * DAY]);
  });

  it("an item is due its box's gap after its last answer", () => {
    GAP_BY_BOX.forEach((g, box) => {
      expect(dueAt(box, NOW)).toBe(NOW + g);
      expect(overdueBy(box, NOW - g, NOW)).toBe(0);
      expect(overdueBy(box, NOW - g - 5, NOW)).toBe(5);
    });
    expect(overdueBy(3, NOW - HOUR, NOW)).toBe(HOUR - DAY);
  });

  it("New and Met are always due", () => {
    expect(overdueBy(0, NOW, NOW)).toBe(0);
    expect(overdueBy(1, NOW, NOW)).toBe(0);
    expect(nearness(1, NOW, NOW)).toBe(Infinity);
  });

  it("nearness is elapsed over gap, 1 at due", () => {
    expect(nearness(2, NOW - HOUR / 2, NOW)).toBe(0.5);
    expect(nearness(3, NOW - DAY, NOW)).toBe(1);
    expect(nearness(5, NOW - 7 * DAY, NOW)).toBe(0.5);
  });

  it("placement records (lastSeen 0) are long overdue", () => {
    expect(overdueBy(4, 0, NOW)).toBe(NOW - 4 * DAY);
  });
});
