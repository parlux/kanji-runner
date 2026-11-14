import { createRng } from "../../core/rng";
import { TRACK_W } from "./world";
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

/** Cloud road: islands start beyond this |x| (their full extent, so they never hang over the track). */
export const ISLE_MIN_X = 8;
/** The cloud sea's tops stay below this Y, under the track's underside slab. */
export const CLOUD_SEA_TOP = -2;

/** Cloud road: a sea of clouds below, floating grassy islands with trees beside the road; far clouds and a pale sun. */
export function skyLayout(): Layout {
  const rng = createRng(41);
  const props: Part[] = [];
  const backdrop: Part[] = [];
  // the cloud sea: soft clusters under and beside the road, scrolling with the run
  for (let i = 0; i < 70; i++) {
    const scale = range(rng, 1.2, 2.4);
    const cx = side(rng) * range(rng, 8, 70);
    const cy = range(rng, -12, -6);
    const cz = range(rng, PROP_FAR + 4, PROP_NEAR - 4);
    const n = 3 + Math.floor(rng() * 3);
    for (let k = 0; k < n; k++) {
      const r = range(rng, 1, 1.6) * scale;
      const x = cx + ((k - n / 2) * 1.3 + range(rng, -0.3, 0.3)) * scale;
      props.push(
        part(
          "puff",
          // clusters near the road are nudged out so every puff's centre clears the kerb
          Math.sign(cx) * Math.max(TRACK_W / 2 + 0.8, Math.abs(x)),
          Math.min(cy + range(rng, -0.2, 0.6) * scale, CLOUD_SEA_TOP - r * 0.7),
          cz + range(rng, -0.6, 0.6) * scale,
          r,
          0xffffff,
          { sy: r * 0.7 },
        ),
      );
    }
  }
  // floating islands: an upside-down rock cone, a grass top and one or two trees
  for (let i = 0; i < 22; i++) {
    const r = range(rng, 3, 6);
    const s = side(rng);
    // more near the road, so a phone's narrow view still sees some
    const x = s * (ISLE_MIN_X + r + rng() ** 2 * (50 - ISLE_MIN_X - r));
    const y = range(rng, -3, 16);
    const z = range(rng, PROP_FAR, PROP_NEAR);
    const bob = rng() * Math.PI * 2;
    props.push(
      part("isle", x, y, z, r, 0x9c7a5b, { sy: r * 1.8, bob }),
      part("disc", x, y, z, r, 0x6fd06a, { sy: 0.6, bob }),
    );
    const trees = 1 + Math.floor(rng() * 2);
    for (let j = 0; j < trees; j++) {
      const tx = x + range(rng, -r / 2, r / 2);
      const tz = z + range(rng, -r / 2, r / 2);
      const ts = range(rng, 0.8, 1.2);
      const ty = y + 0.6;
      const rot = rng() * Math.PI * 2;
      props.push(part("trunk", tx, ty, tz, ts, 0x8a5a3b, { rot, bob }));
      if (rng() < 0.4)
        props.push(
          part("pine", tx, ty + 2.8 * ts, tz, ts, 0x2f8f4e, { rot, bob }),
        );
      else
        props.push(
          part(
            "crown",
            tx,
            ty + 2.4 * ts,
            tz,
            range(rng, 1.2, 1.5) * ts,
            pick(rng, [0x4caf50, 0x5cbf5a]),
            { rot, bob },
          ),
        );
    }
  }
  // far clouds below the horizon, beyond the haze, and a pale sun
  for (let i = 0; i < 18; i++) {
    const scale = range(rng, 3, 5);
    const cx = range(rng, -200, 200);
    const cy = range(rng, -24, -14);
    const cz = range(rng, -340, -280);
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
          { sy: r * 0.6 },
        ),
      );
    }
  }
  backdrop.push(part("sun", 110, 80, -340, 14, 0xfffbe6));
  return { props, backdrop, petals: [] };
}
