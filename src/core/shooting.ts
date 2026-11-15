import { firepower, splitFire, type Threat } from "./fire";
import { hazardPos, packSpan } from "./horde";
import { fireLimit, type RunState } from "./state";
import { BLOCK_HP_K, CRATE_REWARD_K } from "./tuning";
import { shootGate } from "./walls";

export function isShattered(s: RunState, i: number): boolean {
  const hp = s.hp[i] ?? 0;
  return hp > 0 && (s.damage[i] ?? 0) >= hp;
}

/** What can be shot now: intact blocks and packs with enemies left. */
export function threats(s: RunState): (Threat | null)[] {
  return s.track.hazards.map((h, i) => {
    if ((s.hp[i] ?? 0) <= 0 || isShattered(s, i)) return null;
    if (h.kind === "block")
      return { pos: h.pos, span: { left: h.left, right: h.right } };
    if (h.kind === "pack")
      return { pos: hazardPos(s, i), span: packSpan(s, i) };
    return null;
  });
}

/**
 * Recruits a crate pays out when it shatters: CRATE_REWARD_K × the expected
 * army it was sized for (hp ÷ BLOCK_HP_K, a whole number of soldiers, so it is
 * rounded back exactly), whatever BLOCK_HP_K is.
 */
export const crateReward = (hp: number): number =>
  Math.round(CRATE_REWARD_K * Math.round(hp / BLOCK_HP_K));

/**
 * Fire by lane (splitFire): each part of the army's span fires at the
 * nearest shootable threat ahead overlapping it, so a crate blocks what is
 * behind it; each target takes firepower × dt × its share, capped at its hp.
 * A block (supply crate) pays out once, on the step it shatters: it is never
 * a target again (two shattering in one step both pay). The share with no
 * threat ahead goes to the next wall's opening (shootGate).
 */
export function fire(s: RunState, w: number, dt: number): RunState {
  const { shares, free } = splitFire(
    threats(s),
    s.nextHazard,
    s.dist,
    { left: s.x - w / 2, right: s.x + w / 2 },
    fireLimit(s),
  );
  const damage = [...s.damage];
  let gain = 0;
  let lastShatter = s.lastShatter;
  let target: number | null = null;
  let most = 0;
  for (const { index, share } of shares) {
    if (share > most) {
      most = share;
      target = index;
    }
    const hp = s.hp[index] ?? 0;
    damage[index] = Math.min(
      hp,
      (damage[index] ?? 0) + firepower(s.army) * dt * share,
    );
    if (damage[index] < hp) continue;
    lastShatter = { index, dist: s.dist };
    if (s.track.hazards[index]?.kind === "block") gain += crateReward(hp);
  }
  // the wall takes the free share of this step's army (before any payout)
  const g = shootGate(s, dt, free);
  return {
    ...g,
    army: g.army + gain,
    damage,
    targets: shares,
    target,
    lastShatter,
    lastCrate: gain > 0 ? { gain, dist: s.dist } : s.lastCrate,
  };
}
