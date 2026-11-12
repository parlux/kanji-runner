import { bindDrag, bindKeys, type Action } from "./game/input";
import { startLoop } from "./game/loop";
import { render, type TrackView } from "./game/render";
import type { KanjiItem, Progress } from "./core/types";
import {
  adoptProgress,
  afterStep,
  createSession,
  devLevel,
  handleAction,
  updateScene,
  type Scene,
} from "./game/scenes";
import {
  hits,
  speedTap,
  startTap,
  studyButton,
  syncTap,
  wkTap,
} from "./game/start";
import { SPEED_PRESETS } from "./core/tuning";
import { loadSpeed, nextSpeed, saveSpeed, speedLabel } from "./storage/speed";
import { openTokenForm, tokenFormOpen } from "./game/wanikani";
import { createWkState } from "./game/wkstate";
import { createStoryStore } from "./wanikani/storystore";
import { createWkClient } from "./wanikani/client";
import { openStudy, studyOpen } from "./game/study";
import { syncPauseCard } from "./game/pausecard";
import { KANA } from "./core/kana";
import { KANJI } from "./core/kanji";
import { missedItems } from "./core/run";
import { WORDS } from "./core/words";
import {
  canStudy,
  lastAnswer,
  runKanji,
  storiesWithFallback,
  studyCards,
} from "./core/study";
import { loadSessionLog, saveSessionLog } from "./storage/session";
import { loadProgress, saveProgress } from "./storage/storage";
import { loginOpen, openLogin } from "./sync/login";
import { createSyncFromEnv } from "./sync/sync";
import type { View3d } from "./game/three/scene3d";

const canvas = document.querySelector<HTMLCanvasElement>("#game");
if (!canvas) throw new Error("Missing #game canvas");
const ctx = canvas.getContext("2d");
if (!ctx) throw new Error("Canvas 2D not supported");

// `?3d`: the run is drawn in 3D on a WebGL canvas behind #game (2D if WebGL fails)
let view3d: View3d | null = null;
const canvas3d = document.querySelector<HTMLCanvasElement>("#world");
if (canvas3d && new URLSearchParams(window.location.search).has("3d"))
  void import("./game/three/scene3d").then(({ createView3d }) => {
    view3d = createView3d(canvas3d);
    if (!view3d) return;
    canvas3d.style.display = "block";
    resize();
  });

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

const newSeed = (): number => Math.floor(Math.random() * 2 ** 31);
let scene: Scene = { kind: "start" };
let session = createSession(
  loadProgress(localStorage),
  devLevel(window.location.search),
  loadSessionLog(localStorage),
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

// speed preset: this device only, changed on the start screen
let speed = loadSpeed(localStorage);

// WaniKani: token, cache and mode live on this device only; a dev sandbox skips it
const wk = createWkState({
  store: localStorage,
  storyStore: createStoryStore(),
  now: Date.now,
  makeClient: () =>
    createWkClient({
      fetch: (input, init) => fetch(input, init),
      store: localStorage,
      now: Date.now,
    }),
});
const overlayOpen = (): boolean =>
  studyOpen() || tokenFormOpen() || loginOpen();
const wkList = () => (session.persist ? wk.list() : null);
const showTokenForm = (error?: string): void =>
  openTokenForm({
    saved: wk.token(),
    ...(error ? { error } : {}),
    onSave: (token) => void wk.save(token),
    onRemove: wk.remove,
  });
if (session.persist) void wk.refresh();

// the study screen (end screen only) lists what the last run missed, then its other kanji
const kanjiList = (): readonly KanjiItem[] => session.wk?.kanji ?? KANJI;
const studyAvailable = (): boolean => {
  if (scene.kind !== "end") return false;
  const { run, boss } = scene;
  const missed = missedItems(
    run.rows,
    run.results,
    run.track.charges,
    kanjiList(),
  );
  return canStudy(
    missed.length + runKanji(run.rows, run.results).length,
    boss?.won ?? false,
  );
};
// a paused run shows its last answered gate with that item's study card
const pauseCard = (): void => {
  if (scene.kind !== "run" || !scene.paused)
    return syncPauseCard(null, "", () => {});
  const { run } = scene;
  const last = lastAnswer(
    run.rows,
    run.results,
    run.lastAnswer?.choice ?? -1,
    kanjiList(),
    KANA,
    storiesWithFallback(wk.stories(), session.wk ? wk.mnemonics() : undefined),
    WORDS,
  );
  syncPauseCard(last, `${scene.seed}:${run.results.length}`, () =>
    act("pause"),
  );
};

const study = (): void => {
  if (scene.kind !== "end" || !studyAvailable()) return;
  const { run } = scene;
  const missed = missedItems(
    run.rows,
    run.results,
    run.track.charges,
    kanjiList(),
  );
  // Play again: end -> start -> run, the same as confirming twice
  const cards = studyCards(
    missed,
    kanjiList(),
    KANA,
    storiesWithFallback(wk.stories(), session.wk ? wk.mnemonics() : undefined),
    runKanji(run.rows, run.results),
    WORDS,
  );
  openStudy(cards, () => {
    act("confirm");
    act("confirm");
  });
};

const act = (action: Action): void => {
  if (overlayOpen()) return;
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
  if (overlayOpen()) return;
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
  if (scene.pick === undefined && speedTap(w, h, x, y)) {
    speed = nextSpeed(speed);
    saveSpeed(localStorage, speed);
    return;
  }
  if (scene.pick === undefined && session.persist) {
    const tap = wkTap(wk.view().canSwitch, w, h, x, y);
    if (tap === "token") return showTokenForm();
    if (tap) return wk.setMode(tap.mode);
  }
  const action = startTap(scene.pick !== undefined, w, h, x, y, !session.wk);
  if (action) act(action);
});

let lastKind: Scene["kind"] = "start";
startLoop(
  (dt) => {
    // runs use the WaniKani list in WaniKani mode
    if (session.wk !== wkList()) session = { ...session, wk: wkList() };
    // back on the start screen: refresh WaniKani (the client throttles)
    if (scene.kind === "start" && lastKind !== "start" && session.persist)
      void wk.refresh();
    lastKind = scene.kind;
    // an invalid token reopens the form, once, from the start screen
    if (scene.kind === "start" && !overlayOpen() && wk.takeInvalid())
      showTokenForm("WaniKani token invalid");
    const next = updateScene(
      scene,
      dt,
      steerAxis(),
      takeDrag(),
      SPEED_PRESETS[speed],
    );

    const settled = afterStep(session, scene, next, Date.now());
    // save, then sync, after every run
    const ran = settled !== session && session.persist;
    if (ran) {
      saveProgress(localStorage, settled.progress);
      if (settled.log) saveSessionLog(localStorage, settled.log);
    }
    session = settled;
    if (ran) void sync.push().then(adopt);
    scene = next;
  },
  () => {
    // 3D draws the run and the boss clash; #game then draws only the overlay
    let track: TrackView | undefined;
    if (view3d && (scene.kind === "run" || scene.kind === "boss")) {
      view3d.render(scene);
      track = { project: view3d.project, haze: view3d.haze };
    }
    render(
      ctx,
      window.innerWidth,
      window.innerHeight,
      scene,
      session,
      sync.status(),
      session.persist ? wk.view() : null,
      track,
      speedLabel(speed),
    );
    pauseCard();
  },
);
