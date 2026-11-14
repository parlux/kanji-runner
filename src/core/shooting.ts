import { firepower, pickTarget, type Threat } from "./fire";
import { hazardPos, packFireShare, packSpan } from "./horde";
import { fireLimit, type RunState } from "./state";
import { CRATE_REWARD_K, PACK_WAKE } from "./tuning";
import { shootGate } from "./walls";

export function isShattered(s: RunState, i: number): boolean {
  const hp = s.hp[i] ?? 0;
  return hp > 0 && (s.damage[i] ?? 0) >= hp;
}

/** What can be shot now: intact blocks and packs with enemies left. */
function threats(s: RunState): (Threat | null)[] {
  return s.track.hazards.map((h, i) => {
    if ((s.hp[i] ?? 0) <= 0 || isShattered(s, i)) return null;
    if (h.kind === "block")
      return { pos: h.pos, span: { left: h.left, right: h.right } };
    if (h.kind === "pack")
      return {
        pos: hazardPos(s, i),
        span: packSpan(s, i),
        range: PACK_WAKE,
      };
    return null;
  });
}

/** Recruits a crate pays out when it shatters. */
export const crateReward = (hp: number): number =>
  Math.round(CRATE_REWARD_K * hp);

/**
 * All fire goes to the nearest shootable threat ahead whose span overlaps
 * the army's (a pack takes only its share: packFireShare); damage is capped at its hp.
 * A block (supply crate) pays out once, on the step it shatters: it is never a target again.
 * With no threat to shoot, the next wall's opening takes the fire.
 */
export function fire(s: RunState, w: number, dt: number): RunState {
  const target = pickTarget(
    threats(s),
    s.nextHazard,
    s.dist,
    { left: s.x - w / 2, right: s.x + w / 2 },
    fireLimit(s),
  );
  if (target === null) return shootGate({ ...s, target }, dt);
  const hp = s.hp[target] ?? 0;
  const damage = [...s.damage];
  // straight ahead: a pack takes the share of the fire its span faces
  const share =
    s.track.hazards[target]?.kind === "pack" ? packFireShare(s, target) : 1;
  damage[target] = Math.min(
    hp,
    (damage[target] ?? 0) + firepower(s.army) * dt * share,
  );
  const shattered = damage[target] >= hp;
  const gain =
    shattered && s.track.hazards[target]?.kind === "block"
      ? crateReward(hp)
      : 0;
  return {
    ...s,
    army: s.army + gain,
    damage,
    target,
    gateTarget: null,
    lastShatter: shattered ? { index: target, dist: s.dist } : s.lastShatter,
    lastCrate: gain > 0 ? { gain, dist: s.dist } : s.lastCrate,
  };
}
