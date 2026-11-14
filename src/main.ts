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
  studyOffered,
  updateScene,
  type Scene,
} from "./game/scenes";
import {
  endTap,
  modeTap,
  settingsTap,
  stampTap,
  stampTapped,
  startTap,
  syncTap,
} from "./game/start";
import { SPEED_PRESETS } from "./core/tuning";
import { loadSpeed, saveSpeed } from "./storage/speed";
import { openSettings, settingsOpen, syncSettings } from "./game/settings";
import { openTokenForm, tokenFormOpen } from "./game/wanikani";
import { createWkState } from "./game/wkstate";
import { createStoryStore } from "./wanikani/storystore";
import { createWkClient } from "./wanikani/client";
import { openStudy, studyOpen } from "./game/study";
import { syncPauseCard } from "./game/pausecard";
import {
  cameraPanelOpen,
  openCameraPanel,
  syncCameraGear,
} from "./game/camerasettings";
import { hordePanelOpen, openHordePanel } from "./game/hordesettings";
import { GAUNTLET_SEARCH } from "./game/sandbox/param";
import {
  DEFAULT_HORDE_SETTINGS,
  hordeTuning,
  loadHorde,
  saveHorde,
} from "./storage/horde";
import { loadCamera, loadGear, saveCamera, saveGear } from "./storage/camera";
import { KANA } from "./core/kana";
import { KANJI } from "./core/kanji";
import { missedItems } from "./core/run";
import { WORDS } from "./core/words";
import {
  lastAnswer,
  runKanji,
  storiesWithFallback,
  studyCards,
} from "./core/study";
import {
  loadMeaningSessionLog,
  loadSessionLog,
  saveSessionLog,
} from "./storage/session";
import {
  loadMeaningProgress,
  loadProgress,
  saveProgress,
} from "./storage/storage";
import { loadMeaningMode, saveMeaningMode } from "./storage/meaning";
import { persistence } from "./game/mode";
import { loginOpen, openLogin } from "./sync/login";
import { createSyncFromEnv } from "./sync/sync";
import type { View3d } from "./game/three/scene3d";

const canvas = document.querySelector<HTMLCanvasElement>("#game");
if (!canvas) throw new Error("Missing #game canvas");
const ctx = canvas.getContext("2d");
if (!ctx) throw new Error("Canvas 2D not supported");

// The run is drawn in 3D on a WebGL canvas behind #game; `?2d` forces the old
// 2D renderer, and it is used too when WebGL fails (`?3d` is the default, harmless)
let view3d: View3d | null = null;
const canvas3d = document.querySelector<HTMLCanvasElement>("#world");
if (canvas3d && !new URLSearchParams(window.location.search).has("2d"))
  void import("./game/three/scene3d")
    .then(({ createView3d }) => {
      view3d = createView3d(canvas3d);
      if (!view3d) return;
      view3d.setCamera(camera);
      canvas3d.style.display = "block";
      resize();
    })
    .catch(() => {
      view3d = null;
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
const dev = devLevel(window.location.search);
// "Meanings only" plays its own save; the owner's is not read or written then.
// A dev `?level=N` sandbox ignores the switch.
const loadSession = (meaning: boolean) =>
  meaning && dev === null
    ? createSession(
        loadMeaningProgress(localStorage),
        null,
        loadMeaningSessionLog(localStorage),
        true,
      )
    : createSession(
        loadProgress(localStorage),
        dev,
        loadSessionLog(localStorage),
      );
let session = loadSession(loadMeaningMode(localStorage));
// the other mode's level, for the start screen's mode switch (none in a dev sandbox)
const otherLevelOf = (meaning: boolean): number | null =>
  dev !== null
    ? null
    : (meaning ? loadProgress : loadMeaningProgress)(localStorage)
        .unlockedLevel;
let otherLevel = otherLevelOf(session.meaning);
const syncs = (): boolean => persistence(session)?.sync ?? false;

// a dev `?level=N` sandbox never syncs; meaning mode neither pulls nor pushes
const sync = createSyncFromEnv(
  localStorage,
  session.persist ? import.meta.env : {},
);
// adoptProgress ignores meaning mode, so an in-flight pull never lands in it
const adopt = (p: Progress): void => {
  session = adoptProgress(session, p);
};
if (syncs()) void sync.pull().then(adopt);

// tuned camera (dev tool, 3D only): saved on this device; null is the default camera
let camera = loadCamera(localStorage);
// the gear is hidden: five taps on the start screen's build stamp toggle it, remembered
let gearShown = loadGear(localStorage);
let stampTaps: number[] = [];
const openCamera = (): void =>
  void import("./game/three/world").then(({ DEFAULT_CAMERA }) => {
    openCameraPanel({
      defaults: DEFAULT_CAMERA,
      current: camera,
      onChange: (next) => {
        camera = next;
        saveCamera(localStorage, camera);
        view3d?.setCamera(camera);
      },
      onClose: () => {},
      onHorde: openHorde,
    });
  });
const openHorde = (): void =>
  openHordePanel({
    defaults: DEFAULT_HORDE_SETTINGS,
    current: horde,
    onChange: (next) => {
      horde = next;
      saveHorde(localStorage, horde);
    },
    onClose: () => {},
    onGauntlet: () => {
      window.location.search = GAUNTLET_SEARCH;
    },
  });

// tuned horde (dev tool): saved on this device, applied from the next run; null is the defaults
let horde = loadHorde(localStorage);

// speed preset: this device only, changed in settings
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
  studyOpen() ||
  tokenFormOpen() ||
  loginOpen() ||
  cameraPanelOpen() ||
  hordePanelOpen() ||
  settingsOpen();
// WaniKani (the token, for stories) is off in a dev sandbox and in meaning mode;
// runs always use the Built-in list
const wkOn = (): boolean => session.persist && !session.meaning;
const showTokenForm = (error?: string): void =>
  openTokenForm({
    saved: wk.token(),
    ...(error ? { error } : {}),
    onSave: (token) => void wk.save(token),
    onRemove: wk.remove,
  });
if (wkOn()) void wk.refresh();

// the study screen (end screen only) lists what the last run missed, then its other kanji
const kanjiList = (): readonly KanjiItem[] => session.wk?.kanji ?? KANJI;
const studyAvailable = (): boolean =>
  scene.kind === "end" && studyOffered(scene.run, scene.boss, session);
// a paused run shows its last answered gate with that item's study card
const pauseCard = (): void => {
  // meaning mode: no card (it shows readings), the plain "Paused" instead
  if (scene.kind !== "run" || !scene.paused || session.meaning)
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

// offline retries; log in opens the form; synced offers sign out
const syncAction = (): void => {
  if (sync.status() === "offline") void sync.pull().then(adopt);
  else openLogin(sync, adopt);
};
const showSettings = (): void =>
  openSettings({
    view: () => ({
      speed,
      wkLabel: wk.view().label,
      hasToken: wk.token() !== null,
      sync: session.persist && !session.meaning ? sync.status() : null,
    }),
    onSpeed: (s) => {
      speed = s;
      saveSpeed(localStorage, speed);
    },
    onToken: () => showTokenForm(),
    onSync: syncAction,
    build: __BUILD__,
  });

const study = (): void => {
  if (scene.kind !== "end" || !studyAvailable()) return;
  const { run } = scene;
  const missed = missedItems(
    run.rows,
    run.results,
    run.track.charges,
    kanjiList(),
  );
  const cards = studyCards(
    missed,
    kanjiList(),
    KANA,
    storiesWithFallback(wk.stories(), session.wk ? wk.mnemonics() : undefined),
    runKanji(run.rows, run.results),
    WORDS,
  );
  // its Play again is the end screen's: a new run straight away
  openStudy(cards, () => act("confirm"));
};

const act = (action: Action): void => {
  if (overlayOpen()) return;
  if (action === "study") return study();
  const next = handleAction(
    scene,
    action,
    newSeed,
    session,
    hordeTuning(horde ?? DEFAULT_HORDE_SETTINGS),
  );
  // placement changes progress: save it right away, under this mode's key
  const keys = persistence(session);
  if (next.session !== session && keys)
    saveProgress(localStorage, next.session.progress, keys.progress);
  scene = next.scene;
  session = next.session;
};
const steerAxis = bindKeys(act);
// a tap pauses or resumes a run, does nothing during the boss clash, hits the end
// screen's buttons (Play again, Study, Home; elsewhere nothing), and on the start
// screen hits the placement controls or else starts a run
const takeDrag = bindDrag(canvas, (x, y) => {
  if (overlayOpen()) return;
  if (scene.kind === "run") return act("pause");
  if (scene.kind === "boss") return;
  if (scene.kind === "end") {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const action = endTap(studyAvailable(), w, h, x, y);
    if (action) act(action);
    return;
  }
  const w = window.innerWidth;
  const h = window.innerHeight;
  const picking = scene.pick !== undefined;
  if (!picking && settingsTap(w, h, x, y)) return showSettings();
  const mode = !picking && session.persist ? modeTap(w, h, x, y) : null;
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
    return syncAction();
  if (!picking && stampTap(w, h, x, y)) {
    const t = stampTapped(stampTaps, performance.now() / 1000);
    stampTaps = t.taps;
    if (t.toggle) {
      gearShown = !gearShown;
      saveGear(localStorage, gearShown);
    }
    return;
  }
  const action = startTap(scene.pick !== undefined, w, h, x, y, !session.wk);
  if (action) act(action);
});

let lastKind: Scene["kind"] = "start";
startLoop(
  (dt) => {
    // back on the start screen: refresh WaniKani (the client throttles)
    if (scene.kind === "start" && lastKind !== "start" && wkOn())
      void wk.refresh();
    lastKind = scene.kind;
    // an invalid token reopens the form, once, from the start screen
    if (scene.kind === "start" && !overlayOpen() && wkOn() && wk.takeInvalid())
      showTokenForm("WaniKani token invalid");
    const next = updateScene(
      scene,
      dt,
      steerAxis(),
      takeDrag(),
      SPEED_PRESETS[speed],
    );

    const settled = afterStep(session, scene, next, Date.now());
    // save (under this mode's keys), then sync if this mode syncs, after every run
    const keys = settled !== session ? persistence(session) : null;
    if (keys) {
      saveProgress(localStorage, settled.progress, keys.progress);
      if (settled.log) saveSessionLog(localStorage, settled.log, keys.log);
    }
    session = settled;
    if (keys?.sync) void sync.push().then(adopt);
    scene = next;
  },
  () => {
    // 3D draws the run and the boss clash; #game then draws only the overlay
    let track: TrackView | undefined;
    if (view3d && (scene.kind === "run" || scene.kind === "boss")) {
      view3d.render(scene, SPEED_PRESETS[speed]);
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
      scene,
      session,
      sync.status(),
      track,
      otherLevel,
    );
    pauseCard();
    syncSettings();
    // the camera gear: on the start screen (picker closed) and on a paused run
    syncCameraGear(
      gearShown &&
        !overlayOpen() &&
        ((scene.kind === "start" && scene.pick === undefined) ||
          (scene.kind === "run" && scene.paused)),
      openCamera,
    );
  },
);
