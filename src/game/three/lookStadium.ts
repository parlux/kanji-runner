import { createRng } from "../../core/rng";
import {
  type Part,
  type Layout,
  PROP_NEAR,
  PROP_FAR,
  range,
  pick,
  side,
  part,
} from "./scenery";

/** Race day: stand segments, posts and flags are laid in steps that divide PROP_SPAN. */
export const STAND_STEP = 12;
export const FLAG_STEP = 12;
const FLAG_X = 6.4;
/** Stepped stands: tiers start at this |x|, are this wide and this much higher each. */
const STAND_X = 9;
const TIER_W = 1.4;
const TIER_H = 0.8;
const TIERS = 6;
const CROWD_COLOURS = [
  0xff5a5a, 0xffc94a, 0x3d7bff, 0xffffff, 0x50d27a, 0xff8fd0, 0x9b6bff,
];

/** Race day: stepped stands with a crowd and an orange roof on both sides, flags along the kerbs, floodlights; balloons and clouds in the sky. */
export function stadiumLayout(): Layout {
  const rng = createRng(23);
  const props: Part[] = [];
  const backdrop: Part[] = [];
  const grey = [0xe4e6ea, 0xc8ccd2];
  const roofX = STAND_X + TIER_W * (TIERS - 1) - 0.4;
  const roofW = 5.2;
  const standTop = TIERS * TIER_H;
  for (let z = PROP_FAR; z < PROP_NEAR; z += STAND_STEP) {
    const zc = z + STAND_STEP / 2;
    for (const s of [-1, 1]) {
      for (let i = 0; i < TIERS; i++) {
        const x = s * (STAND_X + TIER_W * (i + 0.5));
        const top = (i + 1) * TIER_H;
        props.push(
          part("box", x, 0, zc, 1, grey[i % 2] as number, {
            sx: TIER_W,
            sy: top,
            sz: STAND_STEP,
          }),
        );
        for (let k = 0; k < STAND_STEP; k++) {
          if (rng() < 0.2) continue;
          props.push(
            part(
              "box",
              x + range(rng, -0.2, 0.2),
              top,
              zc + (k - STAND_STEP / 2 + 0.5) + range(rng, -0.15, 0.15),
              1,
              pick(rng, CROWD_COLOURS),
              { sx: 0.4, sy: range(rng, 0.5, 0.7), sz: 0.4 },
            ),
          );
        }
      }
      // roof over the upper tiers: low edge at the front, rising to the back
      props.push(
        part(
          "awning",
          s * (roofX + roofW / 2 - 0.1),
          standTop + 2.2,
          zc,
          1,
          0xff7a59,
          {
            sx: roofW,
            sz: STAND_STEP,
            rot: s < 0 ? Math.PI : 0,
          },
        ),
        part("box", s * (roofX + roofW - 0.3), 0, zc, 1, 0xf2f2f4, {
          sx: 0.35,
          sy: standTop + 2.7,
          sz: 0.35,
        }),
        part("box", s * (roofX + 0.2), 0, zc, 1, 0xf2f2f4, {
          sx: 0.35,
          sy: standTop + 1.7,
          sz: 0.35,
        }),
      );
    }
  }
  // flags on poles along the kerbs, alternating kerb orange and army blue
  for (let z = PROP_FAR, n = 0; z < PROP_NEAR; z += FLAG_STEP, n++)
    for (const s of [-1, 1]) {
      const x = s * FLAG_X;
      const zf = z + FLAG_STEP / 2;
      props.push(
        part("box", x, 0, zf, 1, 0xf2f2f2, { sx: 0.1, sy: 3.4, sz: 0.1 }),
        part("flag", x, 2.9, zf, 1, n % 2 ? 0x3d7bff : 0xff7a59, {
          sy: 0.9,
          sz: 1.3,
        }),
      );
    }
  // floodlight masts behind the stands
  for (let z = PROP_FAR + 42; z < PROP_NEAR; z += 84)
    for (const s of [-1, 1])
      props.push(
        part("box", s * 38, 0, z, 1, 0xbfc4cc, { sx: 0.6, sy: 16, sz: 0.6 }),
        part("box", s * 38, 16, z, 1, 0xfff6c8, { sx: 4, sy: 1.4, sz: 0.8 }),
      );
  // balloons high in the sky, and a few clouds
  for (let i = 0; i < 16; i++) {
    const r = range(rng, 1.3, 2);
    backdrop.push(
      part(
        "balloon",
        range(rng, -70, 70),
        range(rng, 20, 48),
        range(rng, -220, -110),
        r,
        pick(
          rng,
          CROWD_COLOURS.filter((c) => c !== 0xffffff),
        ),
        { sy: r * 1.2, drift: side(rng) * range(rng, 0.6, 1.4) },
      ),
    );
  }
  for (let i = 0; i < 4; i++) {
    const scale = range(rng, 1.5, 2.4);
    const cx = range(rng, -160, 160);
    const cy = range(rng, 40, 75);
    const cz = range(rng, -200, -320);
    const n = 3 + Math.floor(rng() * 3);
    for (let k = 0; k < n; k++) {
      const r = range(rng, 2, 3.4) * scale;
      backdrop.push(
        part(
          "puff",
          cx + ((k - n / 2) * 2.6 + range(rng, -0.6, 0.6)) * scale,
          cy + range(rng, -0.4, 1.2) * scale,
          cz + range(rng, -1, 1) * scale,
          r,
          0xffffff,
          { sy: r * 0.7, drift: 1.5 },
        ),
      );
    }
  }
  return { props, backdrop, petals: [] };
}
