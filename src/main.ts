import { bindDrag, bindKeys, bindScroll, type Action } from "./game/input";
import { clampScroll } from "./game/progress";
import { startLoop } from "./game/loop";
import { render } from "./game/render";
import type { TrackView } from "./game/hud";
import type { Progress } from "./core/types";
import {
  adoptProgress,
  afterStep,
  createSession,
  endScrollMax,
  handleAction,
  progressTap,
  scrollProgress,
  updateScene,
  type Scene,
} from "./game/scenes";
import { endTap, modeTap, settingsTap, startTap, syncTap } from "./game/start";
import { SPEED_PRESETS } from "./core/tuning";
import { removeLegacyKeys } from "./storage/legacy";
import { createPanels } from "./game/ui/panels";
import {
  loadMeaningProgress,
  loadProgress,
  saveProgress,
} from "./storage/storage";
import { loadMeaningMode, saveMeaningMode } from "./storage/meaning";
import { persistence } from "./game/mode";
import { createSyncFromEnv } from "./sync/sync";
import { createStage } from "./game/stage";

const stage = createStage();

// drop the old tuned camera, gear and horde values saved on this device
removeLegacyKeys(localStorage);

const newSeed = (): number => Math.floor(Math.random() * 2 ** 31);
let scene: Scene = { kind: "start" };
// "Meanings only" plays its own save; the owner's is not read or written then.
const loadSession = (meaning: boolean) =>
  meaning
    ? createSession(loadMeaningProgress(localStorage), true)
    : createSession(loadProgress(localStorage));
let session = loadSession(loadMeaningMode(localStorage));
// the other mode's level, for the start screen's mode switch
const otherLevelOf = (meaning: boolean): number =>
  (meaning ? loadProgress : loadMeaningProgress)(localStorage).unlockedLevel;
let otherLevel = otherLevelOf(session.meaning);
const syncs = (): boolean => persistence(session).sync;

// meaning mode neither pulls nor pushes
const sync = createSyncFromEnv(localStorage, import.meta.env);
// adoptProgress ignores meaning mode, so an in-flight pull never lands in it
const adopt = (p: Progress): void => {
  session = adoptProgress(session, p);
};
if (syncs()) void sync.pull().then(adopt);

// WaniKani (the token, for stories) is off in meaning mode;
// runs always use the Built-in list
const wkOn = (): boolean => !session.meaning;

// the DOM panels: settings, WaniKani token, study, login, pause card
const panels = createPanels({
  scene: () => scene,
  session: () => session,
  sync,
  adopt,
  act: (a) => act(a),
  store: localStorage,
});
if (wkOn()) void panels.wk.refresh();

const act = (action: Action): void => {
  if (panels.anyOpen()) return;
  if (stage.webgl() !== "ok" && scene.kind === "start" && action === "confirm")
    return;
  if (action === "study") return panels.openStudy();
  const next = handleAction(scene, action, newSeed, session);
  // placement changes progress: save it right away, under this mode's key
  const keys = persistence(session);
  if (next.session !== session && keys)
    saveProgress(localStorage, next.session.progress, keys.progress);
  scene = next.scene;
  session = next.session;
};
const steerAxis = bindKeys(act);
// a tap pauses or resumes a run or the boss clash, hits the end
// screen's buttons (Play again, Study, Home; elsewhere nothing), and on the start
// screen hits the placement controls or else starts a run
const takeDrag = bindDrag(stage.canvas, (x, y) => {
  if (panels.anyOpen()) return;
  if (scene.kind === "run" || scene.kind === "boss") return act("pause");
  if (scene.kind === "end") {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const action = endTap(panels.studyAvailable(), w, h, x, y);
    if (action) act(action);
    return;
  }
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (scene.kind === "progress") {
    // `study` (an item row on the level page) is for its study card: not opened yet
    scene = progressTap(scene, w, h, x, y, session).scene;
    return;
  }
  const picking = scene.pick !== undefined;
  if (!picking && settingsTap(w, h, x, y)) return panels.openSettings();
  const mode = !picking ? modeTap(w, h, x, y) : null;
  if (mode && (mode === "meaning") !== session.meaning) {
    // switch modes: load the other save; nothing carries over
    const on = mode === "meaning";
    saveMeaningMode(localStorage, on);
    session = loadSession(on);
    otherLevel = otherLevelOf(on);
    if (syncs()) void sync.pull().then(adopt);
    return;
  }
  if (!picking && !session.meaning && syncTap(sync.status(), w, h, x, y))
    return panels.openSync();
  const action = startTap(scene.pick !== undefined, w, h, x, y, !session.wk);
  if (action) act(action);
});
// the overall view's list and the end screen's item list scroll by drag and wheel
bindScroll(stage.canvas, (dy) => {
  if (scene.kind === "end" && !panels.anyOpen()) {
    const max = endScrollMax(
      window.innerWidth,
      window.innerHeight,
      scene,
      session,
    );
    scene = { ...scene, scroll: clampScroll((scene.scroll ?? 0) + dy, max) };
    return;
  }
  if (scene.kind !== "progress" || panels.anyOpen()) return;
  scene = scrollProgress(scene, dy, window.innerWidth, window.innerHeight);
});

let lastKind: Scene["kind"] = "start";
startLoop(
  (dt) => {
    // back on the start screen: refresh WaniKani (the client throttles)
    if (scene.kind === "start" && lastKind !== "start" && wkOn())
      void panels.wk.refresh();
    lastKind = scene.kind;
    // an invalid token reopens the form, once, from the start screen
    if (
      scene.kind === "start" &&
      !panels.anyOpen() &&
      wkOn() &&
      panels.wk.takeInvalid()
    )
      panels.openToken("WaniKani token invalid");
    const next = updateScene(
      scene,
      dt,
      steerAxis(),
      takeDrag(),
      SPEED_PRESETS[panels.speed()],
    );

    const settled = afterStep(session, scene, next, Date.now());
    // save (under this mode's keys), then sync if this mode syncs, after every run
    const keys = settled !== session ? persistence(session) : null;
    if (keys) saveProgress(localStorage, settled.progress, keys.progress);
    session = settled;
    if (keys?.sync) void sync.push().then(adopt);
    scene = next;
  },
  () => {
    // 3D draws the run and the boss clash; #game then draws only the overlay
    const view3d = stage.view3d();
    let track: TrackView | undefined;
    if (view3d && (scene.kind === "run" || scene.kind === "boss")) {
      view3d.render(scene, SPEED_PRESETS[panels.speed()]);
      track = {
        project: view3d.project,
        haze: view3d.haze,
        boss: view3d.boss(),
      };
    }
    render(
      stage.ctx,
      window.innerWidth,
      window.innerHeight,
      scene,
      session,
      sync.status(),
      track,
      otherLevel,
      stage.webgl() !== "failed",
    );
    panels.sync();
  },
);
