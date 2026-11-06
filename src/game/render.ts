import { rowPosition, type RunState } from "../core/sim";
import { VIEW_DISTANCE } from "../core/tuning";
import type { Scene } from "./scenes";

const FONT = `"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic", system-ui, sans-serif`;
const MAX_DRAWN_SOLDIERS = 200;
const COLORS = {
  bg: "#111",
  track: "#1d2230",
  lane: "#2c3347",
  gate: "rgba(90, 140, 255, 0.28)",
  gateEdge: "#5a8cff",
  text: "#f2f2f2",
  dim: "#9aa3b5",
  soldier: "#ffcf4a",
  good: "#5fd38d",
  bad: "#ff6b6b",
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
  renderRun(ctx, w, h, scene.run, scene.armyX);
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

function renderRun(
  ctx: Ctx,
  w: number,
  h: number,
  run: RunState,
  armyX: number,
): void {
  const horizonY = h * 0.22;
  const armyY = h * 0.82;
  const depthY = (ahead: number): number =>
    armyY - (armyY - horizonY) * (ahead / VIEW_DISTANCE);

  ctx.fillStyle = COLORS.track;
  ctx.fillRect(0, horizonY, w, h - horizonY);

  // lane dividers for the next row
  const lanes = run.rows[run.next]?.options.length ?? 1;
  ctx.fillStyle = COLORS.lane;
  for (let i = 1; i < lanes; i++)
    ctx.fillRect((w * i) / lanes - 1, horizonY, 2, h - horizonY);

  // visible rows, far ones first
  for (let i = run.rows.length - 1; i >= run.next; i--) {
    const ahead = rowPosition(i) - run.dist;
    if (ahead > VIEW_DISTANCE) continue;
    const row = run.rows[i];
    if (!row) continue;
    const y = depthY(ahead);
    const scale = 1 - 0.5 * (ahead / VIEW_DISTANCE);
    const gateH = 56 * scale;
    const n = row.options.length;
    row.options.forEach((opt, j) => {
      const x = (w * j) / n;
      ctx.fillStyle = COLORS.gate;
      ctx.fillRect(x + 4, y - gateH, w / n - 8, gateH);
      ctx.fillStyle = COLORS.gateEdge;
      ctx.fillRect(x + 4, y - 3, w / n - 8, 3);
      text(ctx, opt, x + w / (2 * n), y - gateH / 2, 30 * scale);
    });
    text(ctx, row.prompt, w / 2, y - gateH - 30 * scale, 44 * scale);
  }

  // prompt banner for the next row
  const nextRow = run.rows[run.next];
  if (nextRow && rowPosition(run.next) - run.dist <= VIEW_DISTANCE) {
    text(
      ctx,
      nextRow.prompt,
      w / 2,
      horizonY / 2,
      Math.min(96, horizonY * 0.75),
    );
  }

  renderArmy(ctx, armyX * w, armyY, run.army);

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

function renderArmy(ctx: Ctx, cx: number, cy: number, army: number): void {
  const n = Math.min(army, MAX_DRAWN_SOLDIERS);
  const r = 4;
  ctx.fillStyle = COLORS.soldier;
  ctx.beginPath();
  for (let k = 0; k < n; k++) {
    // sunflower packing, squashed for a top-down-ish look
    const dist = 6 * Math.sqrt(k);
    const angle = k * 2.39996;
    const x = cx + dist * Math.cos(angle);
    const y = cy + dist * Math.sin(angle) * 0.6;
    ctx.moveTo(x + r, y);
    ctx.arc(x, y, r, 0, Math.PI * 2);
  }
  ctx.fill();
  const radius = 6 * Math.sqrt(n) * 0.6;
  text(ctx, String(army), cx, cy + radius + 22, 22);
}
