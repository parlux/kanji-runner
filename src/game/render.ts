import { crowdWidth } from "../core/crowd";
import { gateOpenings, type RunState } from "../core/sim";
import { CALM_DISTANCE, VIEW_DISTANCE } from "../core/tuning";
import type { Scene } from "./scenes";

const FONT = `"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic", system-ui, sans-serif`;
const MAX_DRAWN_SOLDIERS = 200;
/** How long (in track distance) a clip-loss pop-up stays up. */
const CLIP_POPUP_DIST = 0.8;
const COLORS = {
  bg: "#111",
  track: "#1d2230",
  wall: "#5a6478",
  wallEdge: "#8892a8",
  opening: "rgba(90, 140, 255, 0.18)",
  text: "#f2f2f2",
  dim: "#9aa3b5",
  soldier: "#ffcf4a",
  good: "#5fd38d",
  bad: "#ff6b6b",
  hazard: "#c24b4b",
  hazardEdge: "#ff8a7a",
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
    text(ctx, "P to resume", w / 2, h / 2 + 24, 20, COLORS.dim);
  }
}

function renderStart(ctx: Ctx, w: number, h: number): void {
  text(ctx, "Kanji Runner", w / 2, h * 0.35, Math.min(64, w / 8));
  text(ctx, "Enter or Space to start", w / 2, h * 0.5, 22);
  text(ctx, "←/→ steer · P pause", w / 2, h * 0.5 + 36, 18, COLORS.dim);
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
  text(ctx, "Enter or Space to play again", w / 2, h * 0.7, 20);
}

function renderRun(ctx: Ctx, w: number, h: number, run: RunState): void {
  const horizonY = h * 0.22;
  const armyY = h * 0.82;
  const depthY = (ahead: number): number =>
    armyY - (armyY - horizonY) * (ahead / VIEW_DISTANCE);

  ctx.fillStyle = COLORS.track;
  ctx.fillRect(0, horizonY, w, h - horizonY);

  // visible hazards, far ones first
  const { hazards, questions } = run.track;
  for (let i = hazards.length - 1; i >= run.nextHazard; i--) {
    const h = hazards[i];
    if (!h) continue;
    const ahead = h.pos - run.dist;
    if (ahead > VIEW_DISTANCE) continue;
    const y = depthY(ahead);
    const blockH = 34 * (1 - 0.5 * (ahead / VIEW_DISTANCE));
    ctx.fillStyle = COLORS.hazard;
    ctx.fillRect(h.left * w, y - blockH, (h.right - h.left) * w, blockH);
    ctx.fillStyle = COLORS.hazardEdge;
    ctx.fillRect(h.left * w, y - 3, (h.right - h.left) * w, 3);
  }

  // visible walls, far ones first
  for (let i = run.rows.length - 1; i >= run.next; i--) {
    const ahead = (questions[i] ?? Infinity) - run.dist;
    if (ahead > VIEW_DISTANCE) continue;
    const row = run.rows[i];
    if (!row) continue;
    const y = depthY(ahead);
    const scale = 1 - 0.5 * (ahead / VIEW_DISTANCE);
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
      ctx.fillStyle = COLORS.opening;
      ctx.fillRect(left, y - wallH, width, wallH);
      text(ctx, row.options[j] ?? "", o.centre * w, y - wallH / 2, 30 * scale);
    });
    text(ctx, row.prompt, w / 2, y - wallH - 30 * scale, 44 * scale);
  }

  // prompt banner for the next row
  const nextRow = run.rows[run.next];
  // the prompt appears as the calm stretch before its question starts
  const nextAhead = (questions[run.next] ?? Infinity) - run.dist;
  if (nextRow && nextAhead <= CALM_DISTANCE) {
    text(
      ctx,
      nextRow.prompt,
      w / 2,
      horizonY / 2,
      Math.min(96, horizonY * 0.75),
    );
  }

  const radius = (crowdWidth(run.army) * w) / 2;
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

/** A blob of up to 200 dots filling a squashed disc of the crowd's width. */
function renderArmy(
  ctx: Ctx,
  cx: number,
  cy: number,
  radius: number,
  army: number,
): void {
  const n = Math.min(army, MAX_DRAWN_SOLDIERS);
  // dot size shrinks as the blob fills up, within readable limits
  const r = Math.max(2, Math.min(5, radius / Math.sqrt(Math.max(n, 1)) / 1.1));
  ctx.fillStyle = COLORS.soldier;
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
  text(ctx, String(army), cx, cy + radius * 0.6 + 22, 22);
}
