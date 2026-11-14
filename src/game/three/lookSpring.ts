import { createRng } from "../../core/rng";
import { TRACK_W } from "./world";
import {
  type Part,
  type Petal,
  type Layout,
  PROP_NEAR,
  PROP_FAR,
  PETAL_NEAR,
  PETAL_FAR,
  PETAL_TRACK_MIN_Y,
  range,
  pick,
  side,
  part,
} from "./scenery";

/** Spring village's stone lanterns: every 12 (divides PROP_SPAN), at this x. */
const LANTERN_STEP = 12;
const LANTERN_X = 6.8;

/** Spring village: cherry trees, stone lanterns and small houses by the road; a snowy mountain, a pale sun and clouds beyond; petals. */
export function springLayout(): Layout {
  const rng = createRng(11);
  const props: Part[] = [];
  const backdrop: Part[] = [];
  const stone = 0xc4c0b8;
  for (let z = PROP_FAR; z < PROP_NEAR; z += LANTERN_STEP)
    for (const s of [-1, 1]) {
      const x = s * LANTERN_X;
      props.push(
        part("box", x, 0, z, 1, stone, { sx: 0.7, sy: 0.25, sz: 0.7 }),
        part("box", x, 0.25, z, 1, 0xd2cec6, { sx: 0.3, sy: 0.8, sz: 0.3 }),
        part("box", x, 1.05, z, 1, 0xfff3c4, { sx: 0.5, sy: 0.45, sz: 0.5 }),
        part("roof", x, 1.5, z, 1, 0x8c8880, { sx: 0.65, sy: 0.4, sz: 0.65 }),
      );
    }
  for (let i = 0; i < 60; i++) {
    const x = side(rng) * range(rng, 8, 34);
    const z = range(rng, PROP_FAR, PROP_NEAR);
    const s = range(rng, 0.9, 1.4);
    props.push(part("trunk", x, 0, z, s, 0x6b4a3a, { rot: rng() * 6 }));
    const puffs = 3 + Math.floor(rng() * 2);
    for (let k = 0; k < puffs; k++) {
      const a = (k / puffs) * Math.PI * 2 + rng();
      const r = range(rng, 0.9, 1.3) * s;
      props.push(
        part(
          "crown",
          x + Math.cos(a) * 0.8 * s,
          (2.3 + (k % 2) * 0.5) * s,
          z + Math.sin(a) * 0.8 * s,
          r,
          pick(rng, [0xffb7d0, 0xffa6c4, 0xffc8da, 0xf79bbb]),
          { rot: rng() * 6 },
        ),
      );
    }
  }
  for (let i = 0; i < 26; i++) {
    const w = range(rng, 3, 5);
    const d = range(rng, 3, 4.5);
    const x = side(rng) * range(rng, 14, 40);
    const z = range(rng, PROP_FAR, PROP_NEAR);
    const rot = range(rng, -0.2, 0.2);
    props.push(
      part("box", x, 0, z, 1, 0xf5efe4, { sx: w, sy: 2.2, sz: d, rot }),
      part("roof", x, 2.2, z, 1, pick(rng, [0x3e4a5c, 0x5a3e3e, 0x2f3b4a]), {
        sx: w * 0.82,
        sy: 1.6,
        sz: d * 0.82,
        rot,
      }),
    );
  }
  // one big snowy mountain, two lesser peaks, a pale sun and a few clouds
  backdrop.push(
    part("peak", 34, 22, -360, 1, 0x8fa3c4, { sx: 95, sy: 70, sz: 95 }),
    part("peak", 34, 45.5, -359.5, 1, 0xffffff, { sx: 31, sy: 23, sz: 31 }),
    part("peak", -120, 18, -345, 1, 0xa6b6d2, { sx: 70, sy: 50, sz: 70 }),
    part("peak", 150, 14, -345, 1, 0xa6b6d2, { sx: 60, sy: 42, sz: 60 }),
    part("sun", -60, 55, -355, 14, 0xfff1f4),
  );
  for (let i = 0; i < 5; i++) {
    const scale = range(rng, 1.5, 2.4);
    const cx = range(rng, -160, 160);
    const cy = range(rng, 45, 80);
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
  // petals: a few high over the track, the rest at the sides at any height
  const petals: Petal[] = [];
  for (let i = 0; i < 260; i++) {
    const over = i < 80;
    const lo = over ? PETAL_TRACK_MIN_Y + 0.5 : 0.2;
    const hi = over ? 14 : 12;
    petals.push({
      x: over
        ? range(rng, -TRACK_W / 2, TRACK_W / 2)
        : side(rng) * range(rng, TRACK_W / 2 + 1.8, 30),
      y: range(rng, lo, hi),
      z: range(rng, PETAL_FAR, PETAL_NEAR),
      lo,
      hi,
      fall: range(rng, 0.5, 1.2),
      sway: range(rng, 0.2, 0.6),
      phase: rng() * Math.PI * 2,
    });
  }
  return { props, backdrop, petals };
}
