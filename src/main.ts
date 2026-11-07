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
import { startTap } from "./game/start";
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
  const next = handleAction(scene, action, newSeed, session);
  // placement changes progress: save it right away
  if (next.session !== session && session.persist)
    saveProgress(localStorage, next.session.progress);
  scene = next.scene;
  session = next.session;
};
const steerAxis = bindKeys(act);
// a tap pauses or resumes a run, does nothing during the boss clash, leaves the end screen
// for the start screen, and on the start screen hits the placement controls or else starts a run
const takeDrag = bindDrag(canvas, (x, y) => {
  if (scene.kind === "run") return act("pause");
  if (scene.kind === "boss") return;
  if (scene.kind === "end") return act("confirm");
  const action = startTap(
    scene.pick !== undefined,
    window.innerWidth,
    window.innerHeight,
    x,
    y,
  );
  if (action) act(action);
});

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
  () => render(ctx, window.innerWidth, window.innerHeight, scene, session),
);
