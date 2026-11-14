import { HORDE_DEFAULTS, PACK_ADAPT } from "../../core/tuning";

/**
 * One wave of the horde gauntlet (`?sandbox=horde`): the army you have, and
 * one pack built as the game builds it for an `expected` army, with these
 * horde settings. `army` = `expected` is the normal case; a bigger `army`
 * tests PACK_ADAPT.
 */
export type WavePreset = {
  /** Soldiers you start the wave with. */
  army: number;
  /** The army the pack is sized for (its HP is killSeconds × expected). */
  expected: number;
  /** Enemies in the pack (also its cap, as the game's biggest packs). */
  enemies: number;
  /** Seconds the expected army takes to mow the whole pack down. */
  killSeconds: number;
  /** The waiting crowd's width, a share of the track. */
  packWidth: number;
  /** Enemy figure size, a share of a soldier's. */
  hordeScale: number;
  /** How far the pack follows a bigger army (see PACK_ADAPT). */
  packAdapt: number;
  /** How far ahead (track units) the crowd's front stands when the wave starts (INTRO_AHEAD when absent; a run's packs wake about 2 out, behind a wall). */
  ahead?: number;
  /** Where the crowd stands across the track (0..1). */
  x: number;
  /** What the wave tests, for the log (never shown while playing). */
  note: string;
};

/** Today's defaults: a late pack of a normal run (expected army about 60, at the 200 cap). */
const BASE: WavePreset = {
  army: 60,
  expected: 60,
  enemies: HORDE_DEFAULTS.packMax,
  killSeconds: HORDE_DEFAULTS.killSeconds,
  packWidth: HORDE_DEFAULTS.packWidth,
  hordeScale: HORDE_DEFAULTS.hordeScale,
  packAdapt: PACK_ADAPT,
  x: 0.5,
  note: "defaults",
};

const wave = (w: Partial<WavePreset> & { note: string }): WavePreset => ({
  ...BASE,
  ...w,
});

/**
 * The gauntlet, in order (round 2, after the owner's round 1: 3.5 s kills,
 * full adapt, melee contact). Each wave's note says what it tests.
 */
export const GAUNTLET: readonly WavePreset[] = [
  wave({ note: "baseline: army 60, its pack" }),
  wave({
    ahead: 2,
    note: "woken close, as behind a wall in a run: reached",
    x: 0.4,
  }),
  wave({
    army: 150,
    note: "strong army 150 (2.5x): tougher enemies, same pace",
  }),
  wave({
    army: 300,
    note: "strong army 300 (5x): tougher enemies, same pace",
    x: 0.6,
  }),
  wave({
    army: 600,
    note: "strong army 600 (10x): tougher enemies, same pace",
  }),
  wave({
    army: 40,
    ahead: 3,
    note: "mid army (40 vs a pack for 60) reached briefly",
    x: 0.45,
  }),
  wave({
    army: 20,
    note: "weak army (20 vs a pack for 60) reached: melee",
    x: 0.55,
  }),
  wave({
    army: 8,
    note: "outmatched (8 vs a pack for 60): melee can wipe you out",
  }),
];

/** Problems with a preset list (empty when it is fine to play). */
export function presetErrors(list: readonly WavePreset[]): string[] {
  const errors: string[] = [];
  if (list.length === 0) errors.push("no waves");
  list.forEach((p, i) => {
    const bad = (what: string) => errors.push(`wave ${i + 1}: ${what}`);
    const pos = (v: number) => Number.isFinite(v) && v > 0;
    if (!Number.isInteger(p.army) || p.army < 1) bad("army");
    if (!pos(p.expected)) bad("expected");
    if (!Number.isInteger(p.enemies) || p.enemies < 1 || p.enemies > 20_000)
      bad("enemies");
    if (!pos(p.killSeconds)) bad("killSeconds");
    if (!(p.packWidth > 0 && p.packWidth <= 1)) bad("packWidth");
    if (!pos(p.hordeScale)) bad("hordeScale");
    if (!(p.packAdapt >= 0 && p.packAdapt <= 1)) bad("packAdapt");
    if (!(p.x >= 0 && p.x <= 1)) bad("x");
    if (p.ahead !== undefined && !(p.ahead > 0 && p.ahead <= 12)) bad("ahead");
  });
  return errors;
}
