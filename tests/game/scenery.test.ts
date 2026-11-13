import { describe, expect, it } from "vitest";
import {
  builtLooks,
  BLOCK_X,
  FENCE_STEP,
  LAMP_STEP,
  WALK_STEP,
  WALK_W,
  WALK_X,
  WINDOW_H,
  WINDOW_W,
  FLAG_STEP,
  STAND_STEP,
  HAZE_FAR_Z,
  LOOKS,
  MAX_PETALS,
  petalX,
  petalY,
  petalZ,
  PETAL_FAR,
  PETAL_NEAR,
  PETAL_TRACK_MIN_Y,
  PROP_FAR,
  PROP_NEAR,
  PROP_SPAN,
  sceneryFor,
  sceneryParam,
  wrapZ,
} from "../../src/game/three/scenery";
import { TRACK_W } from "../../src/game/three/world";

describe("scenery pick", () => {
  it("is stable for a seed and covers every built look roughly evenly", () => {
    const built = builtLooks();
    const counts = new Map<string, number>();
    for (let seed = 0; seed < 1000; seed++) {
      const id = sceneryFor(seed);
      expect(sceneryFor(seed)).toBe(id);
      expect(built).toContain(id);
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    expect([...counts.keys()].sort()).toEqual([...built].sort());
    const share = 1000 / built.length;
    for (const n of counts.values()) {
      expect(n).toBeGreaterThan(share * 0.6);
      expect(n).toBeLessThan(share * 1.4);
    }
  });

  it("is forced by ?scenery, and ignores unknown or unbuilt ids", () => {
    expect(sceneryParam("?scenery=country")).toBe("country");
    expect(sceneryParam("?2d&scenery=country")).toBe("country");
    expect(sceneryParam("")).toBeNull();
    expect(sceneryParam("?scenery=moon")).toBeNull();
    expect(sceneryParam("?scenery=")).toBeNull();
    expect(sceneryParam("?scenery=spring")).toBe("spring");
    expect(sceneryParam("?scenery=stadium")).toBe("stadium");
    for (const id of ["sky", "city"] as const)
      expect(sceneryParam(`?scenery=${id}`)).toBe(LOOKS[id] ? id : null);
  });
});

describe("wrapZ", () => {
  it("keeps every prop within the scroll range at any distance", () => {
    for (const z0 of [PROP_FAR, -100, 0, PROP_NEAR - 0.001])
      for (const d of [0, 0.37, 3, 25.1, 99.9, 1234.5]) {
        const z = wrapZ(z0, d);
        expect(z).toBeGreaterThanOrEqual(PROP_FAR);
        expect(z).toBeLessThan(PROP_NEAR);
      }
  });

  it("scrolls towards the camera with the run, by the run's world scale", () => {
    expect(wrapZ(-100, 0)).toBeCloseTo(-100);
    expect(wrapZ(-100, 1)).toBeCloseTo(-90);
    // one full span later it is back where it began
    expect(wrapZ(-100, PROP_SPAN / 10)).toBeCloseTo(-100);
  });

  it("reaches past the farthest haze, and the fence step divides the span", () => {
    expect(PROP_FAR).toBeLessThan(HAZE_FAR_Z);
    expect(PROP_SPAN % FENCE_STEP).toBe(0);
  });
});

describe("look layouts", () => {
  for (const id of builtLooks()) {
    const look = LOOKS[id];
    if (!look) continue;

    it(`${id}: every scrolling prop clears the track`, () => {
      const { props } = look.layout();
      expect(props.length).toBeGreaterThan(0);
      for (const p of props)
        expect(Math.abs(p.x)).toBeGreaterThanOrEqual(TRACK_W / 2 + 0.8);
    });

    it(`${id}: props span ±40 sideways and the whole scroll range`, () => {
      const { props } = look.layout();
      const xs = props.map((p) => p.x);
      expect(Math.min(...xs)).toBeLessThan(-35);
      expect(Math.max(...xs)).toBeGreaterThan(35);
      for (const p of props) {
        expect(p.z).toBeGreaterThanOrEqual(PROP_FAR);
        expect(p.z).toBeLessThan(PROP_NEAR);
      }
    });

    it(`${id}: the backdrop stands beyond the haze, or high in the sky`, () => {
      for (const p of look.layout().backdrop)
        expect(p.z < HAZE_FAR_Z || p.y - p.sy >= 15).toBe(true);
    });

    it(`${id}: the layout is identical across builds`, () => {
      expect(look.layout()).toEqual(look.layout());
    });
  }
});

describe("race day", () => {
  const { props, backdrop } = LOOKS.stadium?.layout() ?? {
    props: [],
    backdrop: [],
  };

  it("is built", () => {
    expect(builtLooks()).toContain("stadium");
  });

  it("tiles stands and flags without a seam", () => {
    expect(PROP_SPAN % STAND_STEP).toBe(0);
    expect(PROP_SPAN % FLAG_STEP).toBe(0);
  });

  it("has a few thousand coloured spectators and alternating flags", () => {
    expect(props.length).toBeGreaterThan(2000);
    expect(props.length).toBeLessThan(6000);
    const flags = props.filter((p) => p.shape === "flag");
    expect(new Set(flags.map((f) => f.colour)).size).toBe(2);
    const seen = new Set(
      props.filter((p) => p.sy < 1 && p.sx === 0.4).map((p) => p.colour),
    );
    expect(seen.size).toBeGreaterThanOrEqual(6);
  });

  it("keeps the stands and flags clear of the track on both sides", () => {
    for (const p of props.filter((q) => q.shape !== "box" || q.sx > 0.2))
      expect(Math.abs(p.x)).toBeGreaterThan(6);
    expect(props.some((p) => p.x < -9)).toBe(true);
    expect(props.some((p) => p.x > 9)).toBe(true);
  });

  it("floats balloons above the sky line, drifting", () => {
    const balloons = backdrop.filter((p) => p.shape === "balloon");
    expect(balloons.length).toBeGreaterThan(5);
    for (const b of balloons) {
      expect(b.y - b.sy).toBeGreaterThanOrEqual(15);
      expect(b.drift).not.toBe(0);
    }
  });
});

describe("block city", () => {
  const { props } = LOOKS.city?.layout() ?? { props: [] };
  const blocks = props.filter((p) => p.shape === "block");

  it("is built, and the pick covers four looks", () => {
    expect(builtLooks()).toEqual(["country", "spring", "stadium", "city"]);
    const seen = new Set<string>();
    for (let seed = 0; seed < 100; seed++) seen.add(sceneryFor(seed));
    expect(seen.size).toBe(4);
  });

  it("tiles pavement and lamps without a seam", () => {
    expect(PROP_SPAN % WALK_STEP).toBe(0);
    expect(PROP_SPAN % LAMP_STEP).toBe(0);
  });

  it("starts the buildings beyond the pavement, and the pavement clears the kerbs", () => {
    expect(blocks.length).toBeGreaterThan(50);
    for (const b of blocks)
      expect(Math.abs(b.x) - b.sx / 2).toBeGreaterThanOrEqual(BLOCK_X);
    for (const p of props.filter((q) => q.shape === "box" && q.sy === 0.12))
      expect(Math.abs(p.x) - p.sx / 2).toBeGreaterThanOrEqual(5.5);
    expect(BLOCK_X).toBeGreaterThanOrEqual(WALK_X + WALK_W / 2);
  });

  it("fills each row to the seam: near-continuous, no overlap", () => {
    for (const s of [-1, 1]) {
      const row = blocks
        .filter((b) => Math.sign(b.x) === s && Math.abs(b.x) - b.sx / 2 < 12)
        .sort((a, b) => a.z - b.z);
      let prevEnd = PROP_FAR;
      for (const b of row) {
        expect(b.z - b.sz / 2).toBeGreaterThanOrEqual(prevEnd - 1e-9);
        expect(b.z - b.sz / 2 - prevEnd).toBeLessThan(4);
        prevEnd = b.z + b.sz / 2;
      }
      expect(PROP_NEAR - prevEnd).toBeLessThan(4);
    }
  });

  it("sizes blocks in whole windows and colours them from the pastels", () => {
    for (const b of blocks) {
      expect(b.sy / WINDOW_H).toBeCloseTo(Math.round(b.sy / WINDOW_H));
      expect(b.sx % WINDOW_W).toBe(0);
      expect(b.sz % WINDOW_W).toBe(0);
    }
    expect(new Set(blocks.map((b) => b.colour)).size).toBeGreaterThanOrEqual(6);
  });
});

describe("spring petals", () => {
  const petals = LOOKS.spring?.layout().petals ?? [];

  it("are one layer of at most 300", () => {
    expect(petals.length).toBeGreaterThan(0);
    expect(petals.length).toBeLessThanOrEqual(MAX_PETALS);
  });

  it("never hang low over the track, at any time", () => {
    for (const p of petals)
      for (let clock = 0; clock < 200; clock += 0.37) {
        const x = petalX(p, clock);
        if (Math.abs(x) < TRACK_W / 2 + 0.8)
          expect(petalY(p, clock)).toBeGreaterThanOrEqual(PETAL_TRACK_MIN_Y);
      }
  });

  it("stay in range and scroll with the run", () => {
    for (const p of petals) {
      for (const d of [0, 3.3, 99.9, 1234.5]) {
        expect(petalZ(p, d)).toBeGreaterThanOrEqual(PETAL_FAR);
        expect(petalZ(p, d)).toBeLessThan(PETAL_NEAR);
      }
      expect(petalY(p, 3)).toBeLessThan(p.hi);
      expect(petalY(p, 3)).toBeGreaterThanOrEqual(p.lo);
    }
  });

  it("the other looks have none", () => {
    expect(LOOKS.country?.layout().petals).toEqual([]);
  });
});
