import { KANA } from "../../src/core/kana";
import { wanikaniPool } from "../../src/core/pool";
import { reaskRun, type ReaskConfig } from "../../src/core/reask";
import { defaultProgress } from "../../src/core/srs";
import type { GateRow } from "../../src/core/types";
import { syntheticList } from "./wk-fixture";

/** A fresh WaniKani-mode player on the synthetic list: every kanji at its seeded box. */
export const wkProgress = defaultProgress();
export const wkPool = wanikaniPool(wkProgress, KANA, syntheticList(60));

/** A WaniKani run from the seed, with re-asks on (or off: same rows, no config). */
export function wkRun(
  seed: number,
  reask = true,
): { rows: GateRow[]; reask: ReaskConfig | null } {
  const run = reaskRun(seed, wkProgress, wkPool);
  return { rows: run.rows, reask: reask ? run.reask : null };
}
