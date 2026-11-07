import { crowdWidth } from "../core/crowd";
import {
  gateOpenings,
  hazardPos,
  isShattered,
  packSpan,
  packSurvivors,
  type RunState,
} from "../core/sim";
import { hazardSpan } from "../core/track";
import { SAW_W, VIEW_DISTANCE } from "../core/tuning";
import type { Scene } from "./scenes";

const FONT = `"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic", system-ui, sans-serif`;
const MAX_DRAWN_SOLDIERS = 200;
/** How long (in track distance) a clip-loss pop-up stays up. */
const CLIP_POPUP_DIST = 0.8;
/** How long (in track distance) answer feedback stays up. */
const ANSWER_FEEDBACK_DIST = 1.0;
/** How long (in track distance) a shatter burst lasts. */
const SHATTER_DIST = 0.6;
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
  hazardEdge: "#ff8a7a",
  goodFill: "rgba(95, 211, 141, 0.35)",
  bullet: "#fff3b0",
  damaged: "#6e2a2a",
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
      ctx.fillStyle = COLORS.hazard;
      ctx.fillRect(h.left * w, y - blockH, bw, blockH);
      // damage eats the block from the top down
      if (hp > 0 && dmg > 0) {
        ctx.fillStyle = COLORS.damaged;
        ctx.fillRect(h.left * w, y - blockH, bw, blockH * (dmg / hp));
      }
      ctx.fillStyle = COLORS.hazardEdge;
      ctx.fillRect(h.left * w, y - 3, bw, 3);
      // a hit block flashes
      if (run.target === i && Math.floor(run.dist * 40) % 2 === 0) {
        ctx.fillStyle = "rgba(255,255,255,0.25)";
        ctx.fillRect(h.left * w, y - blockH, bw, blockH);
      }
      if (hp > 0)
        text(
          ctx,
          String(Math.ceil(hp - dmg)),
          ((h.left + h.right) / 2) * w,
          y - blockH / 2,
          18 * scale,
        );
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

  // visible walls, far ones first
  for (let i = run.rows.length - 1; i >= 0; i--) {
    const ahead = (questions[i] ?? Infinity) - run.dist;
    if (ahead < -behind) break;
    if (ahead > farthest) continue;
    const row = run.rows[i];
    if (!row) continue;
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

  const radius = (crowdWidth(run.army) * w) / 2;
  renderFire(ctx, w, run, armyY, radius, depthY);
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

/** A bullet stream from the crowd to its target, and a burst where a block shattered. */
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
  if (i !== null && (target?.kind === "block" || target?.kind === "pack")) {
    const cw = crowdWidth(run.army);
    const span = target.kind === "block" ? target : packSpan(run, i);
    // aim at the middle of where the crowd and the target overlap
    const left = Math.max(span.left, run.x - cw / 2);
    const right = Math.min(span.right, run.x + cw / 2);
    const tx = ((left + right) / 2) * w;
    const ty = depthY(hazardPos(run, i) - run.dist) - 6;
    const lanes = Math.min(5, 1 + Math.floor(Math.sqrt(run.army) / 3));
    ctx.fillStyle = COLORS.bullet;
    for (let l = 0; l < lanes; l++) {
      const sx = run.x * w + (lanes > 1 ? l / (lanes - 1) - 0.5 : 0) * radius;
      const sy = armyY - radius * 0.4;
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
      ctx.fillStyle = dead.kind === "block" ? COLORS.hazardEdge : COLORS.enemy;
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
