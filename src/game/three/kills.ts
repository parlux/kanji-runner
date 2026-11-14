import {
  AdditiveBlending,
  BoxGeometry,
  Color,
  Euler,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Quaternion,
  RingGeometry,
  Vector3,
} from "three";
import type { RunState } from "../../core/sim";
import { FX_COLOURS } from "./fx";
import { HORDE_SLOTS } from "./horde";
import { crowdHalfDepth, DIST_SCALE, shapeDistance, worldZ } from "./world";

/**
 * Kill effects for the horde (Task H6), from the deaths the GPU horde
 * records. Kills come at the stream's head (fire) and at the army's front
 * (melee), so they are gathered per slot for KILL_PULSE seconds and come out
 * as one event per row: a flash band where the fire lands and spark chips
 * flung back and up; melee kills flash on both fronts; a pack's last enemy
 * goes with a big final burst and a shockwave ring on the ground. A fixed
 * pool of events and pieces (one instanced mesh of cubes, one of rings: two
 * draw calls), timed by the scene clock (still while paused), placed on the
 * ground as the army runs on (run distance).
 */

/** Events alive at once (the oldest is replaced). */
export const MAX_KILL_EVENTS = 48;
/** Pieces drawn at once; over it, extras are dropped. */
export const MAX_KILL_PIECES = 320;
/** Shockwave rings drawn at once. */
export const MAX_KILL_RINGS = 4;
/** A row's kills are gathered over this long (seconds) into one event. */
export const KILL_PULSE = 0.08;
/** Seconds each effect lasts. */
export const ROW_LIFE = 0.55;
export const BAND_LIFE = 0.14;
export const MELEE_LIFE = 0.22;
export const BURST_LIFE = 1.0;
export const FLASH_LIFE = 0.16;
export const RING_LIFE = 0.6;
/** Most chips per row event, melee flashes per event, and pieces in the final burst (near). */
export const ROW_CHIPS = 16;
/** Most flashes in a row's front. */
export const BAND_FLASHES = 8;
export const MELEE_FLASHES = 6;
export const FINAL_PIECES = 48;
/** Within this far (world units) in front of the next wall, effects stay low and fade fast. */
export const NEAR_GATE = 6;

const GRAVITY = 9;

export type KillKind = "row" | "melee" | "final";
const ROW = 0;
const MELEE = 1;
const FINAL = 2;

/**
 * Pieces an event of `count` kills gets at world z `z` (army at 0): fewer
 * beyond half the shape distance.
 */
export function killPieces(kind: KillKind, count: number, z: number): number {
  const base =
    kind === "row"
      ? Math.min(ROW_CHIPS, 3 + 2 * count)
      : kind === "melee"
        ? Math.min(MELEE_FLASHES, 2 + 2 * count)
        : FINAL_PIECES;
  return -z > (shapeDistance() * DIST_SCALE) / 2 ? Math.ceil(base / 2) : base;
}

/** Where the GPU horde reports its deaths (see createHorde). */
export type KillSink = {
  /** A figure in slot `slot` was killed at world x and recorded z (world z with the army at run distance 0); `melee`: it fell fighting at the army's front. */
  hit(slot: number, x: number, z: number, melee: boolean): void;
  /** The pack in slot `slot` lost its last enemy. */
  wiped(slot: number): void;
};

export type Kills = KillSink & {
  /** Draws the effects for the run as it is now (`clock`: the scene clock, still while paused). */
  update(run: RunState, clock: number): void;
  /** Counted since the run began: figures killed (and of them in the melee), packs wiped out, events spawned. */
  readonly stats: {
    killed: number;
    melee: number;
    wiped: number;
    events: number;
  };
  readonly pieces: InstancedMesh;
  readonly rings: InstancedMesh;
};

/** A hash of (a, b) in [0, 1). */
const hash = (a: number, b: number): number => {
  let h =
    Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^
    Math.imul(b + 0x632be5ab, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
};

const SLOTS = HORDE_SLOTS;

/** The kill effects; add `pieces` and `rings` to the scene. */
export function createKills(): Kills {
  const pieces = new InstancedMesh(
    new BoxGeometry(1, 1, 1),
    // bright at any distance: no haze on the effects
    new MeshBasicMaterial({ fog: false }),
    MAX_KILL_PIECES,
  );
  const ringGeo = new RingGeometry(0.82, 1, 48);
  ringGeo.rotateX(-Math.PI / 2);
  const rings = new InstancedMesh(
    ringGeo,
    new MeshBasicMaterial({
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      fog: false,
    }),
    MAX_KILL_RINGS,
  );
  for (const mesh of [pieces, rings]) {
    mesh.count = 0;
    mesh.frustumCulled = false;
    // allocate the colour buffer once
    mesh.setColorAt(0, FX_COLOURS.flash);
  }

  // the event pool
  const kind = new Uint8Array(MAX_KILL_EVENTS);
  const t0 = new Float64Array(MAX_KILL_EVENTS);
  const ex0 = new Float32Array(MAX_KILL_EVENTS);
  const ex1 = new Float32Array(MAX_KILL_EVENTS);
  const ez = new Float32Array(MAX_KILL_EVENTS);
  const en = new Uint16Array(MAX_KILL_EVENTS);
  const low = new Float32Array(MAX_KILL_EVENTS);
  const seed = new Uint32Array(MAX_KILL_EVENTS);
  const live = new Uint8Array(MAX_KILL_EVENTS);
  let head = 0;

  // per slot, kills gathered since its last event: [stream, melee]
  const pn = new Uint16Array(2 * SLOTS);
  const px0 = new Float32Array(2 * SLOTS);
  const px1 = new Float32Array(2 * SLOTS);
  const pz = new Float32Array(2 * SLOTS);
  const lastEmit = new Float64Array(SLOTS).fill(-Infinity);
  const wipe = new Uint8Array(SLOTS);
  // the slot's last kill (where the final burst goes)
  const lx = new Float32Array(SLOTS);
  const lz = new Float32Array(SLOTS);
  const lm = new Uint8Array(SLOTS);

  const stats = { killed: 0, melee: 0, wiped: 0, events: 0 };
  let track: RunState["track"] | null = null;

  const m = new Matrix4();
  const pos = new Vector3();
  const scl = new Vector3();
  const rot = new Euler();
  const q = new Quaternion();
  const col = new Color();
  const ORANGE = new Color(0xff8a3d);
  const ENEMY = new Color(0xe8456f);
  const RING = new Color(0xffb070);
  const SOLDIER_HIT = FX_COLOURS.enemyBullet;
  let np = 0;
  let nr = 0;

  const reset = (): void => {
    live.fill(0);
    pn.fill(0);
    wipe.fill(0);
    lastEmit.fill(-Infinity);
    head = 0;
    stats.killed = stats.melee = stats.wiped = stats.events = 0;
  };

  const spawn = (
    k: number,
    clock: number,
    x0: number,
    x1: number,
    z: number,
    n: number,
    near: number,
  ): void => {
    const e = head;
    head = (head + 1) % MAX_KILL_EVENTS;
    kind[e] = k;
    t0[e] = clock;
    ex0[e] = x0;
    ex1[e] = x1;
    ez[e] = z;
    en[e] = Math.min(65535, n);
    low[e] = near;
    seed[e] = stats.events++;
    live[e] = 1;
  };

  const piece = (
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    spin: number,
    c: Color,
  ): void => {
    if (np >= MAX_KILL_PIECES || sx <= 0 || sy <= 0 || sz <= 0) return;
    pos.set(x, y, z);
    scl.set(sx, sy, sz);
    rot.set(spin, spin * 1.3, 0);
    q.setFromEuler(rot);
    m.compose(pos, q, scl);
    pieces.setMatrixAt(np, m);
    pieces.setColorAt(np++, c);
  };

  return {
    pieces,
    rings,
    stats,
    hit(slot, x, z, melee) {
      const p = 2 * slot + (melee ? 1 : 0);
      if (pn[p] === 0) {
        px0[p] = px1[p] = x;
        pz[p] = z;
      } else {
        px0[p] = Math.min(px0[p] as number, x);
        px1[p] = Math.max(px1[p] as number, x);
        // the row's front: nearest the army
        pz[p] = Math.max(pz[p] as number, z);
      }
      pn[p] = Math.min(65535, (pn[p] as number) + 1);
      lx[slot] = x;
      lz[slot] = z;
      lm[slot] = melee ? 1 : 0;
      stats.killed++;
      if (melee) stats.melee++;
    },
    wiped(slot) {
      wipe[slot] = 1;
      stats.wiped++;
    },
    update(run, clock) {
      if (run.track !== track) {
        track = run.track;
        reset();
      }
      const scroll = run.dist * DIST_SCALE;
      const front = -crowdHalfDepth(run.army) * DIST_SCALE;
      // the next wall's world z (labels on it stay readable)
      const qpos = run.track.questions[run.next];
      const gateZ = qpos === undefined ? -Infinity : worldZ(qpos, run.dist);
      const nearGate = (z: number): number => {
        const d = z - gateZ;
        return d < -1 || d > NEAR_GATE ? 0 : 1 - Math.max(0, d) / NEAR_GATE;
      };
      for (let s = 0; s < SLOTS; s++) {
        const due = clock - (lastEmit[s] as number) >= KILL_PULSE || wipe[s];
        if (!due) continue;
        let any = false;
        for (let h = 0; h < 2; h++) {
          const p = 2 * s + h;
          const n = pn[p] as number;
          if (n === 0) continue;
          const z = h ? front : (pz[p] as number) + scroll;
          spawn(
            h ? MELEE : ROW,
            clock,
            px0[p] as number,
            px1[p] as number,
            h ? front - scroll : (pz[p] as number),
            n,
            nearGate(z),
          );
          pn[p] = 0;
          any = true;
        }
        if (any) lastEmit[s] = clock;
        if (wipe[s]) {
          const z = lm[s] ? front - scroll : (lz[s] as number);
          spawn(
            FINAL,
            clock,
            lx[s] as number,
            lx[s] as number,
            z,
            1,
            nearGate(z + scroll),
          );
          wipe[s] = 0;
        }
      }

      np = 0;
      nr = 0;
      for (let e = 0; e < MAX_KILL_EVENTS; e++) {
        if (!live[e]) continue;
        const age = clock - (t0[e] as number);
        const k = kind[e] as number;
        const near = low[e] as number;
        // near a wall: lower, and gone sooner
        const hs = 1 - 0.7 * near;
        const ls = 1 - 0.5 * near;
        const life =
          (k === ROW ? ROW_LIFE : k === MELEE ? MELEE_LIFE : BURST_LIFE) * ls;
        if (age < 0 || age >= life) {
          live[e] = 0;
          continue;
        }
        const sd = seed[e] as number;
        const x0 = ex0[e] as number;
        const x1 = ex1[e] as number;
        // melee events stand on the army's front as it is now
        const z = k === MELEE ? front : (ez[e] as number) + scroll;
        const n = killPieces(
          k === ROW ? "row" : k === MELEE ? "melee" : "final",
          en[e] as number,
          z,
        );
        if (k === ROW) {
          // a front of flashes across the row where the fire lands
          if (age < BAND_LIFE * ls) {
            const u = age / (BAND_LIFE * ls);
            const w = x1 - x0 + 0.3;
            const nf = Math.min(BAND_FLASHES, 2 + Math.floor(w / 0.3));
            for (let j = 0; j < nf; j++) {
              const v1 = hash(sd, 1000 + 2 * j);
              const v2 = hash(sd, 1001 + 2 * j);
              col.lerpColors(FX_COLOURS.bullet, ORANGE, v2 < 0.3 ? 0 : u);
              const size = (0.14 + 0.16 * v2) * (1 - u * u) * hs + 0.04;
              piece(
                x0 - 0.15 + ((j + 0.5 * v1) / nf) * w,
                (0.3 + 0.35 * v1) * hs,
                z - 0.1,
                size,
                size,
                size,
                v1 * 3,
                col,
              );
            }
          }
          // chips flung back (away from the army) and up
          for (let j = 0; j < n; j++) {
            const u1 = hash(sd, 5 * j);
            const u2 = hash(sd, 5 * j + 1);
            const u3 = hash(sd, 5 * j + 2);
            const u4 = hash(sd, 5 * j + 3);
            const u5 = hash(sd, 5 * j + 4);
            const lj = life * (0.6 + 0.4 * u5);
            if (age >= lj) continue;
            const y =
              0.25 +
              0.4 * u2 +
              (2.2 + 2.6 * u3) * hs * age -
              0.5 * GRAVITY * age * age;
            const size = (0.09 + 0.11 * u2) * (1 - age / lj) + 0.02;
            piece(
              x0 + u1 * (x1 - x0) + (u5 - 0.5) * 2.2 * age,
              Math.max(0.03, y),
              z - (1 + 2.5 * u4) * age,
              size,
              size,
              size,
              age * (6 + 8 * u3),
              j % 3 === 0
                ? ENEMY
                : j % 3 === 1
                  ? FX_COLOURS.bullet
                  : FX_COLOURS.flash,
            );
          }
        } else if (k === MELEE) {
          // hit flashes on both fronts: white on the enemy, pink on the soldiers
          const u = age / life;
          for (let j = 0; j < n; j++) {
            const u1 = hash(sd, 3 * j);
            const u2 = hash(sd, 3 * j + 1);
            const army = j % 2 === 1;
            const size =
              (army ? 0.18 : 0.26) *
              Math.sin(Math.PI * u) *
              (0.7 + 0.6 * u2) *
              hs;
            piece(
              x0 + u1 * (x1 - x0),
              (0.3 + 0.3 * u2) * hs,
              army ? front + 0.15 : front - 0.25,
              size,
              size,
              size,
              u1 * 3,
              army ? SOLDIER_HIT : FX_COLOURS.flash,
            );
          }
        } else {
          // the final burst: a white flash, pieces flung all round, a shockwave on the ground
          const fl = FLASH_LIFE * ls;
          if (age < fl) {
            const u = 1 - age / fl;
            const size = 1.4 * u * u * hs + 0.1;
            piece(x0, 0.5 * hs, z, size, size, size, age * 4, FX_COLOURS.flash);
          }
          for (let j = 0; j < n; j++) {
            const u1 = hash(sd, 4 * j);
            const u2 = hash(sd, 4 * j + 1);
            const u3 = hash(sd, 4 * j + 2);
            const u4 = hash(sd, 4 * j + 3);
            const lj = life * (0.55 + 0.45 * u4);
            if (age >= lj) continue;
            const a = j * 2.39996 + sd;
            const r = (2.5 + 4 * u1) * age;
            const y = 0.4 + (3 + 4 * u2) * hs * age - 0.5 * GRAVITY * age * age;
            const size = (0.1 + 0.11 * u3) * (1 - age / lj) + 0.02;
            piece(
              x0 + r * Math.cos(a),
              Math.max(0.04, y),
              z + r * (0.7 * Math.sin(a) - 0.45),
              size,
              size,
              size,
              age * (5 + 9 * u1),
              j % 4 === 0
                ? ENEMY
                : j % 4 === 1
                  ? FX_COLOURS.bullet
                  : j % 4 === 2
                    ? ORANGE
                    : FX_COLOURS.flash,
            );
          }
          const rl = RING_LIFE * ls;
          if (age < rl && nr < MAX_KILL_RINGS) {
            const u = age / rl;
            const r = 0.3 + 4.2 * (1 - (1 - u) * (1 - u));
            pos.set(x0, 0.04, z);
            scl.set(r, 1, r);
            q.identity();
            m.compose(pos, q, scl);
            rings.setMatrixAt(nr, m);
            col.copy(RING).multiplyScalar((1 - u) * (1 - u));
            rings.setColorAt(nr++, col);
          }
        }
      }
      pieces.count = np;
      rings.count = nr;
      for (const mesh of [pieces, rings]) {
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
    },
  };
}
