import type { AudioSettings } from "../audio/settings";
import type { Scene, Session } from "./scenes";
import type { SyncStatus } from "../sync/sync";
import {
  renderBossOverlay,
  renderMuteButton,
  renderPaused,
  renderRunOverlay,
  type TrackView,
} from "./hud";
import { defaultAudioSettings } from "../audio/settings";
import { renderEnd } from "./screens/end";
import { renderProgress } from "./screens/progress";
import { renderStart } from "./screens/start";
import { COLORS, type Ctx } from "./draw";

export function render(
  ctx: Ctx,
  w: number,
  h: number,
  scene: Scene,
  session: Session,
  sync: SyncStatus = "disabled",
  view3d?: TrackView,
  /** The other mode's unlocked level, for the mode switch; null hides it. */
  otherLevel: number | null = null,
  /** False when WebGL is unavailable: the start screen says so and Play does nothing. */
  canPlay = true,
  audio: AudioSettings = defaultAudioSettings(),
): void {
  // with a 3D view, the run and boss are drawn behind this canvas: draw only the overlay
  if (view3d && scene.kind === "run") {
    ctx.clearRect(0, 0, w, h);
    renderRunOverlay(ctx, w, h, scene.run, view3d);
    renderMuteButton(ctx, w, audio.muted);
    if (scene.paused) renderPaused(ctx, w, h);
    return;
  }
  if (view3d && scene.kind === "boss") {
    ctx.clearRect(0, 0, w, h);
    renderBossOverlay(ctx, w, h, scene, view3d);
    renderMuteButton(ctx, w, audio.muted);
    if (scene.paused) renderPaused(ctx, w, h);
    return;
  }
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, w, h);
  if (scene.kind === "start")
    return renderStart(
      ctx,
      w,
      h,
      session,
      scene.pick,
      sync,
      otherLevel,
      canPlay,
      audio,
    );
  if (scene.kind === "progress") return renderProgress(ctx, w, h, scene);
  if (scene.kind === "end")
    return renderEnd(ctx, w, h, scene.run, scene.boss, session, scene.scroll);
  // a run or boss clash without the 3D view is never entered: only the backdrop
}
