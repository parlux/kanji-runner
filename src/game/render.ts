import { crowdWidth } from "../core/crowd";
import {
  crateReward,
  fireLimit,
  rowOpenings,
  hazardPos,
  isShattered,
  packSpan,
  packSurvivors,
  viewOf,
  type ChargeView,
  type RunState,
} from "../core/sim";
import { hazardSpan, isCharge } from "../core/track";
import { FIRE_RANGE, SAW_W, VIEW_DISTANCE } from "../core/tuning";
import type { Scene } from "./scenes";

const FONT = `"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic", system-ui, sans-serif`;
const MAX_DRAWN_SOLDIERS = 200;
/** How long (in track distance) a clip-loss pop-up stays up. */
const CLIP_POPUP_DIST = 0.8;
/** How long (in track distance) answer feedback stays up. */
const ANSWER_FEEDBACK_DIST = 1.0;
/** How far (in track distance) past a wall its answer labels take to fade out. */
const PASSED_LABEL_FADE_DIST = 0.15;
/** How long (in track distance) a shatter burst lasts. */
const SHATTER_DIST = 0.6;
/** How long (in track distance) a crate's "+N" and its recruits running in last. */
const CRATE_POPUP_DIST = 0.8;
/** How long (in track distance) a charge's firefight plays after contact. */
const FIREFIGHT_DIST = 1.2;
/** Fraction of the firefight both sides fire before the chosen squad's outcome shows. */
const FIREFIGHT_REVEAL = 0.2;
/** How long (in track distance) the squads not run into take to fall back after contact. */
const SQUAD_FADE_DIST = 0.3;
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

/** Smallest a question prompt is drawn (px), however far away its wall is. */
const PROMPT_MIN_PX = 34;
/** Smallest an answer label is drawn (px), unless it must shrink to fit its opening. */
const LABEL_MIN_PX = 18;

/** `size`, or smaller if needed so `s` fits in `maxWidth`. */
function fitSize(ctx: Ctx, s: string, size: number, maxWidth: number): number {
  ctx.font = `${Math.round(size)}px ${FONT}`;
  const width = ctx.measureText(s).width;
  return width > maxWidth ? (size * maxWidth) / width : size;
}

/** Below this an answer label wraps to two lines rather than shrinking further. */
const LABEL_FLOOR_PX = 14;

/** A label split into runs: kun'yomi okurigana あ(げる) is greyed. */
function labelRuns(s: string): { s: string; color: string }[] {
  const m = /^(.*?)(\(.+\))$/.exec(s);
  if (!m) return [{ s, color: COLORS.text }];
  return [
    { s: m[1] as string, color: COLORS.text },
    { s: m[2] as string, color: COLORS.dim },
  ].filter((r) => r.s);
}

const LATIN = /[a-z]/i;
const KANA = /[぀-ゟ]/;

/**
 * Ways to put a label on two lines: at a space or hyphen, or before
 * okurigana brackets; with `inWord`, also inside a word (at least 3
 * letters each side, hyphenated) or between kana outside the brackets.
 */
function labelSplits(s: string, inWord: boolean): [string, string][] {
  const out: [string, string][] = [];
  const bracket = s.indexOf("(");
  for (let i = 1; i < s.length; i++) {
    const prev = s[i - 1] as string;
    const c = s[i] as string;
    if (prev === " " || prev === "-" || c === "(")
      out.push([s.slice(0, i).trimEnd(), s.slice(i)]);
    else if (!inWord) continue;
    else if (LATIN.test(prev) && LATIN.test(c)) {
      if (i >= 3 && s.length - i >= 3)
        out.push([`${s.slice(0, i)}-`, s.slice(i)]);
    } else if (KANA.test(prev) && KANA.test(c) && (bracket < 0 || i < bracket))
      out.push([s.slice(0, i), s.slice(i)]);
  }
  return out;
}

/**
 * Lines and font size for an answer label in an opening `maxWidth` px wide:
 * one line at `size` if it fits, else shrunk to fit. If that would go below
 * LABEL_FLOOR_PX, the two-line split that allows the largest size, trying
 * natural breaks first and breaking inside a word only if those still fall
 * below the floor.
 */
function labelLayout(
  ctx: Ctx,
  s: string,
  size: number,
  maxWidth: number,
): { lines: string[]; size: number } {
  let best = { lines: [s], size: fitSize(ctx, s, size, maxWidth) };
  for (const inWord of [false, true]) {
    if (best.size >= LABEL_FLOOR_PX) break;
    for (const [a, b] of labelSplits(s, inWord)) {
      const two = Math.min(
        fitSize(ctx, a, size, maxWidth),
        fitSize(ctx, b, size, maxWidth),
        // two lines must still fit in the wall's height
        size * 0.78,
      );
      if (two > best.size) best = { lines: [a, b], size: two };
    }
  }
  return best;
}

/** An answer label centred on (x, y), on one or two lines, okurigana greyed. */
function drawLabel(
  ctx: Ctx,
  s: string,
  x: number,
  y: number,
  size: number,
  maxWidth: number,
): void {
  const { lines, size: px } = labelLayout(ctx, s, size, maxWidth);
  const lineH = px * 1.1;
  lines.forEach((line, n) => {
    const ly = y + (n - (lines.length - 1) / 2) * lineH;
    const runs = labelRuns(line);
    ctx.font = `${Math.round(px)}px ${FONT}`;
    const widths = runs.map((r) => ctx.measureText(r.s).width);
    let left = x - widths.reduce((a, b) => a + b, 0) / 2;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    runs.forEach((r, k) => {
      ctx.fillStyle = r.color;
      ctx.fillText(r.s, left, ly);
      left += widths[k] as number;
    });
  });
}

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
  const fight = view.charges.find(
    (c) => c.contactDist !== null && run.dist - c.contactDist < FIREFIGHT_DIST,
  );
  if (!fight) renderFire(ctx, w, run, armyY, radius, depthY);

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
    const openings = rowOpenings(run, i);
    const passed = i < run.next;
    const labelAlpha = passed
      ? 1 - Math.min(1, Math.max(0, -ahead) / PASSED_LABEL_FADE_DIST)
      : 1;
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
      // the opening being shot glows at both edges as they are pushed apart
      if (i === run.next && run.gateTarget === j) {
        const edge = Math.max(2, 4 * scale);
        ctx.globalAlpha = 0.6 + 0.4 * Math.sin(run.dist * 80);
        ctx.fillStyle = COLORS.bullet;
        ctx.fillRect(left - edge, y - wallH, edge, wallH);
        ctx.fillRect(left + width, y - wallH, edge, wallH);
        ctx.globalAlpha = 1;
      }
      // a passed wall's labels fade quickly, and the one run through goes at
      // once, so none covers the army or its pop-ups
      if (labelAlpha <= 0 || (passed && answered?.choice === j)) return;
      const label = row.options[j] ?? "";
      ctx.globalAlpha = labelAlpha;
      drawLabel(
        ctx,
        label,
        o.centre * w,
        y - wallH / 2,
        Math.max(LABEL_MIN_PX, 30 * scale),
        width - 6,
      );
      ctx.globalAlpha = 1;
    });
    // a charge is the same wall with a squad standing beyond each opening
    const charge = isCharge(run.track, i)
      ? view.charges.find((c) => c.row === i)
      : undefined;
    const squadsH = charge
      ? renderSquads(ctx, w, run, charge, y - wallH, scale)
      : 0;
    // a passed wall's prompt is gone: it would sit over the army and its pop-ups
    if (passed) continue;
    // never too small to read at first sight; it grows upwards, clear of the labels and squads
    const promptSize = Math.max(PROMPT_MIN_PX, 44 * scale);
    const promptY = y - wallH - squadsH - 8 * scale - promptSize / 2;
    text(ctx, row.prompt, w / 2, promptY, promptSize);
  }

  if (fight) renderFirefight(ctx, w, run, fight, armyY, radius);

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
  const gate =
    run.gateTarget === null
      ? undefined
      : rowOpenings(run, run.next)[run.gateTarget];
  if (gate) {
    // the opening being shot: the stream splits onto its two edges at the wall's foot
    const ty = depthY(fireLimit(run) - run.dist) - 2;
    const edges = [gate.left * w, gate.right * w];
    ctx.fillStyle = COLORS.bullet;
    for (let l = 0; l < Math.max(2, lanes); l++) {
      const sx = laneX(l % lanes);
      const tx = edges[l % 2] as number;
      for (let k = 0; k < 6; k++) {
        const t = (k / 6 + run.dist * 3 + l * 0.37) % 1;
        ctx.beginPath();
        ctx.arc(sx + (tx - sx) * t, sy + (ty - sy) * t, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // hit flashes where the edges are being pushed
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(run.dist * 80);
    ctx.fillStyle = "#fff";
    for (const tx of edges) {
      ctx.beginPath();
      ctx.arc(tx, ty, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  } else if (
    i === null ||
    !(target?.kind === "block" || target?.kind === "pack")
  ) {
    const ey = depthY(FIRE_RANGE);
    // bullets stop at the next wall, so they never reach a prompt or a squad
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

/** How far through its firefight a charge is: 0 at contact, 1 when it ends. */
function firefightProgress(run: RunState, c: ChargeView): number {
  const t = (run.dist - (c.contactDist ?? run.dist)) / FIREFIGHT_DIST;
  return Math.min(1, Math.max(0, t));
}

/** Squads are drawn this much larger than a crowd their size, so they read at a distance. */
const SQUAD_DRAW_K = 1.4;

/** Radius on screen of a squad at the given scale. */
const squadRadius = (w: number, count: number, scale: number): number =>
  (SQUAD_DRAW_K * crowdWidth(count) * w * scale) / 2;

/** How far (px) the squad run into steps back from the wall as the firefight starts. */
const FIREFIGHT_STEP_BACK = 60;

/** Gap between a wall's top edge and the bottom of the squads beyond it. */
const SQUAD_GAP = 6;

/** Where a squad standing beyond a wall whose top edge is at `top` is centred. */
const squadY = (top: number, r: number, scale: number): number =>
  top - SQUAD_GAP * scale - r * 0.6;

/**
 * Identical squads standing just beyond a charge's openings, one per answer,
 * with their (shared) count above them. Returns the height they take above
 * the wall. After contact the squad run into is drawn by the firefight
 * instead, and the others fall back.
 */
function renderSquads(
  ctx: Ctx,
  w: number,
  run: RunState,
  c: ChargeView,
  top: number,
  scale: number,
): number {
  const count = c.squads[0]?.count ?? 0;
  const r = squadRadius(w, count, scale);
  const height = SQUAD_GAP * scale + r * 1.2 + 26 * scale;
  const fade = c.resolved
    ? 1 - Math.min(1, (run.dist - c.pos) / SQUAD_FADE_DIST)
    : 1;
  if (fade <= 0) return height;
  ctx.globalAlpha = fade;
  for (const q of c.squads) {
    if (q.chosen) continue;
    renderSquad(ctx, q.x * w, squadY(top, r, scale), r, q.count, scale);
  }
  ctx.globalAlpha = 1;
  return height;
}

/** A squad: enemy dots with its count above them (so it never covers a label below). */
function renderSquad(
  ctx: Ctx,
  cx: number,
  cy: number,
  r: number,
  count: number,
  scale: number,
  color = COLORS.enemy,
): void {
  renderDots(ctx, cx, cy, r, count, color);
  text(ctx, String(count), cx, cy - r * 0.6 - 12 * scale, 20 * scale, color);
}

/**
 * The firefight at contact, played beyond the wall so it never sits under the
 * army: the squad run into holds where it stood as the army comes through,
 * both sides fire, then a correct squad turns friendly and runs into the army
 * while a wrong one keeps firing back until it breaks.
 */
function renderFirefight(
  ctx: Ctx,
  w: number,
  run: RunState,
  c: ChargeView,
  armyY: number,
  radius: number,
): void {
  const q = c.squads.find((s) => s.chosen);
  if (!q) return;
  const t = firefightProgress(run, c);
  const revealed = t >= FIREFIGHT_REVEAL;
  const joins = revealed && q.outcome === "join";
  const u = revealed ? (t - FIREFIGHT_REVEAL) / (1 - FIREFIGHT_REVEAL) : 0;
  // where the squad stood at contact (scale 1, wall top at armyY - 56)
  const r = squadRadius(w, q.count, 1);
  const homeX = q.x * w;
  const homeY =
    squadY(armyY - 56, r, 1) - FIREFIGHT_STEP_BACK * Math.min(1, t / 0.15);
  const sx = run.x * w;
  const sy = armyY - radius * 0.6;
  if (joins) {
    // the defectors run into the army and merge with it
    const k = Math.min(1, u * 1.4);
    const cx = homeX + (sx - homeX) * k;
    const cy = homeY + (armyY - homeY) * k;
    ctx.globalAlpha = 1 - k * 0.8;
    renderSquad(ctx, cx, cy, r * (1 - 0.4 * k), q.count, 1, COLORS.soldier);
    ctx.globalAlpha = 1 - u;
    text(ctx, "JOINS YOU", homeX, homeY - r - 30, 18, COLORS.good);
    ctx.globalAlpha = 1;
    return;
  }
  // both sides fire; a fighting squad thins out as it is shot to pieces
  const fade = q.outcome === "fight" ? 1 - u : 1;
  const lanes = Math.min(5, 1 + Math.floor(Math.sqrt(run.army) / 3));
  ctx.fillStyle = COLORS.bullet;
  for (let l = 0; l < lanes; l++) {
    const ox = (lanes > 1 ? l / (lanes - 1) - 0.5 : 0) * radius;
    for (let k = 0; k < 6; k++) {
      const v = (k / 6 + run.dist * 3 + l * 0.37) % 1;
      ctx.beginPath();
      ctx.arc(
        sx + ox + (homeX - sx - ox) * v,
        sy + (homeY - sy) * v,
        2.5,
        0,
        7,
      );
      ctx.fill();
    }
  }
  ctx.globalAlpha = fade;
  ctx.fillStyle = COLORS.enemyBullet;
  const back = revealed ? 4 : 2;
  for (let l = 0; l < back; l++) {
    const ox = (back > 1 ? l / (back - 1) - 0.5 : 0) * r;
    for (let k = 0; k < 5; k++) {
      const v = (k / 5 + run.dist * 2.6 + l * 0.29) % 1;
      ctx.beginPath();
      ctx.arc(
        homeX + ox + (sx - homeX - ox) * v,
        homeY + (sy - homeY) * v,
        3,
        0,
        7,
      );
      ctx.fill();
    }
  }
  renderSquad(ctx, homeX, homeY, r, q.count, 1);
  if (revealed) text(ctx, "FIGHTS BACK", homeX, homeY - r - 30, 18, COLORS.bad);
  ctx.globalAlpha = 1;
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
  renderDots(ctx, cx, cy, radius, army, color);
  text(ctx, String(army), cx, cy + radius * 0.6 + 22 * scale, 22 * scale);
}

/** Up to MAX_DRAWN_SOLDIERS dots packed into a squashed disc. */
function renderDots(
  ctx: Ctx,
  cx: number,
  cy: number,
  radius: number,
  army: number,
  color: string,
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
