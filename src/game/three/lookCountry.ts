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

/** Fence posts sit this far out from the track's centre (just beyond the kerb). */
const FENCE_X = 6.6;
/** One fence section's length: it divides PROP_SPAN, so the wrap has no seam. */
export const FENCE_STEP = 4;

/** Countryside: trees, bushes and a white fence by the road; hills and drifting clouds beyond. */
export function countryLayout(): Layout {
  const rng = createRng(7);
  const props: Part[] = [];
  const backdrop: Part[] = [];
  for (let z = PROP_FAR; z < PROP_NEAR; z += FENCE_STEP)
    for (const s of [-1, 1])
      props.push(part("fence", s * FENCE_X, 0, z, 1, 0xffffff));
  for (let i = 0; i < 90; i++) {
    const x = side(rng) * range(rng, 8.5, 40);
    const z = range(rng, PROP_FAR, PROP_NEAR);
    const s = range(rng, 0.9, 1.5);
    const rot = rng() * Math.PI * 2;
    props.push(part("trunk", x, 0, z, s, 0x8a5a3b, { rot }));
    if (rng() < 0.35)
      props.push(
        part(
          "pine",
          x,
          2.8 * s,
          z,
          s,
          pick(rng, [0x2f8f4e, 0x3aa35a, 0x2b7d46]),
          {
            rot,
          },
        ),
      );
    else
      props.push(
        part(
          "crown",
          x,
          2.4 * s,
          z,
          range(rng, 1.2, 1.6) * s,
          pick(rng, [0x4caf50, 0x5cbf5a, 0x3f9f4a]),
          { rot },
        ),
      );
  }
  for (let i = 0; i < 50; i++) {
    const r = range(rng, 0.4, 0.8);
    props.push(
      part(
        "bush",
        side(rng) * range(rng, 7.2, 20),
        0.3,
        range(rng, PROP_FAR, PROP_NEAR),
        r,
        pick(rng, [0x5cbf5a, 0x6fd06a, 0x4aa84d]),
        { sy: r * 0.7, rot: rng() * Math.PI * 2 },
      ),
    );
  }
  for (let i = 0; i < 7; i++) {
    const r = range(rng, 50, 90);
    backdrop.push(
      part(
        "hill",
        -270 + i * 90 + range(rng, -20, 20),
        -6,
        -300 - range(rng, 0, 40),
        r,
        pick(rng, [0x9fd99a, 0x8dcf8f, 0xa9dfa2]),
        { sy: r * 0.35 },
      ),
    );
  }
  for (let i = 0; i < 9; i++) {
    const scale = range(rng, 1.4, 2.6);
    const cx = range(rng, -160, 160);
    const cy = range(rng, 28, 70);
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
