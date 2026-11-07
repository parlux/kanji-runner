import { bindDrag, bindKeys, type Action } from "./game/input";
import { startLoop } from "./game/loop";
import { render } from "./game/render";
import type { Progress } from "./core/types";
import {
  adoptProgress,
  afterStep,
  createSession,
  devLevel,
  handleAction,
  updateScene,
  type Scene,
} from "./game/scenes";
import { hits, startTap, studyButton, syncTap } from "./game/start";
import { openStudy, studyOpen } from "./game/study";
import { KANA } from "./core/kana";
import { KANJI } from "./core/kanji";
import { missedItems } from "./core/run";
import { canStudy, studyCards } from "./core/study";
import { loadProgress, saveProgress } from "./storage/storage";
import { openLogin } from "./sync/login";
import { createSyncFromEnv } from "./sync/sync";

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

// a dev `?level=N` sandbox never syncs
const sync = createSyncFromEnv(
  localStorage,
  session.persist ? import.meta.env : {},
);
const adopt = (p: Progress): void => {
  session = adoptProgress(session, p);
};
void sync.pull().then(adopt);

// the study screen (end screen only) lists what the last run missed
const studyAvailable = (): boolean => {
  if (scene.kind !== "end") return false;
  const { run, boss } = scene;
  const missed = missedItems(run.rows, run.results, run.track.charges, KANJI);
  return canStudy(missed.length, boss?.won ?? false);
};
const study = (): void => {
  if (scene.kind !== "end" || !studyAvailable()) return;
  const { run } = scene;
  const missed = missedItems(run.rows, run.results, run.track.charges, KANJI);
  // Play again: end -> start -> run, the same as confirming twice
  openStudy(studyCards(missed, KANJI, KANA), () => {
    act("confirm");
    act("confirm");
  });
};

const act = (action: Action): void => {
  if (studyOpen()) return;
  if (action === "study") return study();
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
  if (scene.kind === "end") {
    const w = window.innerWidth;
    const h = window.innerHeight;
    return studyAvailable() && hits(studyButton(w, h), x, y)
      ? act("study")
      : act("confirm");
  }
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (scene.pick === undefined && syncTap(sync.status(), w, h, x, y)) {
    // offline retries; log in opens the form; synced offers sign out
    if (sync.status() === "offline") void sync.pull().then(adopt);
    else openLogin(sync, adopt);
    return;
  }
  const action = startTap(scene.pick !== undefined, w, h, x, y);
  if (action) act(action);
});

startLoop(
  (dt) => {
    const next = updateScene(scene, dt, steerAxis(), takeDrag());
    const settled = afterStep(session, scene, next, Date.now());
    // save, then sync, after every run
    const ran = settled !== session && session.persist;
    if (ran) saveProgress(localStorage, settled.progress);
    session = settled;
    if (ran) void sync.push().then(adopt);
    scene = next;
  },
  () =>
    render(
      ctx,
      window.innerWidth,
      window.innerHeight,
      scene,
      session,
      sync.status(),
    ),
);
