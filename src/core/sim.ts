import { clipLoss, crowdWidth, type Span } from "./crowd";
import {
  gateOpenings,
  growOpening,
  nearestOpening,
  wallSolids,
  type Opening,
} from "./gates";
import {
  expectedArmy,
  firepower,
  hazardHeads,
  hazardHp,
  packArmy,
  packCount,
  pickTarget,
  type Threat,
} from "./fire";
import {
  isTrigger,
  pickTarget as pickReaskTarget,
  REASK_OPTIONS,
  reaskRow,
  type ReaskConfig,
  type ReaskLink,
} from "./reask";
import { createRng } from "./rng";
import {
  applyCorrect,
  applyCorrectCharge,
  applyWrong,
  applyWrongCharge,
} from "./scoring";
import {
  BASE_REWARD,
  BASE_SPEED,
  CRATE_REWARD_K,
  CROWD_DEPTH_MAX,
  HORDE_GAP_LOOSE,
  MELEE_HIT,
  MELEE_RATE,
  ENEMY_SPEED,
  FIRE_PER_SOLDIER,
  FIRE_RANGE,
  GATE_GROW_PER_DAMAGE,
  MAX_SPEED_MUL,
  PACK_FIRE_RANGE,
  PACK_MERGE_SPEED,
  PACK_WAKE,
  REASK_MAX,
  PACK_COLUMN_MAX,
  STARTING_ARMY,
  STEER_EASE,
  SQUAD_DEFECT_GAIN,
  STEER_MAX_SPEED,
  VIEW_DISTANCE,
  HORDE_DEFAULTS,
  type HordeTuning,
} from "./tuning";
import { hazardSpan, isCharge, type Hazard, type Track } from "./track";
import type { GateRow } from "./types";

/** A moving enemy pack: its stream's head (track position) and its crowd's centre. */
export type PackState = { pos: number; x: number };

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

export { gateOpenings, nearestOpening, wallSolids, type Opening };

/**
 * Re-asks in this run (WaniKani mode): the config it was built with, the
 * entry each row asks now, and the links placed so far. Fits `ReaskRecord`.
 */
export type ReaskState = ReaskConfig & {
  links: readonly ReaskLink[];
  /** The rows as built at the start, before any re-ask. */
  planned: readonly GateRow[];
};

/**
 * The run's rows as built at the start. The boss is sized from these, so a
 * re-ask (which may change a row's gate type) never changes it.
 */
export function plannedRows(s: RunState): readonly GateRow[] {
  return s.reask?.planned ?? s.rows;
}

/**
 * Where an army that died stopped: the gate it died at (1-based, the number of
 * answered gates) out of the run's planned gates. For "gate 9 of 14".
 */
export function gateReached(s: RunState): { gate: number; of: number } {
  return { gate: s.results.length, of: plannedRows(s).length };
}

export type RunStatus = "running" | "finished" | "dead";

export type RunState = {
  rows: GateRow[];
  /** Where the questions and hazards are. */
  track: Track;
  /** Distance the army has travelled. */
  dist: number;
  /** Index of the next unresolved row. */
  next: number;
  /** Index of the next hazard not yet passed. */
  nextHazard: number;
  /** Crowd centre, 0 (left edge) to 1 (right edge). */
  x: number;
  /** Where steering input wants the crowd to be. */
  targetX: number;
  army: number;
  streak: number;
  /** The run's longest streak of correct answers (re-asks count like any gate). */
  bestStreak: number;
  /** Per resolved row: was it answered correctly. */
  results: boolean[];
  /** Hit points per hazard (0 = can't be shot). */
  hp: number[];
  /** Enemies per hazard at the start (packCount for packs, 0 otherwise); each has hp / heads. */
  heads: number[];
  /** Damage dealt so far per hazard (fire and melee); a block is shattered once this reaches its hp. */
  damage: number[];
  /** Per hazard: a pack's enemies that have reached the army's front so far (fractional, a running total). */
  arrived: number[];
  /**
   * Per hazard: how far into a pack's column, counted from its front (the
   * dead too), its enemies have reached the army's front (fractional). It
   * dies from the front, so those still alive up to here fight there now
   * (packMelee; see MELEE_RATE).
   */
  front: number[];
  /** Per hazard: soldiers its melee has cost so far (fractional; whole soldiers are lost as it rises). */
  meleeLoss: number[];
  /** Per hazard: whether its numbers are settled (a pack is sized for the army when it wakes: see wakePacks). */
  woke: boolean[];
  /** Per hazard: where its enemy pack is now (null for blocks and saws). */
  packs: (PackState | null)[];
  /** Hazard being fired at this step, if any. */
  target: number | null;
  /** Per row: its wall's openings as they are now (shooting one grows it). */
  gates: Opening[][];
  /** Opening of the next row's wall being shot (grown) this step, if any. */
  gateTarget: number | null;
  /** Most recent shattered block and the distance it happened at, for feedback. */
  lastShatter: { index: number; dist: number } | null;
  /** Most recent crate payout (recruits from a shattered block) and the distance it happened at, for feedback. */
  lastCrate: { gain: number; dist: number } | null;
  /** Most recent clipping loss and the distance it happened at, for feedback. */
  lastClip: { loss: number; dist: number } | null;
  /** Most recent answer, for feedback: the opening chosen and the army change it caused (after clipping). */
  lastAnswer: {
    correct: boolean;
    choice: number;
    change: number;
    dist: number;
  } | null;
  status: RunStatus;
  /** Re-asks, when the run has them on; else null. */
  reask: ReaskState | null;
  /** The horde tuning this run was built with (the view reads its figure size). */
  horde: HordeTuning;
};

/** 1.0× until the first row is reached, then linear to MAX_SPEED_MUL by the time the last row appears. */
export function speedMul(dist: number, track: Track): number {
  const q = track.questions;
  const start = q[0] ?? 0;
  const end = (q.at(-1) ?? 0) - VIEW_DISTANCE;
  if (end <= start) return 1;
  const t = Math.min(1, Math.max(0, (dist - start) / (end - start)));
  return 1 + (MAX_SPEED_MUL - 1) * t;
}

/**
 * A run at the start. With a `ReaskConfig` (rows and config from `reaskRun`),
 * triggers place re-asks ahead; the track and hit points stay as built here.
 * `horde` sets the packs (HORDE_DEFAULTS when absent).
 */
export function createRunState(
  rows: GateRow[],
  track: Track,
  reask: ReaskConfig | null = null,
  horde: HordeTuning = HORDE_DEFAULTS,
): RunState {
  const expected = expectedArmy(rows, track.charges);
  const s: RunState = {
    rows,
    track,
    dist: 0,
    next: 0,
    nextHazard: 0,
    x: 0.5,
    targetX: 0.5,
    army: STARTING_ARMY,
    streak: 0,
    bestStreak: 0,
    results: [],
    hp: hazardHp(track, expected, horde),
    heads: hazardHeads(track, expected, horde),
    damage: track.hazards.map(() => 0),
    arrived: track.hazards.map(() => 0),
    front: track.hazards.map(() => 0),
    meleeLoss: track.hazards.map(() => 0),
    woke: track.hazards.map(() => false),
    // the head starts at the crowd's front (crowdFront)
    packs: track.hazards.map((h) =>
      h.kind === "pack" ? { pos: h.pos - CROWD_DEPTH_MAX / 2, x: h.x } : null,
    ),
    target: null,
    gates: rows.map((r) => gateOpenings(r.options.length)),
    gateTarget: null,
    lastShatter: null,
    lastCrate: null,
    lastClip: null,
    lastAnswer: null,
    status: "running",
    reask: reask && { ...reask, links: [], planned: rows },
    horde,
  };
  // a pack already charging at the start (none in a real run: packs come
  // after a wall) keeps the numbers it was built with
  return {
    ...s,
    woke: track.hazards.map((h, i) => h.kind !== "pack" || packAwake(s, i)),
  };
}

/** Row q's wall openings as they are now. */
export function rowOpenings(s: RunState, q: number): Opening[] {
  return s.gates[q] ?? gateOpenings(s.rows[q]?.options.length ?? 2);
}

/** Squads stand in a wall's openings: one per answer, at each opening's centre. */
export function squadCentres(openings: readonly Opening[]): number[] {
  return openings.map((o) => o.centre);
}

export type SquadView = {
  label: string;
  /** Centre across the track. */
  x: number;
  /** Shown count: the same for every squad. */
  count: number;
  /** The squad the army ran into. False for every squad before contact. */
  chosen: boolean;
  /** Only for the chosen squad after contact: it joins (correct) or fights back (wrong). */
  outcome: "join" | "fight" | null;
};

export type ChargeView = {
  row: number;
  /** Track position of the wall the squads stand in. */
  pos: number;
  prompt: string;
  /** Contact has happened. */
  resolved: boolean;
  /** Distance at which contact happened, for the most recent answer only (else null). */
  contactDist: number | null;
  squads: SquadView[];
};

export type RunView = { charges: ChargeView[] };

/**
 * What the renderer may know about squad charges. No correctness data until
 * contact, and then only for the squad the army ran into, while that charge
 * is the most recent answer.
 */
export function viewOf(s: RunState): RunView {
  const charges = s.track.charges.flatMap((q): ChargeView[] => {
    const row = s.rows[q];
    if (!row) return [];
    const answer = q === s.next - 1 ? s.lastAnswer : null;
    const squads = squadCentres(rowOpenings(s, q)).map((x, j): SquadView => {
      const chosen = answer?.choice === j;
      return {
        label: row.options[j] ?? "",
        x,
        count: SQUAD_DEFECT_GAIN,
        chosen,
        outcome:
          answer?.choice === j ? (answer.correct ? "join" : "fight") : null,
      };
    });
    return [
      {
        row: q,
        pos: s.track.questions[q] ?? Infinity,
        prompt: row.prompt,
        resolved: q < s.next,
        contactDist: answer?.dist ?? null,
        squads,
      },
    ];
  });
  return { charges };
}

export function isShattered(s: RunState, i: number): boolean {
  const hp = s.hp[i] ?? 0;
  return hp > 0 && (s.damage[i] ?? 0) >= hp;
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

/**
 * Pack i's span where it can hit and be hit: its mouth while it waits; once
 * it wakes, its stream, as wide as the army and centred on it (it homes in,
 * so nothing that reaches the army can be dodged).
 */
export function packSpan(s: RunState, i: number): Span {
  if (!packAwake(s, i) && (s.arrived[i] ?? 0) <= 0) return packMouth(s, i);
  const w = crowdWidth(s.army);
  return { left: s.x - w / 2, right: s.x + w / 2 };
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
export function packDensity(s: RunState, i: number): number {
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

/** What one of pack i's enemies is worth in soldiers: the army it was sized for over its head count. */
export function enemyWorth(s: RunState, i: number): number {
  const heads = s.heads[i] ?? 0;
  const per = s.horde.killSeconds * FIRE_PER_SOLDIER;
  return heads > 0 && per > 0 ? (s.hp[i] ?? 0) / per / heads : 0;
}

/**
 * n more of pack i's enemies reach the army's front from its stream: they
 * stop there and join the melee (never more than the stream has left).
 */
function arrive(s: RunState, i: number, n: number): RunState {
  const k = Math.min(n, packStreamLeft(s, i));
  if (k <= 0) return s;
  const arrived = [...s.arrived];
  const front = [...s.front];
  arrived[i] = (arrived[i] ?? 0) + k;
  // the dead ahead of the stream's front count as passed
  const killed = (s.heads[i] ?? 0) - packHeadsLeft(s, i);
  front[i] = Math.max(front[i] ?? 0, killed) + k;
  return { ...s, arrived, front };
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
function wakePacks(s: RunState): RunState {
  let next = s;
  for (let i = s.nextHazard; i < s.packs.length; i++) {
    if (next.woke[i] || !packAwake(next, i)) continue;
    const woke = [...next.woke];
    woke[i] = true;
    const per = next.horde.killSeconds * FIRE_PER_SOLDIER;
    const expected = per > 0 ? (next.hp[i] ?? 0) / per : 0;
    const army = packArmy(expected, next.army, next.horde.packAdapt);
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
function movePacks(s: RunState, dt: number): RunState {
  let next = s;
  for (let i = s.nextHazard; i < s.packs.length; i++) {
    const p = next.packs[i];
    if (!p || !packAwake(s, i)) continue;
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
    packs[i] = { pos: Math.max(pos, s.dist), x: p.x };
    next = { ...next, packs };
    if (over > 0) next = arrive(next, i, over * packDensity(next, i));
  }
  return next;
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
        range: PACK_FIRE_RANGE,
      };
    return null;
  });
}

/**
 * Fire never reaches past the next unresolved question's wall (a charge's
 * too), so nothing beyond it can be hit (or revealed).
 */
export function fireLimit(s: RunState): number {
  return s.track.questions[s.next] ?? Infinity;
}

/** Recruits a crate pays out when it shatters. */
export const crateReward = (hp: number): number =>
  Math.round(CRATE_REWARD_K * hp);

/**
 * With nothing else to shoot, fire goes to the next wall once it is within
 * FIRE_RANGE: the opening nearest the crowd's centre grows (see growOpening).
 * Only where the crowd is matters, never which answer is right.
 */
function shootGate(s: RunState, dt: number): RunState {
  const q = s.next;
  const ahead = (s.track.questions[q] ?? Infinity) - s.dist;
  if (!s.rows[q] || ahead < 0 || ahead > FIRE_RANGE)
    return { ...s, gateTarget: null };
  const openings = rowOpenings(s, q);
  const i = nearestOpening(openings, s.x);
  const gates = [...s.gates];
  gates[q] = growOpening(
    openings,
    i,
    firepower(s.army) * dt * GATE_GROW_PER_DAMAGE,
  );
  return { ...s, gates, gateTarget: i };
}

/**
 * All fire goes to the nearest shootable threat ahead; damage is capped at its hp.
 * A block (supply crate) pays out once, on the step it shatters: it is never a target again.
 * With no threat to shoot, the next wall's opening takes the fire.
 */
function fire(s: RunState, w: number, dt: number): RunState {
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
  damage[target] = Math.min(hp, (damage[target] ?? 0) + firepower(s.army) * dt);
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

/** Keeps a crowd of width w fully on the track. */
const clampOnTrack = (v: number, w: number): number =>
  Math.min(1 - w / 2, Math.max(w / 2, v));

/** Steering input. */
export function setTarget(s: RunState, targetX: number): RunState {
  if (s.status !== "running") return s;
  return { ...s, targetX: clampOnTrack(targetX, crowdWidth(s.army)) };
}

export function nudgeTarget(s: RunState, dx: number): RunState {
  return setTarget(s, s.targetX + dx);
}

/** Eased move towards the target, never faster than STEER_MAX_SPEED. */
function steerStep(x: number, targetX: number, w: number, dt: number): number {
  const v = Math.max(
    -STEER_MAX_SPEED,
    Math.min(STEER_MAX_SPEED, (targetX - x) / STEER_EASE),
  );
  const dx = v * dt;
  // never overshoot the target
  const step = Math.abs(dx) > Math.abs(targetX - x) ? targetX - x : dx;
  return clampOnTrack(x + step, w);
}

/** `pace` scales the forward scroll only (a speed preset's multiplier). */
export function stepRun(s: RunState, dt: number, pace = 1): RunState {
  if (s.status !== "running") return s;
  let next = { ...s };
  const w = crowdWidth(s.army);
  next.targetX = clampOnTrack(s.targetX, w);
  next.x = steerStep(s.x, next.targetX, w, dt);
  next.dist += BASE_SPEED * pace * speedMul(s.dist, s.track) * dt;
  next = wakePacks(next);
  next = movePacks(next, dt);
  next = meleeStep(next, dt);
  next = fire(next, w, dt);
  // resolve everything passed this step, in track order
  for (;;) {
    if (next.status !== "running") return next;
    const hazard = next.track.hazards[next.nextHazard];
    const pos = hazardPos(next, next.nextHazard);
    const rowPos = next.track.questions[next.next] ?? Infinity;
    // a melee reaching the next wall or hazard is fought out first (track order)
    if (
      hazard?.kind === "pack" &&
      packStreaming(next, next.nextHazard) &&
      Math.min(rowPos, nextObstacle(next)) <= next.dist
    )
      next = settleMelee(next, next.nextHazard);
    // a pack streaming in (or in melee) holds the hazards behind it until it is dead
    if (
      hazard &&
      pos <= rowPos &&
      pos <= next.dist &&
      !(hazard.kind === "pack" && packStreaming(next, next.nextHazard))
    )
      next = passHazard(next, hazard);
    else if (rowPos <= next.dist) next = resolveRow(next);
    else return next;
  }
}

/** Track position of the first block or saw after the next hazard (packs behind a melee queue behind it). */
function nextObstacle(s: RunState): number {
  for (let j = s.nextHazard + 1; j < s.track.hazards.length; j++) {
    const h = s.track.hazards[j];
    if (h && h.kind !== "pack") return h.pos;
  }
  return Infinity;
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
 * dead. Rare in a real run (see the balance log in tasks/todo-hordes.md).
 */
function settleMelee(s: RunState, i: number): RunState {
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

/**
 * Losses only: hazards never touch the streak or results. Shattered blocks
 * don't clip. A pack is passed once it is dead (its losses came in its
 * melee; see meleeStep).
 */
function passHazard(s: RunState, h: Hazard): RunState {
  const i = s.nextHazard;
  if (h.kind === "pack") return { ...s, nextHazard: i + 1 };
  const clip = isShattered(s, i)
    ? 0
    : clipLoss(s.army, s.x, crowdWidth(s.army), [hazardSpan(h, s.dist)]);
  const army = s.army - clip;
  return {
    ...s,
    army,
    nextHazard: s.nextHazard + 1,
    lastClip: clip > 0 ? { loss: clip, dist: s.dist } : s.lastClip,
    status: army <= 0 ? "dead" : s.status,
  };
}

/**
 * Contact with a wall, or a charge (a wall with a squad in each opening):
 * the wall clips, the opening nearest the crowd's centre is the answer, and
 * a charge scores as a charge.
 */
function resolveRow(s: RunState): RunState {
  const row = s.rows[s.next];
  if (!row) return { ...s, status: "finished" };
  const openings = rowOpenings(s, s.next);
  const charge = isCharge(s.track, s.next);
  // clipping first, then the answer is scored on what is left
  const clip = clipLoss(s.army, s.x, crowdWidth(s.army), wallSolids(openings));
  const remaining = s.army - clip;
  const choice = nearestOpening(openings, s.x);
  const correct = choice === row.answerIndex;
  const base = BASE_REWARD[row.type];
  const scored = correct
    ? (charge ? applyCorrectCharge : applyCorrect)(remaining, s.streak, base)
    : (charge ? applyWrongCharge : applyWrong)(remaining);
  // a crowd clipped to nothing stays dead, but the answer still counts
  const army = remaining > 0 ? scored.army : 0;
  const streak = scored.streak;
  const nextIndex = s.next + 1;
  const status =
    army <= 0 ? "dead" : nextIndex >= s.rows.length ? "finished" : "running";
  const resolved: RunState = {
    ...s,
    army,
    streak,
    bestStreak: Math.max(s.bestStreak, streak),
    next: nextIndex,
    results: [...s.results, correct],
    lastClip: clip > 0 ? { loss: clip, dist: s.dist } : s.lastClip,
    lastAnswer: { correct, choice, change: army - remaining, dist: s.dist },
    status,
  };
  return status === "running"
    ? placeReask(resolved, s.next, correct)
    : resolved;
}

/** Decorrelates a re-ask row's rng from the run's and the target pick's. */
const REASK_ROW_SALT = 0x27d4eb2f;

/**
 * After row `q` resolves: if it is a trigger and fewer than `REASK_MAX`
 * re-asks are placed, `pickTarget`'s row (if any) becomes a re-ask of `q`,
 * with new openings for `REASK_OPTIONS` answers. Nothing else changes.
 */
function placeReask(s: RunState, q: number, correct: boolean): RunState {
  const r = s.reask;
  if (!r || r.links.length >= REASK_MAX) return s;
  const reasks = s.rows.map((_, i) => r.links.some((l) => l.row === i));
  if (!isTrigger(correct, r.startBoxes[q] ?? 0, reasks[q] ?? false)) return s;
  const keys = r.entries.map((e) => e.key);
  const target = pickReaskTarget(r.seed, q, {
    keys,
    reasks,
    charges: s.track.charges,
  });
  const entry = r.entries[q];
  const first = s.rows[q];
  if (target === null || !entry || !first) return s;
  const rng = createRng(
    (r.seed ^
      REASK_ROW_SALT ^
      Math.imul(q + 1, 0x9e3779b1) ^
      Math.imul(target + 1, 0x85ebca77)) >>>
      0,
  );
  const rows = [...s.rows];
  rows[target] = reaskRow(rng, entry, first, r.pool);
  const gates = [...s.gates];
  gates[target] = gateOpenings(REASK_OPTIONS);
  const entries = [...r.entries];
  entries[target] = entry;
  const startBoxes = [...r.startBoxes];
  startBoxes[target] = r.startBoxes[q] ?? 0;
  return {
    ...s,
    rows,
    gates,
    reask: {
      ...r,
      entries,
      startBoxes,
      links: [...r.links, { row: target, of: q }],
    },
  };
}
