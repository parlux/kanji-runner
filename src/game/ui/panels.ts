import type { KanjiItem } from "../../core/types";
import type { SpeedPreset } from "../../core/tuning";
import type { Progress } from "../../core/types";
import { KANA } from "../../core/kana";
import { KANJI } from "../../core/kanji";
import { missedItems } from "../../core/run";
import { WORDS } from "../../core/words";
import {
  lastAnswer,
  runKanji,
  storiesWithFallback,
  studyCards,
} from "../../core/study";
import { loadSpeed, saveSpeed } from "../../storage/speed";
import { loginOpen, openLogin } from "../../sync/login";
import type { Sync } from "../../sync/sync";
import type { Action } from "../input";
import { studyOffered, type Scene, type Session } from "../scenes";
import { createWkState, type WkState } from "../wkstate";
import { createWkClient } from "../../wanikani/client";
import { createStoryStore } from "../../wanikani/storystore";
import { syncPauseCard } from "./pausecard";
import { openSettings, settingsOpen, syncSettings } from "./settings";
import { openStudy, studyOpen } from "./study";
import { openTokenForm, tokenFormOpen } from "./wanikani";

export type PanelDeps = {
  scene: () => Scene;
  session: () => Session;
  sync: Sync;
  /** Takes progress pulled by a log in or a retry. */
  adopt: (p: Progress) => void;
  /** Sends an action to the game, as a key or a tap would. */
  act: (a: Action) => void;
  store: Storage;
};

export type Panels = {
  /** WaniKani: token, cache and mode live on this device only. */
  wk: WkState;
  /** A panel is open: the canvas takes no input then. */
  anyOpen: () => boolean;
  /** The speed preset (this device only), changed in settings. */
  speed: () => SpeedPreset;
  openSettings: () => void;
  openToken: (error?: string) => void;
  /** Offline retries; log in opens the form; synced offers sign out. */
  openSync: () => void;
  /** Opens the study screen for the last run (end screen only). */
  openStudy: () => void;
  studyAvailable: () => boolean;
  /** Call every frame: the pause card and the open settings panel. */
  sync: () => void;
};

export function createPanels(d: PanelDeps): Panels {
  const store = d.store;
  const wk = createWkState({
    store,
    storyStore: createStoryStore(),
    now: Date.now,
    makeClient: () =>
      createWkClient({
        fetch: (input, init) => fetch(input, init),
        store,
        now: Date.now,
      }),
  });
  let speed = loadSpeed(store);
  // the study screen lists what the last run missed, then its other kanji
  const kanjiList = (): readonly KanjiItem[] => d.session().wk?.kanji ?? KANJI;
  const stories = () =>
    storiesWithFallback(
      wk.stories(),
      d.session().wk ? wk.mnemonics() : undefined,
    );
  const studyAvailable = (): boolean => {
    const scene = d.scene();
    return (
      scene.kind === "end" && studyOffered(scene.run, scene.boss, d.session())
    );
  };
  const openToken = (error?: string): void =>
    openTokenForm({
      saved: wk.token(),
      ...(error ? { error } : {}),
      onSave: (token) => void wk.save(token),
      onRemove: wk.remove,
    });
  const openSync = (): void => {
    if (d.sync.status() === "offline") void d.sync.pull().then(d.adopt);
    else openLogin(d.sync, d.adopt);
  };

  // a paused run shows its last answered gate with that item's study card
  const pauseCard = (): void => {
    const scene = d.scene();
    // meaning mode: no card (it shows readings), the plain "Paused" instead
    if (scene.kind !== "run" || !scene.paused || d.session().meaning)
      return syncPauseCard(null, "", () => {});
    const { run } = scene;
    const last = lastAnswer(
      run.rows,
      run.results,
      run.lastAnswer?.choice ?? -1,
      kanjiList(),
      KANA,
      stories(),
      WORDS,
    );
    syncPauseCard(last, `${scene.seed}:${run.results.length}`, () =>
      d.act("pause"),
    );
  };

  return {
    wk,
    anyOpen: () =>
      studyOpen() || tokenFormOpen() || loginOpen() || settingsOpen(),
    speed: () => speed,
    openSettings: () =>
      openSettings({
        view: () => ({
          speed,
          wkLabel: wk.view().label,
          hasToken: wk.token() !== null,
          sync: !d.session().meaning ? d.sync.status() : null,
        }),
        onSpeed: (s) => {
          speed = s;
          saveSpeed(store, speed);
        },
        onToken: () => openToken(),
        onSync: openSync,
        build: __BUILD__,
      }),
    openToken,
    openSync,
    openStudy: () => {
      const scene = d.scene();
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
        stories(),
        runKanji(run.rows, run.results),
        WORDS,
      );
      // its Play again is the end screen's: a new run straight away
      openStudy(cards, () => d.act("confirm"));
    },
    studyAvailable,
    sync: () => {
      pauseCard();
      syncSettings();
    },
  };
}
