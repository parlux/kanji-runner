import type { KanjiItem } from "../../core/types";
import type { SpeedPreset } from "../../core/tuning";
import type { Progress } from "../../core/types";
import { KANA } from "../../core/kana";
import { KANJI } from "../../core/kanji";
import { missedItems } from "../../core/run";
import { WORDS } from "../../core/words";
import {
  lastAnswer,
  presentedReadings,
  runKanji,
  storiesWithFallback,
  studyCards,
  withStages,
} from "../../core/study";
import { addFlag } from "../../storage/flags";
import { levelName } from "../../core/progression";
import { loadSpeed, saveSpeed } from "../../storage/speed";
import { loginOpen, openLogin } from "../../sync/login";
import type { Sync } from "../../sync/sync";
import type { Action } from "../input";
import { studyOffered, type Scene, type Session } from "../scenes";
import { createWkState, type WkState } from "../wkstate";
import { createWkClient } from "../../wanikani/client";
import { createStoryStore } from "../../wanikani/storystore";
import { hidePauseCard, syncPauseCard } from "./pausecard";
import { openSettings, settingsOpen, syncSettings } from "./settings";
import { openStudy, studyOpen } from "./study";
import { dictionary, dictionaryReady, loadDictionary } from "../dictionary";
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
  // our level files for these kanji (by the built-in level, whatever the mode)
  const levelsOf = (chars: Iterable<string>): number[] => {
    const out = new Set<number>();
    for (const c of chars) {
      const k = KANJI.find((x) => x.char === c);
      if (k) out.add(k.level);
    }
    return [...out];
  };
  // a flag waits in the local queue, then goes to Supabase when signed in
  const onFlag = (kanji: string, note: string): void => {
    const k = KANJI.find((x) => x.char === kanji);
    addFlag(store, {
      kanji,
      level: k ? levelName(k.level) : "",
      note,
      at: Date.now(),
      build: __BUILD__,
    });
    void d.sync.pushFlags();
  };
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

  const setSpeed = (s: SpeedPreset): void => {
    speed = s;
    saveSpeed(store, speed);
  };

  // a paused run or boss clash shows the pause panel: with an answer, the last
  // answered gate and that item's study card (never in meaning mode: it shows readings)
  const pauseCard = (): void => {
    const scene = d.scene();
    if ((scene.kind !== "run" && scene.kind !== "boss") || !scene.paused)
      return hidePauseCard();
    const { run } = scene;
    const pick = { current: speed, onSpeed: setSpeed };
    const resume = (): void => d.act("pause");
    if (d.session().meaning || run.results.length === 0)
      return syncPauseCard(null, "plain", pick, resume);
    // wait for our stories rather than flash the other card first
    const levels = levelsOf(run.rows.map((r) => r.prompt));
    if (!dictionaryReady(levels)) {
      void loadDictionary(levels);
      return syncPauseCard(null, "plain", pick, resume);
    }
    const last = lastAnswer(
      run.rows,
      run.results,
      run.lastAnswer?.choice ?? -1,
      kanjiList(),
      KANA,
      stories(),
      WORDS,
      dictionary,
    );
    syncPauseCard(
      last,
      `${scene.seed}:${run.results.length}`,
      pick,
      resume,
      onFlag,
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
        onSpeed: setSpeed,
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
        WORDS,
      );
      const seen = runKanji(run.rows, run.results);
      // open once our stories are in (a local chunk, so near-instant): no flash of the other card
      void loadDictionary(
        levelsOf([...missed.map((m) => m.prompt), ...seen]),
      ).then(() => {
        const { progress, meaning } = d.session();
        const cards = studyCards(
          missed,
          kanjiList(),
          KANA,
          stories(),
          seen,
          WORDS,
          presentedReadings(run.rows, run.results),
          dictionary,
        );
        // its Play again is the end screen's: a new run straight away
        openStudy(
          withStages(cards, progress, meaning),
          () => d.act("confirm"),
          onFlag,
        );
      });
    },
    studyAvailable,
    sync: () => {
      pauseCard();
      syncSettings();
    },
  };
}
