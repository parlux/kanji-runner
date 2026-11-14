import { describe, expect, it } from "vitest";
import { crowdWidth } from "../../src/core/crowd";
import {
  crowdLayout,
  FIGURE_RADIUS,
  MAX_DRAWN_SOLDIERS,
  TRACK_W,
  trackX,
  worldX,
  worldZ,
  clipGaps,
  crowdHalfDepth,
  drawnCentre,
  drawnWidth,
  scaledWidth,
  spreadScale,
  spreadShare,
  stepShare,
  spreadWidth,
  SQUEEZE_DIST,
} from "../../src/game/three/world";
import { createRunState, stepRun, type RunState } from "../../src/core/sim";
import { buildTrack } from "../../src/core/track";
import { ROWS_PER_RUN } from "../../src/core/tuning";
import { kanaRun } from "../core/kana-run";

describe("track ↔ world mapping", () => {
  it("round-trips track x", () => {
    for (const x of [0, 0.13, 0.5, 0.9, 1]) expect(trackX(worldX(x))).toBe(x);
  });

  it("spans the track width, centred, with the army at Z = 0 running to −Z", () => {
    expect(worldX(0)).toBe(-TRACK_W / 2);
    expect(worldX(1)).toBe(TRACK_W / 2);
    expect(worldZ(4, 4)).toBe(-0);
    expect(worldZ(5, 4)).toBeLessThan(0);
  });
});

describe("crowd layout", () => {
  const out = new Float32Array(2 * MAX_DRAWN_SOLDIERS);

  it("draws one figure per soldier, capped at MAX_DRAWN_SOLDIERS", () => {
    expect(crowdLayout(5, out)).toBe(5);
    expect(crowdLayout(40, out)).toBe(40);
    expect(crowdLayout(200, out)).toBe(200);
    expect(crowdLayout(1000, out)).toBe(MAX_DRAWN_SOLDIERS);
    expect(crowdLayout(0, out)).toBe(0);
  });

  it("keeps every figure inside the crowd's width", () => {
    for (const army of [1, 5, 40, 200, 1000]) {
      const n = crowdLayout(army, out);
      const half = (crowdWidth(army) * TRACK_W) / 2;
      for (let k = 0; k < n; k++)
        expect(Math.abs(out[2 * k] as number) + FIGURE_RADIUS).toBeLessThan(
          half + 1e-9,
        );
    }
  });

  it("is the same for the same army size", () => {
    const a = new Float32Array(400);
    const b = new Float32Array(400);
    crowdLayout(40, a);
    crowdLayout(77, b);
    crowdLayout(40, b);
    expect(Array.from(b.subarray(0, 80))).toEqual(
      Array.from(a.subarray(0, 80)),
    );
  });
});

describe("crowd spread and squeeze", () => {
  const out = new Float32Array(2 * MAX_DRAWN_SOLDIERS);

  it("spreads wider than the true width on open road: ~0.1, ~0.3, 0.55 of the track", () => {
    expect(spreadWidth(5)).toBeCloseTo(0.11, 2);
    expect(spreadWidth(40)).toBeCloseTo(0.32, 2);
    expect(spreadWidth(200)).toBe(0.55);
    for (const army of [1, 5, 40, 100, 200, 1000])
      expect(spreadWidth(army)).toBeGreaterThanOrEqual(crowdWidth(army));
    expect(drawnWidth(200, Infinity, Infinity)).toBe(spreadWidth(200));
  });

  it("keeps the stretched layout inside the drawn width and on the track", () => {
    for (const army of [1, 5, 40, 200, 1000])
      for (const share of [0, 0.3, 1]) {
        const n = crowdLayout(army, out);
        const cw = crowdWidth(army);
        const w = cw + (spreadWidth(army) - cw) * share;
        const k = spreadScale(army, w);
        expect(scaledWidth(army, k)).toBeCloseTo(w, 9);
        for (const x of [cw / 2, 0.5, 1]) {
          const c = worldX(drawnCentre(x, w));
          for (let i = 0; i < n; i++) {
            const fx = c + (out[2 * i] as number) * k;
            expect(Math.abs(fx - c) + FIGURE_RADIUS).toBeLessThan(
              (w * TRACK_W) / 2 + 1e-9,
            );
            expect(fx - FIGURE_RADIUS).toBeGreaterThan(worldX(0) - 1e-9);
            expect(fx + FIGURE_RADIUS).toBeLessThan(worldX(1) + 1e-9);
          }
        }
      }
    // squeezed: exactly the sim's crowd, where the sim has it
    expect(spreadScale(40, crowdWidth(40))).toBe(1);
    expect(drawnCentre(0.2, crowdWidth(100))).toBe(0.2);
  });

  it("is exactly the true width while an obstacle is within the crowd, and continuous", () => {
    for (const army of [5, 40, 200]) {
      expect(drawnWidth(army, 0, Infinity)).toBe(crowdWidth(army));
      expect(drawnWidth(army, Infinity, 0)).toBe(crowdWidth(army));
      expect(drawnWidth(army, crowdHalfDepth(army), 5)).toBe(crowdWidth(army));
      let last = drawnWidth(army, 3, Infinity);
      for (let d = 3; d >= -3; d -= 0.01) {
        const w =
          d >= 0
            ? drawnWidth(army, d, Infinity)
            : drawnWidth(army, Infinity, -d);
        expect(Math.abs(w - last)).toBeLessThan(0.01);
        last = w;
      }
      expect(drawnWidth(army, SQUEEZE_DIST + crowdHalfDepth(army), 9)).toBe(
        spreadWidth(army),
      );
    }
  });

  it("finds every kind of obstacle: walls, charges, saws, crates and packs", () => {
    const base = createRunState(kanaRun(1), buildTrack(1, ROWS_PER_RUN));
    const run: RunState = {
      ...base,
      track: {
        questions: [10, 20],
        charges: [1],
        hazards: [
          { kind: "saw", pos: 13, mid: 0.5, amp: 0.01, phase: 0 },
          { kind: "block", pos: 15, left: 0.4, right: 0.6 },
          { kind: "pack", pos: 18, x: 0.5 },
        ],
      },
      // the pack has run in from 18 to 17
      packs: [null, null, { pos: 17, x: 0.5 }],
      hp: [0, 3, 3],
      heads: [0, 0, 15],
      damage: [0, 0, 0],
    };
    for (const pos of [10, 13, 15, 17, 20]) {
      const g = clipGaps({ ...run, dist: pos });
      expect(g.ahead).toBe(0);
      expect(drawnWidth(200, g.ahead, g.behind)).toBe(crowdWidth(200));
    }
    expect(clipGaps({ ...run, dist: 14 })).toEqual({ ahead: 1, behind: 1 });
    expect(clipGaps({ ...run, dist: 25 }).ahead).toBe(Infinity);
  });

  it("is fully squeezed in the frames either side of every contact in a real run", () => {
    for (const seed of [1, 2, 3]) {
      let s = createRunState(kanaRun(seed), buildTrack(seed, ROWS_PER_RUN));
      s = { ...s, army: 150 };
      let contacts = 0;
      while (s.status === "running" && s.dist < 200) {
        const next = stepRun(s, 1 / 60);
        // contacts that clip (walls always; hazards only if they hit)
        if (next.next !== s.next || next.lastClip !== s.lastClip) {
          contacts++;
          for (const r of [s, next]) {
            const g = clipGaps(r);
            expect(spreadShare(r.army, g.ahead, g.behind)).toBe(0);
          }
        }
        s = next;
      }
      expect(contacts).toBeGreaterThan(3);
    }
  });

  describe("only what would hit squeezes", () => {
    const base = createRunState(kanaRun(1), buildTrack(1, ROWS_PER_RUN));
    const withHazards = (
      hazards: RunState["track"]["hazards"],
      over: Partial<RunState> = {},
    ): RunState => ({
      ...base,
      army: 200,
      x: 0.5,
      dist: 0,
      track: { questions: [50], charges: [], hazards },
      hp: hazards.map(() => 3),
      heads: hazards.map(() => 15),
      horde: { ...base.horde, packWidth: 0.1 },
      damage: hazards.map(() => 0),
      packs: hazards.map(() => null),
      ...over,
    });
    const ahead = (r: RunState): number => clipGaps(r).ahead;

    it("ignores a crate and saw in another lane; counts them in the crowd's path, and every pack (it homes in)", () => {
      // a 200 crowd spreads over 0.225..0.775
      const off = withHazards(
        [
          { kind: "block", pos: 5, left: 0.05, right: 0.15 },
          { kind: "saw", pos: 8, mid: 0.9, amp: 0.02, phase: 0 },
          { kind: "pack", pos: 11, x: 0.93 },
        ],
        { packs: [null, null, { pos: 11, x: 0.93 }] },
      );
      expect(ahead(off)).toBe(11);
      const lanes = withHazards(
        [
          { kind: "block", pos: 5, left: 0.05, right: 0.15 },
          { kind: "saw", pos: 8, mid: 0.9, amp: 0.02, phase: 0 },
        ],
        { packs: [null, null] },
      );
      expect(ahead(lanes)).toBe(50);
      const on = withHazards([
        { kind: "block", pos: 5, left: 0.45, right: 0.55 },
      ]);
      expect(ahead(on)).toBe(5);
      const saw = withHazards([
        { kind: "saw", pos: 8, mid: 0.5, amp: 0.02, phase: 0 },
      ]);
      expect(ahead(saw)).toBe(8);
      const pack = withHazards([{ kind: "pack", pos: 11, x: 0.6 }], {
        packs: [{ pos: 11, x: 0.6 }],
      });
      expect(ahead(pack)).toBe(11);
    });

    it("tests a saw where it is when the crowd reaches it, not its sweep", () => {
      // sweeps 0.1..0.9: in the crowd's lane for some phases, off it for others
      const mk = (ph: number) =>
        withHazards([{ kind: "saw", pos: 8, mid: 0.5, amp: 0.4, phase: ph }]);
      const gaps = [0, Math.PI / 4, Math.PI / 2, Math.PI, 5].map((ph) =>
        ahead(mk(ph)),
      );
      expect(gaps.some((g) => g === 8)).toBe(true);
      expect(gaps.some((g) => g === 50)).toBe(true);
    });

    it("ignores shattered crates and dead packs", () => {
      const blk = withHazards(
        [{ kind: "block", pos: 5, left: 0.4, right: 0.6 }],
        { damage: [3] },
      );
      expect(ahead(blk)).toBe(50);
      const pk = withHazards([{ kind: "pack", pos: 5, x: 0.5 }], {
        damage: [3],
        packs: [{ pos: 5, x: 0.5 }],
      });
      expect(ahead(pk)).toBe(50);
    });

    it("always counts a wall, even with nothing else", () => {
      expect(ahead(withHazards([]))).toBe(50);
    });

    it("everything the sim clips counts: crowd span inside the spread span at any x", () => {
      for (const x of [0.1, 0.3, 0.5, 0.9]) {
        const w = crowdWidth(200);
        const r = withHazards(
          [{ kind: "block", pos: 5, left: x - w / 2, right: x + w / 2 }],
          { x },
        );
        expect(ahead(r)).toBe(5);
      }
    });
  });

  describe("share easing", () => {
    const step = (p: number, a: number, b: number, n: number, dt = 1 / 60) => {
      for (let i = 0; i < n; i++) p = stepShare(p, 200, a, b, dt);
      return p;
    };
    it("stays at 1 on open road and 0 at contact", () => {
      expect(step(1, Infinity, Infinity, 60)).toBe(1);
      expect(step(1, 0, Infinity, 1)).toBe(0);
      expect(step(1, crowdHalfDepth(200), Infinity, 1)).toBe(0);
      expect(step(1, Infinity, 0, 1)).toBe(0);
    });
    it("follows a normal approach continuously and reaches 0 by contact", () => {
      let p = 1;
      let last = 1;
      const speed = 3; // track units per second, fast
      for (let d = 5; d > 0; d -= speed / 60) {
        p = stepShare(p, 200, d, Infinity, 1 / 60);
        expect(Math.abs(p - last)).toBeLessThan(0.1);
        last = p;
      }
      expect(p).toBe(0);
    });
    it("eases (no snap) when a hazard is destroyed mid-squeeze, and when steering off/into it", () => {
      const hold = crowdHalfDepth(200);
      const mid = hold + SQUEEZE_DIST / 2;
      const squeezed = spreadShare(200, mid, Infinity);
      // gone: target 1, the share rises at the easing rate only
      const up = stepShare(squeezed, 200, Infinity, Infinity, 1 / 60);
      expect(up - squeezed).toBeGreaterThan(0);
      expect(up - squeezed).toBeLessThan(0.05);
      // it reappears (steered into): comes in fast but not at once
      const down = stepShare(1, 200, mid, Infinity, 1 / 60);
      expect(1 - down).toBeGreaterThan(0);
      expect(1 - down).toBeLessThan(0.14);
      // yet never late: within the crowd's depth it is 0 regardless
      expect(stepShare(1, 200, hold, Infinity, 1 / 60)).toBe(0);
    });
    it("a paused frame (dt 0) changes nothing", () => {
      expect(stepShare(0.4, 200, Infinity, Infinity, 0)).toBe(0.4);
    });
  });
});
