import { crowdWidth, type Span } from "./crowd";
import { firepower, packArmy, packCount } from "./fire";
import { clampOnTrack, fireLimit, type RunState } from "./state";
import {
  CROWD_DEPTH_MAX,
  ENEMY_SPEED,
  FIRE_PER_SOLDIER,
  HORDE_GAP_LOOSE,
  MELEE_HIT,
  MELEE_RATE,
  PACK_COLUMN_MAX,
  PACK_MERGE_SPEED,
  PACK_WAKE,
  TRACK_DELAY,
  TRACK_SPEED,
} from "./tuning";

/**
 * A pack's waiting crowd (track units): `cols` across its mouth `gx` apart
 * and `rows` back `gz` apart (odd rows shifted a quarter gap each way, so
 * it reads as scattered, not a grid), `depth` = rows × gz deep. Figures
 * stand HORDE_GAP_LOOSE × scale apart (about gx × gz each), closer when
 * that would be deeper than CROWD_DEPTH_MAX.
 */
export type Crowd = {
  cols: number;
  rows: number;
  gx: number;
  gz: number;
  depth: number;
};

/** The crowd a pack of `heads` stands in, `width` wide (track units), figures `scale` a soldier's size. */
export function packCrowd(heads: number, width: number, scale: number): Crowd {
  const n = Math.max(1, heads);
  const w = Math.max(1e-3, width);
  const g = Math.min(
    HORDE_GAP_LOOSE * scale,
    Math.sqrt((CROWD_DEPTH_MAX * w) / n),
  );
  const cols = Math.max(1, Math.min(n, Math.floor(w / g)));
  const gx = w / cols;
  const rows = Math.ceil(n / cols);
  const gz = Math.min((g * g) / gx, CROWD_DEPTH_MAX / rows);
  return { cols, rows, gx, gz, depth: rows * gz };
}

/** Pack i's crowd (see packCrowd), from its head count and the run's tuning. */
export function crowdOf(s: RunState, i: number): Crowd {
  return packCrowd(
    s.heads[i] ?? 0,
    Math.min(1, s.horde.packWidth),
    s.horde.hordeScale,
  );
}

/**
 * Where pack i's crowd starts (its front row's track position):
 * CROWD_DEPTH_MAX / 2 short of the pack's place, whatever its size, so every
 * pack gives the army as long to shoot and the deepest crowd is centred on
 * the place. It stands there for good; the stream's head starts here.
 */
export function crowdFront(s: RunState, i: number): number {
  return (s.track.hazards[i]?.pos ?? Infinity) - CROWD_DEPTH_MAX / 2;
}

/** Pack i's enemies left as a fraction: remaining hit points over each enemy's (hp / heads). */
export function packHeadsLeft(s: RunState, i: number): number {
  const hp = s.hp[i] ?? 0;
  const heads = s.heads[i] ?? 0;
  if (hp <= 0) return 0;
  return (Math.max(0, hp - (s.damage[i] ?? 0)) * heads) / hp;
}

/**
 * Enemies left in pack i, rounded up so the count drops only when one really
 * dies: the head count while untouched, 0 once it is shot to nothing.
 */
export function packSurvivors(s: RunState, i: number): number {
  return Math.max(0, Math.ceil(packHeadsLeft(s, i) - 1e-6));
}

/**
 * Pack i's mouth: the wide pack as it charges down the track, horde.packWidth
 * wide, centred where it is, kept on the track. It doesn't follow the army,
 * and doesn't narrow as it is shot (it thins from the front).
 */
export function packMouth(s: RunState, i: number): Span {
  const w = Math.min(1, Math.max(0, s.horde.packWidth));
  const x = clampOnTrack(s.packs[i]?.x ?? 0.5, w);
  return { left: x - w / 2, right: x + w / 2 };
}

/** The army's span across the track. */
function armySpan(s: RunState): Span {
  const w = crowdWidth(s.army);
  return { left: s.x - w / 2, right: s.x + w / 2 };
}

const overlap = (a: Span, b: Span): number =>
  Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));

/** Pack i's stream across the track: `streamW` wide at `streamX` (see PackState). */
export function streamSpan(s: RunState, i: number): Span {
  const p = s.packs[i];
  const m = packMouth(s, i);
  const x = p?.streamX ?? (m.left + m.right) / 2;
  const w = p?.streamW ?? crowdWidth(s.army);
  return { left: x - w / 2, right: x + w / 2 };
}

/**
 * The share (0..1) of pack i's stream that meets the army where they reach
 * its line: the overlap of the two spans over the stream's width. The rest
 * runs past beside it (arrive).
 */
export function packContact(s: RunState, i: number): number {
  const sp = streamSpan(s, i);
  const w = sp.right - sp.left;
  return w > 0 ? Math.min(1, overlap(sp, armySpan(s)) / w) : 0;
}

/**
 * The share (0..1) of the army's fire that hits pack i: it fires straight
 * ahead across its own width, so the share of its width that pack i's span
 * covers (all of it while enemies fight at its front).
 */
export function packFireShare(s: RunState, i: number): number {
  const a = armySpan(s);
  const w = a.right - a.left;
  return w > 0 ? Math.min(1, overlap(packSpan(s, i), a) / w) : 0;
}

/**
 * Pack i's span where it can hit and be hit: its mouth while it waits; once
 * it wakes, its stream (streamSpan: it tracks the army, late and no faster
 * than TRACK_SPEED, so a quick sidestep can dodge it); while enemies fight
 * at the army's front, the army's own span (they are on it).
 */
export function packSpan(s: RunState, i: number): Span {
  if (!packAwake(s, i) && (s.arrived[i] ?? 0) <= 0 && (s.missed[i] ?? 0) <= 0)
    return packMouth(s, i);
  if (packMelee(s, i) > 0) return armySpan(s);
  return streamSpan(s, i);
}

/** Where hazard i is now: packs move, everything else stays put. */
export function hazardPos(s: RunState, i: number): number {
  return s.packs[i]?.pos ?? s.track.hazards[i]?.pos ?? Infinity;
}

/**
 * Enemies per track unit along pack i's column: its heads over
 * PACK_COLUMN_MAX, the same length for every pack, so each gives the army
 * as long to shoot. Enemy k from the front stands k / packDensity behind the
 * head, or (drawn) in the crowd until the head has run far enough for that
 * place to be nearer than its own: the crowd empties from its front.
 */
function packDensity(s: RunState, i: number): number {
  return (s.heads[i] ?? 0) / PACK_COLUMN_MAX;
}

/**
 * How far back (track units) pack i's stream runs from its front: its
 * enemies left that are not yet at the army's front, over packDensity.
 */
export function packLength(s: RunState, i: number): number {
  return packStreamLeft(s, i) / packDensity(s, i);
}

/** Pack i's enemies left still in its stream (not yet at the army's front). */
export function packStreamLeft(s: RunState, i: number): number {
  return Math.max(0, packHeadsLeft(s, i) - packMelee(s, i));
}

/** Pack i's enemies at the army's front now (never more than are left). */
export function packMelee(s: RunState, i: number): number {
  const left = packHeadsLeft(s, i);
  const killed = (s.heads[i] ?? 0) - left;
  return Math.min(left, Math.max(0, (s.front[i] ?? 0) - killed));
}

/**
 * Whether pack i is charging: not yet passed, within PACK_WAKE, and no
 * unanswered wall between it and the army (it never runs through a wall,
 * and can't be shot through one either).
 */
export function packAwake(s: RunState, i: number): boolean {
  const p = s.packs[i];
  return (
    !!p &&
    i >= s.nextHazard &&
    p.pos - s.dist <= PACK_WAKE &&
    p.pos < fireLimit(s)
  );
}

/** Whether pack i's front has reached the army: its enemies stream into a melee at the army's front until it is dead. */
export function packStreaming(s: RunState, i: number): boolean {
  const p = s.packs[i];
  return !!p && i >= s.nextHazard && p.pos <= s.dist && packSurvivors(s, i) > 0;
}

/** Whether the enemies won: the army was wiped out by a melee at its front (they cheer: CHEER_SECONDS). */
export function enemiesWon(s: RunState): boolean {
  if (s.status !== "dead") return false;
  for (let i = s.nextHazard; i < s.packs.length; i++)
    if (packMelee(s, i) > 0) return true;
  return false;
}

/** What one of pack i's enemies is worth in soldiers: the army it was sized for over its head count. */
export function enemyWorth(s: RunState, i: number): number {
  const heads = s.heads[i] ?? 0;
  const per = s.horde.killSeconds * FIRE_PER_SOLDIER;
  return heads > 0 && per > 0 ? (s.hp[i] ?? 0) / per / heads : 0;
}

/**
 * n more of pack i's enemies reach the army's line from its stream (never
 * more than the stream has left): the share that meets the army
 * (packContact) stops at its front and joins the melee; the rest run past
 * beside it and are gone (`missed`, counted as dead without a kill, so the
 * pack thins from its front as ever).
 */
function arrive(s: RunState, i: number, n: number): RunState {
  const k = Math.min(n, packStreamLeft(s, i));
  if (k <= 0) return s;
  const met = k * packContact(s, i);
  const miss = k - met;
  const arrived = [...s.arrived];
  const front = [...s.front];
  const missed = [...s.missed];
  const damage = [...s.damage];
  arrived[i] = (arrived[i] ?? 0) + met;
  // the dead ahead of the stream's front count as passed
  const killed = (s.heads[i] ?? 0) - packHeadsLeft(s, i);
  front[i] = Math.max(front[i] ?? 0, killed) + k;
  missed[i] = (missed[i] ?? 0) + miss;
  const hp = s.hp[i] ?? 0;
  const heads = s.heads[i] ?? 0;
  if (miss > 0 && heads > 0)
    damage[i] = Math.min(hp, (damage[i] ?? 0) + (miss * hp) / heads);
  return { ...s, arrived, front, missed, damage };
}

/**
 * dt seconds of melee at the army's front (see MELEE_RATE): every pack with
 * enemies there costs MELEE_RATE × their worth in soldiers per second (a
 * running total; whole soldiers are lost as it rises), and the army fights
 * back, firepower(army) × dt of damage to the nearest pack there, which
 * kills from its front (the melee) first. Fire comes on top (see fire).
 * An army at 0 is dead.
 */
export function meleeStep(s: RunState, dt: number): RunState {
  let next = s;
  let fought = false;
  for (let i = s.nextHazard; i < s.packs.length; i++) {
    const m = packMelee(next, i);
    if (m <= 0) continue;
    if (!fought) {
      // the army fights back at the nearest pack at its front
      fought = true;
      const hp = next.hp[i] ?? 0;
      const heads = next.heads[i] ?? 0;
      const reach = heads > 0 ? (m * hp) / heads : 0;
      const damage = [...next.damage];
      const dealt = Math.min(
        hp,
        (damage[i] ?? 0) + Math.min(reach, MELEE_HIT * firepower(s.army) * dt),
      );
      damage[i] = dealt;
      next = {
        ...next,
        damage,
        lastShatter:
          dealt >= hp ? { index: i, dist: s.dist } : next.lastShatter,
      };
    }
    const meleeLoss = [...next.meleeLoss];
    const was = meleeLoss[i] ?? 0;
    const now = was + MELEE_RATE * m * enemyWorth(next, i) * dt;
    meleeLoss[i] = now;
    const loss = Math.min(
      next.army,
      Math.floor(now + 1e-9) - Math.floor(was + 1e-9),
    );
    next = { ...next, meleeLoss };
    if (loss > 0) {
      const army = next.army - loss;
      next = {
        ...next,
        army,
        lastClip: { loss, dist: s.dist },
        status: army <= 0 ? "dead" : next.status,
      };
    }
  }
  return next;
}

/**
 * A pack that has just woken is sized for the army as it is now (packArmy:
 * part of the way from the expected army to a bigger actual one): its HP
 * and head count (so its melee worth too). Once, at waking; nothing before.
 */
export function wakePacks(s: RunState): RunState {
  let next = s;
  for (let i = s.nextHazard; i < s.packs.length; i++) {
    if (next.woke[i] || !packAwake(next, i)) continue;
    const woke = [...next.woke];
    woke[i] = true;
    const per = next.horde.killSeconds * FIRE_PER_SOLDIER;
    const expected = per > 0 ? (next.hp[i] ?? 0) / per : 0;
    const army = packArmy(expected, next.army);
    if (army === expected) {
      next = { ...next, woke };
      continue;
    }
    const hp = [...next.hp];
    const heads = [...next.heads];
    hp[i] = army * per;
    heads[i] = packCount(army, next.horde);
    next = { ...next, woke, hp, heads };
  }
  return next;
}

/**
 * Charging packs run at the army, staying where they are across the track
 * (their span closes onto the army near it: packSpan). A pack whose front
 * reaches the army stays there and streams into a melee at its front: the
 * stretch of column that would run past it arrives (packDensity enemies
 * per track unit). A pack right behind another that still has enemies joins
 * the back of its column, catching up at PACK_MERGE_SPEED, so the two make
 * one target and one stream.
 */
export function movePacks(s: RunState, dt: number): RunState {
  let next = s;
  for (let i = s.nextHazard; i < s.packs.length; i++) {
    if (!next.packs[i] || !packAwake(s, i)) continue;
    next = trackArmy(next, i, dt);
    const p = next.packs[i];
    if (!p) continue;
    let pos = p.pos - ENEMY_SPEED * dt;
    const k = i - 1;
    const lead = next.packs[k];
    if (
      k >= s.nextHazard &&
      lead &&
      packAwake(s, k) &&
      packSurvivors(next, k) > 0
    )
      pos = Math.max(
        lead.pos + packLength(next, k),
        p.pos - (ENEMY_SPEED + PACK_MERGE_SPEED) * dt,
      );
    const over = Math.max(0, s.dist - pos);
    const packs = [...next.packs];
    packs[i] = { ...p, pos: Math.max(pos, s.dist) };
    next = { ...next, packs };
    if (over > 0) next = arrive(next, i, over * packDensity(next, i));
  }
  return next;
}

/**
 * dt seconds of pack i's stream tracking the army: its aim follows the
 * army's x with a first-order lag (TRACK_DELAY); the stream moves toward
 * its aim no faster than TRACK_SPEED, and its width toward the army's no
 * faster than TRACK_SPEED at each edge, kept on the track.
 */
function trackArmy(s: RunState, i: number, dt: number): RunState {
  const p = s.packs[i];
  if (!p) return s;
  const sp = streamSpan(s, i);
  const w = crowdWidth(s.army);
  const x0 = (sp.left + sp.right) / 2;
  const w0 = sp.right - sp.left;
  const a0 = p.aimX ?? x0;
  const aimX = a0 + (s.x - a0) * (1 - Math.exp(-dt / TRACK_DELAY));
  const cap = TRACK_SPEED * dt;
  const streamW = w0 + Math.max(-2 * cap, Math.min(2 * cap, w - w0));
  const streamX = clampOnTrack(
    x0 + Math.max(-cap, Math.min(cap, aimX - x0)),
    streamW,
  );
  const packs = [...s.packs];
  packs[i] = { ...p, streamX, aimX, streamW };
  return { ...s, packs };
}

/** Step of a melee fought out at once (settleMelee), in seconds. */
const SETTLE_DT = 1 / 60;
/** Most steps a melee fought out at once can take (it never needs this many). */
const SETTLE_MAX = 60 * 60;

/**
 * The cap on a melee's length, for track order: when the army reaches the
 * next wall or hazard while pack i is still fighting at its front, the rest
 * of its stream joins the melee and it is fought out at once, as meleeStep
 * and fire would (the army's fire all on it), until the pack or the army is
 * dead. Rare in a real run (see the balance log in tasks/done/todo-hordes.md).
 */
export function settleMelee(s: RunState, i: number): RunState {
  let next = arrive(s, i, Infinity);
  for (
    let k = 0;
    k < SETTLE_MAX && packSurvivors(next, i) > 0 && next.status === "running";
    k++
  ) {
    next = meleeStep(next, SETTLE_DT);
    const hp = next.hp[i] ?? 0;
    const damage = [...next.damage];
    const dealt = Math.min(
      hp,
      (damage[i] ?? 0) + firepower(next.army) * SETTLE_DT,
    );
    damage[i] = dealt;
    next = {
      ...next,
      damage,
      lastShatter: dealt >= hp ? { index: i, dist: s.dist } : next.lastShatter,
    };
  }
  return next;
}
