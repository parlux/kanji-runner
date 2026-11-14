import { defaultProgress } from "../../core/srs";
import { SPEED_PRESETS, STEER_MAX_SPEED } from "../../core/tuning";
import { loadCamera } from "../../storage/camera";
import { loadSpeed } from "../../storage/speed";
import { openLogin } from "../../sync/login";
import { createSyncFromEnv } from "../../sync/sync";
import { bindDrag, bindKeys } from "../input";
import { startLoop } from "../loop";
import { render, type TrackView } from "../render";
import { createSession, type Scene } from "../scenes";
import { createView3d } from "../three/scene3d";
import {
  countFrame,
  rateWave,
  startGauntlet,
  stepGauntlet,
  type Gauntlet,
} from "./gauntlet";
import { GAUNTLET } from "./presets";
import { buildResults, resultsText, type GauntletResults } from "./results";
import { createGauntletUi } from "./ui";

/**
 * `?sandbox=horde`: the horde gauntlet (dev tool). Numbered waves of one
 * pack each, in the real 3D view and sim, rated one by one; the results
 * go to the owner's Supabase account (or Share / Copy). Nothing here reads
 * or writes the game's progress.
 */

/** The look's seed (a `?scenery=` look overrides it). */
const SEED = 1;

const canvas = document.querySelector<HTMLCanvasElement>("#game");
const canvas3d = document.querySelector<HTMLCanvasElement>("#world");
const ctx = canvas?.getContext("2d");
if (!canvas || !canvas3d || !ctx) throw new Error("Missing canvases");

const view3d = createView3d(canvas3d);
if (view3d) {
  view3d.setCamera(loadCamera(localStorage));
  canvas3d.style.display = "block";
}
function resize(): void {
  if (!canvas || !ctx) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(window.innerWidth * dpr);
  canvas.height = Math.round(window.innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  view3d?.resize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", resize);
resize();

const pace = SPEED_PRESETS[loadSpeed(localStorage)];
const sync = createSyncFromEnv(localStorage);
// the overlay's HUD needs a session; it shows nothing of it in a run
const session = createSession(defaultProgress(), null);

let g: Gauntlet = startGauntlet(GAUNTLET);
let results: GauntletResults | null = null;
const finished = (): GauntletResults => {
  results ??= buildResults(g.log, __BUILD__, new Date(), navigator.userAgent);
  return results;
};

const ui = createGauntletUi({
  onRate: (r) => {
    g = rateWave(g, r);
  },
  onSave: () => sync.saveTuning(finished()),
  onLogin: (done) => openLogin(sync, done),
  text: () => resultsText(finished()),
  onAgain: () => {
    results = null;
    g = startGauntlet(GAUNTLET);
  },
  onExit: () => {
    window.location.search = "";
  },
});

const steerAxis = bindKeys(() => {});
// taps do nothing (no pausing); drags steer
const takeDrag = bindDrag(canvas, () => {});

const scene = (): Extract<Scene, { kind: "run" }> => ({
  kind: "run",
  seed: SEED,
  run: g.run,
  paused: false,
});

let last = performance.now();
startLoop(
  (dt) => {
    const dx = steerAxis() * STEER_MAX_SPEED * dt + takeDrag();
    g = stepGauntlet(g, dt, dx, pace);
  },
  () => {
    const now = performance.now();
    g = countFrame(g, (now - last) / 1000);
    last = now;
    let track: TrackView | undefined;
    const s = scene();
    if (view3d) {
      view3d.render(s, pace);
      track = {
        project: view3d.project,
        haze: view3d.haze,
        boss: view3d.boss(),
      };
    }
    render(
      ctx,
      window.innerWidth,
      window.innerHeight,
      s,
      session,
      sync.status(),
      track,
    );
    ui.sync(g);
  },
);
