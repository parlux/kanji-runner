import { bindDrag, bindKeys, type Action } from "./game/input";
import { startLoop } from "./game/loop";
import { render } from "./game/render";
import {
  afterStep,
  createSession,
  devLevel,
  handleAction,
  updateScene,
  type Scene,
} from "./game/scenes";
import { loadProgress, saveProgress } from "./storage/storage";

const canvas = document.querySelector<HTMLCanvasElement>("#game");
if (!canvas) throw new Error("Missing #game canvas");
const ctx = canvas.getContext("2d");
if (!ctx) throw new Error("Canvas 2D not supported");

function resize(): void {
  if (!canvas || !ctx) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(window.innerWidth * dpr);
  canvas.height = Math.round(window.innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

window.addEventListener("resize", resize);
resize();

const newSeed = (): number => Math.floor(Math.random() * 2 ** 31);
let scene: Scene = { kind: "start" };
let session = createSession(
  loadProgress(localStorage),
  devLevel(window.location.search),
);

const act = (action: Action): void => {
  scene = handleAction(scene, action, newSeed, session);
};
const steerAxis = bindKeys(act);
// a tap starts a run from the start/end screens, and pauses or resumes a run
const takeDrag = bindDrag(canvas, () =>
  act(scene.kind === "run" ? "pause" : "confirm"),
);

startLoop(
  (dt) => {
    const next = updateScene(scene, dt, steerAxis(), takeDrag());
    const settled = afterStep(session, scene, next, Date.now());
    // save after every run
    if (settled !== session && session.persist)
      saveProgress(localStorage, settled.progress);
    session = settled;
    scene = next;
  },
  () => render(ctx, window.innerWidth, window.innerHeight, scene),
);
