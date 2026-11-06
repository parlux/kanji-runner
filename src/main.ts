import { bindKeys } from "./game/input";
import { startLoop } from "./game/loop";
import { render } from "./game/render";
import { handleAction, updateScene, type Scene } from "./game/scenes";

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

const steerAxis = bindKeys((action) => {
  scene = handleAction(scene, action, newSeed);
});

startLoop(
  (dt) => {
    scene = updateScene(scene, dt, steerAxis());
  },
  () => render(ctx, window.innerWidth, window.innerHeight, scene),
);
