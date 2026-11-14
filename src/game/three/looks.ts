import { createRng } from "../../core/rng";
import { DIST_SCALE, HAZE_MAX } from "./world";
import { LOOK_IDS, type LookId, type Look } from "./scenery";
import { countryLayout } from "./lookCountry";
import { springLayout } from "./lookSpring";
import { stadiumLayout } from "./lookStadium";
import { cityLayout } from "./lookCity";
import { skyLayout } from "./lookSky";

/** The built looks. Later looks add an entry here and a layout function. */
export const LOOKS: Partial<Record<LookId, Look>> = {
  country: {
    id: "country",
    sky: { top: 0x5fb8f5, horizon: 0xd8f0ff, below: 0xd8f0ff },
    ground: 0x7fcf6a,
    layout: countryLayout,
  },
  spring: {
    id: "spring",
    sky: { top: 0x7ec4f0, horizon: 0xfde8ef, below: 0xfde8ef },
    ground: 0x9fd68a,
    layout: springLayout,
  },
  stadium: {
    id: "stadium",
    sky: { top: 0x4aa8f0, horizon: 0xd4eeff, below: 0xd4eeff },
    ground: 0x6cc35c,
    layout: stadiumLayout,
  },
  sky: {
    id: "sky",
    sky: { top: 0x3f86e0, horizon: 0xcfe6ff, below: 0xffffff },
    ground: null,
    layout: skyLayout,
  },
  city: {
    id: "city",
    sky: { top: 0x6cc0f5, horizon: 0xe2f2ff, below: 0xe2f2ff },
    ground: 0xbfc6d4,
    layout: cityLayout,
  },
};

/** The ids of the looks that exist, in LOOK_IDS order. */
export const builtLooks = (): LookId[] => LOOK_IDS.filter((id) => LOOKS[id]);

/** The look a run's `seed` gets: one of the built looks, roughly evenly. */
export function sceneryFor(seed: number): LookId {
  const built = builtLooks();
  // a stream of its own, so the pick doesn't follow the track's own randomness
  const u = createRng((seed ^ 0x5ce4e7) >>> 0)();
  return built[Math.floor(u * built.length)] as LookId;
}

/** Haze is at most this far ahead (world units): props past it are always hidden, so PROP_FAR lies beyond it. */
export const HAZE_FAR_Z = -HAZE_MAX * DIST_SCALE;
