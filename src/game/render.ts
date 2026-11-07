import { crowdWidth } from "../core/crowd";
import {
  crateReward,
  fireLimit,
  gateOpenings,
  hazardPos,
  isShattered,
  packSpan,
  packSurvivors,
  viewOf,
  type ChargeView,
  type RunState,
} from "../core/sim";
import { hazardSpan, isCharge } from "../core/track";
import {
  CHARGE_LINE_DISTANCE,
  FIRE_RANGE,
  SAW_W,
  VIEW_DISTANCE,
} from "../core/tuning";
import type { Scene } from "./scenes";

const FONT = `"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic", system-ui, sans-serif`;
const MAX_DRAWN_SOLDIERS = 200;
/** How long (in track distance) a clip-loss pop-up stays up. */
const CLIP_POPUP_DIST = 0.8;
/** How long (in track distance) answer feedback stays up. */
const ANSWER_FEEDBACK_DIST = 1.0;
/** How long (in track distance) a shatter burst lasts. */
const SHATTER_DIST = 0.6;
/** How long (in track distance) a crate's "+N" and its recruits running in last. */
const CRATE_POPUP_DIST = 0.8;
/** Fraction of the charge (line to contact) both sides fire before the chosen squad's outcome shows. */
const CHARGE_REVEAL = 0.35;
const COLORS = {
  bg: "#111",
  track: "#1d2230",
  wall: "#5a6478",
  wallEdge: "#8892a8",
  opening: "rgba(90, 140, 255, 0.18)",
  text: "#f2f2f2",
  dim: "#9aa3b5",
  soldier: "#ffcf4a",
  enemy: "#e0457b",
  good: "#5fd38d",
  bad: "#ff6b6b",
  hazard: "#c24b4b",
  crate: "#9a6b3a",
  crateEdge: "#d9a865",
  crateDark: "#4a3220",
  hazardEdge: "#ff8a7a",
  goodFill: "rgba(95, 211, 141, 0.35)",
  chargeLine: "#ffb347",
  banner: "rgba(20, 24, 36, 0.85)",
  enemyBullet: "#ff9bbd",
  bullet: "#fff3b0",
  badFill: "rgba(255, 107, 107, 0.35)",
};

type Ctx = CanvasRenderingContext2D;

function text(
  ctx: Ctx,
  s: string,
  x: number,
  y: number,
  size: number,
  color = COLORS.text,
): void {
  ctx.font = `${Math.round(size)}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(s, x, y);
}

export function render(ctx: Ctx, w: number, h: number, scene: Scene): void {
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, w, h);
  if (scene.kind === "start") return renderStart(ctx, w, h);
  if (scene.kind === "end") return renderEnd(ctx, w, h, scene.run, scene.seed);
  renderRun(ctx, w, h, scene.run);
  if (scene.paused) {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, w, h);
    text(ctx, "Paused", w / 2, h / 2 - 20, 40);
    text(ctx, "Tap or P to resume", w / 2, h / 2 + 24, 20, COLORS.dim);
    text(ctx, `build ${__BUILD__}`, w / 2, h - 24, 14, COLORS.dim);
  }
}

function renderStart(ctx: Ctx, w: number, h: number): void {
  text(ctx, "Kanji Runner", w / 2, h * 0.35, Math.min(64, w / 8));
  text(ctx, "Tap or Enter to start", w / 2, h * 0.5, 22);
  text(
    ctx,
    "Drag or ←/→ steer · tap or P pause",
    w / 2,
    h * 0.5 + 36,
    18,
    COLORS.dim,
  );
}

function renderEnd(
  ctx: Ctx,
  w: number,
  h: number,
  run: RunState,
  seed: number,
): void {
  const correct = run.results.filter(Boolean).length;
  const accuracy = run.results.length
    ? Math.round((correct / run.results.length) * 100)
    : 0;
  const won = run.status === "finished";
  text(
    ctx,
    won ? "Run complete" : "Army wiped out",
    w / 2,
    h * 0.3,
    Math.min(48, w / 9),
    won ? COLORS.good : COLORS.bad,
  );
  text(ctx, `Army ${run.army}`, w / 2, h * 0.42, 28);
  text(
    ctx,
    `Accuracy ${accuracy}% (${correct}/${run.results.length})`,
    w / 2,
    h * 0.42 + 40,
    22,
  );
  text(ctx, `Seed ${seed}`, w / 2, h * 0.42 + 76, 18, COLORS.dim);
  text(ctx, "Tap or Enter to play again", w / 2, h * 0.7, 20);
}

function renderRun(ctx: Ctx, w: number, h: number, run: RunState): void {
  // where VIEW_DISTANCE lands; the track carries on above it to the top edge
  const horizonY = h * 0.22;
  const armyY = h * 0.82;
  const depthY = (ahead: number): number =>
    armyY - (armyY - horizonY) * (ahead / VIEW_DISTANCE);
  // passed rows and hazards keep scrolling until they leave the bottom edge
  const behind = ((h - armyY) / (armyY - horizonY)) * VIEW_DISTANCE + 0.3;

  ctx.fillStyle = COLORS.track;
  ctx.fillRect(0, 0, w, h);
  // rows and hazards come into view at the top edge (plus room for a wall's height)
  const farthest = (VIEW_DISTANCE * (armyY + 80)) / (armyY - horizonY);

  // visible hazards, far ones first
  const { hazards, questions } = run.track;
  for (let i = hazards.length - 1; i >= 0; i--) {
    const h = hazards[i];
    if (!h) continue;
    const ahead = hazardPos(run, i) - run.dist;
    if (ahead < -behind) break;
    if (ahead > farthest) continue;
    const y = depthY(ahead);
    const scale = Math.max(0.3, 1 - 0.5 * (ahead / VIEW_DISTANCE));
    if (h.kind === "pack") {
      // gone once it has met the crowd or been shot to nothing
      if (i < run.nextHazard || isShattered(run, i)) continue;
      const span = packSpan(run, i);
      const cx = ((span.left + span.right) / 2) * w;
      const r = (((span.right - span.left) * w) / 2) * scale;
      renderArmy(ctx, cx, y, r, packSurvivors(run, i), COLORS.enemy, scale);
      if (run.target === i) renderKills(ctx, cx, y, r, run.dist);
    } else if (h.kind === "block") {
      if (isShattered(run, i)) continue;
      const blockH = 34 * scale;
      const bw = (h.right - h.left) * w;
      const hp = run.hp[i] ?? 0;
      const dmg = run.damage[i] ?? 0;
      renderCrate(ctx, h.left * w, y - blockH, bw, blockH);
      // damage eats the crate from the top down
      if (hp > 0 && dmg > 0) {
        ctx.fillStyle = COLORS.crateDark;
        ctx.fillRect(h.left * w, y - blockH, bw, blockH * (dmg / hp));
      }
      // a hit block flashes
      if (run.target === i && Math.floor(run.dist * 40) % 2 === 0) {
        ctx.fillStyle = "rgba(255,255,255,0.25)";
        ctx.fillRect(h.left * w, y - blockH, bw, blockH);
      }
      if (hp > 0) {
        // hit points on the crate, the recruits it pays just above it
        // (floors keep far crates readable on a phone)
        const cx = ((h.left + h.right) / 2) * w;
        outlinedText(
          ctx,
          String(Math.ceil(hp - dmg)),
          cx,
          y - blockH / 2,
          Math.max(12, 18 * scale),
        );
        const rewardSize = Math.max(12, 17 * scale);
        outlinedText(
          ctx,
          `+${crateReward(hp)}`,
          cx,
          y - blockH - rewardSize * 0.65,
          rewardSize,
          COLORS.good,
        );
      }
    } else {
      // its sweep rail, then the saw where it is now
      const { left, right } = hazardSpan(h, run.dist);
      ctx.fillStyle = COLORS.hazard;
      ctx.globalAlpha = 0.35;
      ctx.fillRect(
        (h.mid - h.amp - SAW_W / 2) * w,
        y - 2,
        (2 * h.amp + SAW_W) * w,
        4,
      );
      ctx.globalAlpha = 1;
      renderSaw(
        ctx,
        ((left + right) / 2) * w,
        y - 14 * scale,
        ((right - left) * w) / 2,
        run.dist,
      );
    }
  }

  // fire goes under the walls, so it never covers a prompt or an answer label
  const radius = (crowdWidth(run.army) * w) / 2;
  // squads are drawn only from the view model, never from the rows
  const view = viewOf(run);
  const active = view.charges.find((c) => c.locked);
  if (active) renderFirefight(ctx, w, run, active, armyY, radius, depthY);
  else renderFire(ctx, w, run, armyY, radius, depthY);

  // visible walls, far ones first
  for (let i = run.rows.length - 1; i >= 0; i--) {
    const ahead = (questions[i] ?? Infinity) - run.dist;
    if (ahead < -behind) break;
    if (ahead > farthest) continue;
    const row = run.rows[i];
    if (!row || isCharge(run.track, i)) continue;
    const y = depthY(ahead);
    const scale = Math.max(0.3, 1 - 0.5 * (ahead / VIEW_DISTANCE));
    const wallH = 56 * scale;
    const openings = gateOpenings(row.options.length);
    // solid wall across the track, then openings cut into it
    ctx.fillStyle = COLORS.wall;
    ctx.fillRect(0, y - wallH, w, wallH);
    ctx.fillStyle = COLORS.wallEdge;
    ctx.fillRect(0, y - 3, w, 3);
    openings.forEach((o, j) => {
      const left = o.left * w;
      const width = (o.right - o.left) * w;
      ctx.fillStyle = COLORS.track;
      ctx.fillRect(left, y - wallH, width, wallH);
      // the chosen opening of an answered wall turns green or red
      const answered = i === run.next - 1 ? run.lastAnswer : null;
      ctx.fillStyle =
        answered?.choice === j
          ? answered.correct
            ? COLORS.goodFill
            : COLORS.badFill
          : COLORS.opening;
      ctx.fillRect(left, y - wallH, width, wallH);
      text(ctx, row.options[j] ?? "", o.centre * w, y - wallH / 2, 30 * scale);
    });
    text(ctx, row.prompt, w / 2, y - wallH - 30 * scale, 44 * scale);
  }

  for (const c of view.charges) {
    if (c.line - run.dist < -behind || c.line - run.dist > farthest) continue;
    renderCharge(ctx, w, run, c, armyY, depthY);
  }

  renderCrateRecruits(ctx, w, run, armyY, radius, depthY);
  renderArmy(ctx, run.x * w, armyY, radius, run.army);
  if (run.lastClip) {
    const t = (run.dist - run.lastClip.dist) / CLIP_POPUP_DIST;
    if (t < 1) {
      ctx.globalAlpha = 1 - t;
      text(
        ctx,
        `−${run.lastClip.loss}`,
        run.x * w,
        armyY - radius * 0.6 - 24 - 30 * t,
        26,
        COLORS.bad,
      );
      ctx.globalAlpha = 1;
    }
  }

  if (run.lastAnswer) {
    const a = run.lastAnswer;
    const t = (run.dist - a.dist) / ANSWER_FEEDBACK_DIST;
    if (t < 1) {
      const color = a.correct ? COLORS.good : COLORS.bad;
      // a faint ring that swells and fades, plus the army change
      ctx.globalAlpha = 0.5 * (1 - t);
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(run.x * w, armyY, radius + 8 + 24 * t, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1 - t;
      const sign = a.change >= 0 ? "+" : "−";
      text(
        ctx,
        `${sign}${Math.abs(a.change)}`,
        run.x * w + radius + 28,
        armyY - 10 - 24 * t,
        24,
        color,
      );
      ctx.globalAlpha = 1;
    }
  }

  // HUD
  text(
    ctx,
    `${Math.min(run.next + 1, run.rows.length)}/${run.rows.length}`,
    40,
    24,
    16,
    COLORS.dim,
  );
  if (run.streak > 0)
    text(ctx, `streak ${run.streak}`, w - 60, 24, 16, COLORS.good);
}

/** Enemies popping off a pack under fire: dots flung outwards that fade. */
function renderKills(
  ctx: Ctx,
  cx: number,
  cy: number,
  r: number,
  dist: number,
): void {
  ctx.fillStyle = COLORS.enemy;
  for (let k = 0; k < 4; k++) {
    const t = (dist * 2.5 + k / 4) % 1;
    const a = k * 2.39996 + Math.floor(dist * 2.5) * 1.3;
    ctx.globalAlpha = 1 - t;
    ctx.beginPath();
    ctx.arc(
      cx + (r + 18 * t) * Math.cos(a),
      cy + (r + 18 * t) * Math.sin(a) * 0.6 - 10 * t,
      3,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/**
 * A constant bullet stream: to the target when there is one, otherwise
 * straight ahead, fading out where FIRE_RANGE ends. Plus a burst where a
 * crate or pack died.
 */
function renderFire(
  ctx: Ctx,
  w: number,
  run: RunState,
  armyY: number,
  radius: number,
  depthY: (ahead: number) => number,
): void {
  const i = run.target;
  const target = i === null ? undefined : run.track.hazards[i];
  const lanes = Math.min(5, 1 + Math.floor(Math.sqrt(run.army) / 3));
  const laneX = (l: number): number =>
    run.x * w + (lanes > 1 ? l / (lanes - 1) - 0.5 : 0) * radius;
  const sy = armyY - radius * 0.4;
  if (i === null || !(target?.kind === "block" || target?.kind === "pack")) {
    const ey = depthY(FIRE_RANGE);
    // bullets stop at the next wall or charge line, so they never reach a prompt or a squad
    const wallY = depthY(fireLimit(run) - run.dist);
    ctx.fillStyle = COLORS.bullet;
    for (let l = 0; l < lanes; l++) {
      for (let k = 0; k < 8; k++) {
        const t = (k / 8 + run.dist * 2 + l * 0.37) % 1;
        if (sy + (ey - sy) * t < wallY) continue;
        // full strength for most of the way, then fade to nothing at the range end
        ctx.globalAlpha = Math.min(1, (1 - t) / 0.35);
        ctx.beginPath();
        ctx.arc(laneX(l), sy + (ey - sy) * t, 2.5 - t, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  } else {
    const cw = crowdWidth(run.army);
    const span = target.kind === "block" ? target : packSpan(run, i);
    // aim at the middle of where the crowd and the target overlap
    const left = Math.max(span.left, run.x - cw / 2);
    const right = Math.min(span.right, run.x + cw / 2);
    const tx = ((left + right) / 2) * w;
    const ty = depthY(hazardPos(run, i) - run.dist) - 6;
    ctx.fillStyle = COLORS.bullet;
    for (let l = 0; l < lanes; l++) {
      const sx = laneX(l);
      for (let k = 0; k < 6; k++) {
        const t = (k / 6 + run.dist * 3 + l * 0.37) % 1;
        ctx.beginPath();
        ctx.arc(sx + (tx - sx) * t, sy + (ty - sy) * t, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // hit flash at the impact point
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(run.dist * 80);
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(tx, ty, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  const sh = run.lastShatter;
  const dead = sh ? run.track.hazards[sh.index] : undefined;
  if (sh && (dead?.kind === "block" || dead?.kind === "pack")) {
    const t = (run.dist - sh.dist) / SHATTER_DIST;
    if (t >= 0 && t < 1) {
      // a pack bursts from its centre; a block from its middle
      const span =
        dead.kind === "block"
          ? dead
          : {
              left: run.packs[sh.index]?.x ?? 0.5,
              right: run.packs[sh.index]?.x ?? 0.5,
            };
      const cx = ((span.left + span.right) / 2) * w;
      const cy =
        depthY(hazardPos(run, sh.index) - run.dist) -
        (dead.kind === "block" ? 17 : 0);
      const spread = ((span.right - span.left) * w) / 2 + 40 * t;
      ctx.globalAlpha = 1 - t;
      ctx.fillStyle = dead.kind === "block" ? COLORS.crateEdge : COLORS.enemy;
      for (let k = 0; k < 14; k++) {
        const a = k * 2.39996 + sh.index;
        const r = spread * (0.4 + (0.6 * ((k * 7) % 5)) / 4);
        const size = 6 * (1 - t) + 2;
        ctx.fillRect(
          cx + r * Math.cos(a) - size / 2,
          cy + r * Math.sin(a) * 0.6 - size / 2,
          size,
          size,
        );
      }
      ctx.globalAlpha = 1;
    }
  }
}

/** How far through a locked charge the army is: 0 at the line, 1 at contact. */
function chargeProgress(run: RunState, c: ChargeView): number {
  const t = (run.dist - (c.lockDist ?? run.dist)) / CHARGE_LINE_DISTANCE;
  return Math.min(1, Math.max(0, t));
}

/**
 * A charge: the line, then identical squads under their answer banners, and
 * the prompt above them. After the lock the chosen squad is outlined; once the
 * firefight shows its outcome, a joining squad turns friendly and runs in.
 */
function renderCharge(
  ctx: Ctx,
  w: number,
  run: RunState,
  c: ChargeView,
  armyY: number,
  depthY: (ahead: number) => number,
): void {
  // the charge line: dashed until it locks, then solid
  const ly = depthY(c.line - run.dist);
  const committed = c.locked || c.resolved;
  ctx.strokeStyle = COLORS.chargeLine;
  ctx.globalAlpha = committed ? 1 : 0.8;
  ctx.lineWidth = committed ? 4 : 3;
  ctx.setLineDash(committed ? [] : [14, 10]);
  ctx.beginPath();
  ctx.moveTo(0, ly);
  ctx.lineTo(w, ly);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  if (c.locked) {
    const pulse = 0.75 + 0.25 * Math.sin(run.dist * 20);
    ctx.globalAlpha = pulse;
    text(ctx, "LOCKED", w / 2, armyY + 58, 16, COLORS.chargeLine);
    ctx.globalAlpha = 1;
  }
  if (c.resolved) return;

  const ahead = c.pos - run.dist;
  const y = depthY(ahead);
  const scale = Math.max(0.3, 1 - 0.5 * (ahead / VIEW_DISTANCE));
  const t = chargeProgress(run, c);
  const shown = c.locked && t >= CHARGE_REVEAL;
  const bannerH = 40 * scale;
  const bannerY = y - 44 * scale - bannerH;
  c.squads.forEach((q) => {
    const r = (crowdWidth(q.count) * w * scale) / 2;
    let cx = q.x * w;
    let color = COLORS.enemy;
    if (shown && q.outcome === "join") {
      // the defectors turn friendly and run for the army
      const u = (t - CHARGE_REVEAL) / (1 - CHARGE_REVEAL);
      color = COLORS.soldier;
      cx += (run.x * w - cx) * 0.6 * u;
    }
    renderArmy(ctx, cx, y, r, q.count, color, scale);
    // answer banner, outlined once chosen
    const bw = Math.max(60 * scale, r * 2 + 16 * scale);
    ctx.fillStyle = COLORS.banner;
    ctx.fillRect(q.x * w - bw / 2, bannerY, bw, bannerH);
    if (q.chosen) {
      ctx.strokeStyle = COLORS.chargeLine;
      ctx.lineWidth = 3;
      ctx.strokeRect(q.x * w - bw / 2, bannerY, bw, bannerH);
    }
    text(ctx, q.label, q.x * w, bannerY + bannerH / 2, 30 * scale);
  });
  text(ctx, c.prompt, w / 2, bannerY - 30 * scale, 44 * scale);
}

/**
 * The firefight after a lock: both sides fire at first; then a joining squad
 * stops (and the army with it), while a fighting squad keeps firing back.
 */
function renderFirefight(
  ctx: Ctx,
  w: number,
  run: RunState,
  c: ChargeView,
  armyY: number,
  radius: number,
  depthY: (ahead: number) => number,
): void {
  const q = c.squads.find((s) => s.chosen);
  if (!q) return;
  const t = chargeProgress(run, c);
  const fighting = t < CHARGE_REVEAL || q.outcome === "fight";
  if (!fighting) return;
  const sx = run.x * w;
  const sy = armyY - radius * 0.4;
  const tx = q.x * w;
  const ty = depthY(c.pos - run.dist);
  const lanes = Math.min(5, 1 + Math.floor(Math.sqrt(run.army) / 3));
  ctx.fillStyle = COLORS.bullet;
  for (let l = 0; l < lanes; l++) {
    const ox = (lanes > 1 ? l / (lanes - 1) - 0.5 : 0) * radius;
    for (let k = 0; k < 6; k++) {
      const u = (k / 6 + run.dist * 3 + l * 0.37) % 1;
      ctx.beginPath();
      ctx.arc(sx + ox + (tx - sx - ox) * u, sy + (ty - sy) * u, 2.5, 0, 7);
      ctx.fill();
    }
  }
  // return fire from the squad
  ctx.fillStyle = COLORS.enemyBullet;
  const back = t < CHARGE_REVEAL ? 2 : 4;
  for (let l = 0; l < back; l++) {
    const ox = (back > 1 ? l / (back - 1) - 0.5 : 0) * 16;
    for (let k = 0; k < 5; k++) {
      const u = (k / 5 + run.dist * 2.6 + l * 0.29) % 1;
      ctx.beginPath();
      ctx.arc(tx + ox + (sx - tx - ox) * u, ty + (sy - ty) * u, 2.5, 0, 7);
      ctx.fill();
    }
  }
}

/** A crate's last position on screen when it shattered. */
function crateScreenPos(
  w: number,
  run: RunState,
  depthY: (ahead: number) => number,
): { x: number; y: number } | null {
  const sh = run.lastShatter;
  const h = sh ? run.track.hazards[sh.index] : undefined;
  if (!sh || h?.kind !== "block") return null;
  return {
    x: ((h.left + h.right) / 2) * w,
    y: depthY(h.pos - sh.dist) - 17,
  };
}

/** After a crate pays out: recruits running from it into the army, and a "+N". */
function renderCrateRecruits(
  ctx: Ctx,
  w: number,
  run: RunState,
  armyY: number,
  radius: number,
  depthY: (ahead: number) => number,
): void {
  const c = run.lastCrate;
  if (!c) return;
  const t = (run.dist - c.dist) / CRATE_POPUP_DIST;
  if (t < 0 || t >= 1) return;
  const from = crateScreenPos(w, run, depthY);
  if (from && run.lastShatter?.dist === c.dist) {
    ctx.fillStyle = COLORS.soldier;
    const n = Math.min(12, c.gain);
    for (let k = 0; k < n; k++) {
      // staggered: each recruit sets off a little later and lands in the crowd
      const u = Math.min(1, Math.max(0, (t * 1.6 - k / (n * 2)) / 0.8));
      if (u >= 1) continue;
      const jx = run.x * w + radius * 0.5 * Math.cos(k * 2.39996);
      const jy = armyY + radius * 0.3 * Math.sin(k * 2.39996);
      ctx.beginPath();
      ctx.arc(
        from.x + (jx - from.x) * u + 6 * Math.cos(k * 2.39996) * (1 - u),
        from.y + (jy - from.y) * u,
        3,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1 - t;
  text(
    ctx,
    `+${c.gain}`,
    run.x * w - radius - 28,
    armyY - 10 - 24 * t,
    24,
    COLORS.good,
  );
  ctx.globalAlpha = 1;
}

/** A wooden supply crate: planks, a frame and a cross brace. */
function renderCrate(
  ctx: Ctx,
  x: number,
  y: number,
  bw: number,
  bh: number,
): void {
  ctx.fillStyle = COLORS.crate;
  ctx.fillRect(x, y, bw, bh);
  ctx.strokeStyle = COLORS.crateDark;
  ctx.lineWidth = 1;
  // plank seams
  ctx.beginPath();
  for (let k = 1; k < 3; k++) {
    ctx.moveTo(x, y + (bh * k) / 3);
    ctx.lineTo(x + bw, y + (bh * k) / 3);
  }
  ctx.stroke();
  // frame and braces, one cross per square-ish panel
  ctx.strokeStyle = COLORS.crateEdge;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, bw - 2, bh - 2);
  const panels = Math.max(1, Math.round(bw / (bh * 1.6)));
  ctx.beginPath();
  for (let p = 0; p < panels; p++) {
    const px = x + (bw * p) / panels;
    const pw = bw / panels;
    if (p > 0) {
      ctx.moveTo(px, y);
      ctx.lineTo(px, y + bh);
    }
    ctx.moveTo(px, y + bh);
    ctx.lineTo(px + pw, y);
  }
  ctx.stroke();
}

/** Text with a dark outline, readable over busy art. */
function outlinedText(
  ctx: Ctx,
  s: string,
  x: number,
  y: number,
  size: number,
  color = COLORS.text,
): void {
  ctx.font = `${Math.round(size)}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.strokeStyle = COLORS.crateDark;
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  ctx.strokeText(s, x, y);
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}

/** A blob of up to 200 dots filling a squashed disc of the crowd's width. */
function renderArmy(
  ctx: Ctx,
  cx: number,
  cy: number,
  radius: number,
  army: number,
  color = COLORS.soldier,
  scale = 1,
): void {
  const n = Math.min(army, MAX_DRAWN_SOLDIERS);
  // dot size shrinks as the blob fills up, within readable limits
  const r = Math.max(2, Math.min(5, radius / Math.sqrt(Math.max(n, 1)) / 1.1));
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let k = 0; k < n; k++) {
    // sunflower packing scaled to the crowd radius, squashed for a top-down-ish look
    const dist = (radius - r) * Math.sqrt((k + 0.5) / n);
    const angle = k * 2.39996;
    const x = cx + dist * Math.cos(angle);
    const y = cy + dist * Math.sin(angle) * 0.6;
    ctx.moveTo(x + r, y);
    ctx.arc(x, y, r, 0, Math.PI * 2);
  }
  ctx.fill();
  text(ctx, String(army), cx, cy + radius * 0.6 + 22 * scale, 22 * scale);
}

/** A spinning toothed disc of radius r. */
function renderSaw(
  ctx: Ctx,
  cx: number,
  cy: number,
  r: number,
  spin: number,
): void {
  const teeth = 10;
  ctx.fillStyle = COLORS.hazardEdge;
  ctx.beginPath();
  for (let k = 0; k < teeth * 2; k++) {
    const a = spin * 6 + (k * Math.PI) / teeth;
    const rr = k % 2 ? r * 0.75 : r;
    const x = cx + rr * Math.cos(a);
    const y = cy + rr * Math.sin(a);
    if (k === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = COLORS.hazard;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.3, 0, Math.PI * 2);
  ctx.fill();
}
