import { createRng, type Rng } from "../../core/rng";
import {
  type Part,
  type Layout,
  PROP_NEAR,
  PROP_SPAN,
  PROP_FAR,
  range,
  pick,
  part,
} from "./scenery";

/** Block city: street lamps and pavement tiles are laid every 12 (divides PROP_SPAN). */
export const LAMP_STEP = 12;
const LAMP_X = 6.2;
export const WALK_STEP = 12;
/** The pavement runs from the kerb's outer edge: centred at this |x|, this wide. */
export const WALK_X = 7;
export const WALK_W = 3;
/** Building row 1 starts at this |x| (beyond the pavement). */
export const BLOCK_X = 9;
/** A window is this wide and high (world units): block sizes are multiples, so the pattern fits. */
export const WINDOW_W = 2;
export const WINDOW_H = 2.4;
const PASTELS = [
  0xffb5a7, 0xffd6a5, 0xfdffb6, 0xcaffbf, 0x9bf6ff, 0xa0c4ff, 0xbdb2ff,
  0xffc6ff,
];

/**
 * One side's row of blocks from `inner` outwards: depths from `depths` (and
 * widths from `widths`) fill PROP_SPAN exactly, the leftover spread as small
 * gaps, so the row tiles the wrap with no hole at the seam.
 */
function blockRow(
  rng: Rng,
  s: number,
  inner: number,
  widths: number[],
  depths: number[],
  floors: [number, number],
  props: Part[],
): void {
  const ds: number[] = [];
  let total = 0;
  for (;;) {
    const d = pick(rng, depths);
    if (total + d + (ds.length + 1) > PROP_SPAN) break;
    ds.push(d);
    total += d;
  }
  const weights = ds.map(() => range(rng, 0.4, 2.5));
  const wsum = weights.reduce((a, b) => a + b, 0);
  let z = PROP_FAR;
  ds.forEach((d, i) => {
    const w = pick(rng, widths);
    const h =
      WINDOW_H * (floors[0] + Math.floor(rng() * (floors[1] - floors[0] + 1)));
    props.push(
      part(
        "block",
        s * (inner + w / 2 + range(rng, 0, 1.5)),
        0,
        z + d / 2,
        1,
        pick(rng, PASTELS),
        { sx: w, sy: h, sz: d },
      ),
    );
    z += d + ((PROP_SPAN - total) * (weights[i] as number)) / wsum;
  });
}

/** Block city: pastel blocks in near-continuous rows, pavement and street lamps by the road. */
export function cityLayout(): Layout {
  const rng = createRng(31);
  const props: Part[] = [];
  const backdrop: Part[] = [];
  for (let z = PROP_FAR; z < PROP_NEAR; z += WALK_STEP)
    for (const s of [-1, 1])
      props.push(
        part("box", s * WALK_X, 0, z + WALK_STEP / 2, 1, 0xe4e7ee, {
          sx: WALK_W,
          sy: 0.12,
          sz: WALK_STEP,
        }),
      );
  for (let z = PROP_FAR; z < PROP_NEAR; z += LAMP_STEP)
    for (const s of [-1, 1]) {
      const zl = z + LAMP_STEP / 2;
      props.push(
        part("box", s * LAMP_X, 0, zl, 1, 0x4a5568, {
          sx: 0.14,
          sy: 3.6,
          sz: 0.14,
        }),
        // the arm and lamp reach out over the pavement, never over the kerb
        part("box", s * (LAMP_X + 0.4), 3.5, zl, 1, 0x4a5568, {
          sx: 0.9,
          sy: 0.08,
          sz: 0.08,
        }),
        part("box", s * (LAMP_X + 0.8), 3.2, zl, 1, 0xfff3b0, {
          sx: 0.35,
          sy: 0.2,
          sz: 0.3,
        }),
      );
    }
  for (const s of [-1, 1]) {
    blockRow(rng, s, BLOCK_X, [6, 8, 10], [6, 8, 10], [3, 9], props);
    blockRow(rng, s, 24, [14, 16, 18, 20, 22], [8, 10, 12], [5, 12], props);
  }
  // a pale skyline beyond the haze (within the drift wrap, so it stays put)
  for (let i = 0; i < 40; i++) {
    const h = range(rng, 14, 50);
    backdrop.push(
      part(
        "box",
        range(rng, -210, 210),
        -2,
        range(rng, -340, -300),
        1,
        pick(rng, [0xf2f7ff, 0xe6eefa, 0xdde8f6]),
        {
          sx: range(rng, 12, 26),
          sy: h,
          sz: 12,
        },
      ),
    );
  }
  // a blimp drifting slowly: a white body with an orange tail fin
  backdrop.push(
    part("blimp", -8, 34, -260, 1, 0xf0f2f7, {
      sx: 12,
      sy: 5,
      sz: 5,
      drift: 2,
    }),
    part("fin", -19, 35, -260, 1, 0xff7a59, {
      sx: 4,
      sy: 6,
      sz: 0.4,
      drift: 2,
    }),
  );
  for (let i = 0; i < 5; i++) {
    const scale = range(rng, 1.5, 2.4);
    const cx = range(rng, -160, 160);
    const cy = range(rng, 70, 100);
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
