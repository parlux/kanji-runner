import { bossSize, bossWon } from "../core/boss";
import {
  applyUnlock,
  groupOf,
  levelCard,
  maxLevel,
  place,
  placeMeaning,
  type LevelCard,
} from "../core/progression";
import { mergeProgress } from "../core/merge";
import { levelPage, type LevelPage } from "../core/levelpage";
import { overall, type Overall } from "../core/overall";
import { builtInPool, meaningPool, wanikaniPool } from "../core/pool";
import { reaskRun } from "../core/reask";
import { buildPoolRun, missedItems } from "../core/run";
import { canStudy, runKanji } from "../core/study";
import { WORDS } from "../core/words";
import { KANA } from "../core/kana";
import { KANJI } from "../core/kanji";
import {
  createRunState,
  nudgeTarget,
  plannedRows,
  stepRun,
  type RunState,
} from "../core/sim";
import { enemiesWon } from "../core/horde";
import { buildTrack } from "../core/track";
import { runItems, type RunItem } from "../core/runitems";
import { recordRun } from "../core/srs";
import {
  CHEER_SECONDS,
  CLASH_APPROACH_SECONDS,
  CLASH_HOLD_SECONDS,
  CLASH_SECONDS,
  ROWS_PER_RUN,
  STEER_MAX_SPEED,
} from "../core/tuning";
import type { KanaItem, Progress, WordItem } from "../core/types";
import type { WkList } from "../wanikani/parse";
import { endListArea, endListLayout } from "./endlist";
import type { Action } from "./input";
import {
  clampScroll,
  levelPageHit,
  levelPageLayout,
  progressHit,
  progressLayout,
  resolveScroll,
  scrollBy,
  type LevelPageHit,
} from "./progress";

export type Scene =
  /** `pick` is set while the placement picker is open: "I know up to level pick". */
  | { kind: "start"; pick?: number }
  /** `cheer`: seconds the enemies have cheered since they wiped the army out (the run is over; the end screen follows). */
  | {
      kind: "run";
      seed: number;
      run: RunState;
      paused: boolean;
      cheer?: number;
    }
  /** The clash after the last question: `t` seconds in, against a boss of `boss` units. Pausable like a run. */
  | {
      kind: "boss";
      seed: number;
      run: RunState;
      boss: number;
      t: number;
      paused?: boolean;
    }
  /**
   * The overall view: `view` is computed on opening and when a group is
   * toggled; `scroll` is the list's offset (px), null until first scrolled
   * (see `resolveScroll`); `expanded` the groups opened by a tap (not saved).
   * `page` is the level page open on top, with its own scroll.
   */
  | {
      kind: "progress";
      view: Overall;
      scroll: number | null;
      expanded: number[];
      page?: { view: LevelPage; scroll: number };
    }
  /** `boss` is null when the army died before reaching the boss. */
  | {
      kind: "end";
      seed: number;
      run: RunState;
      boss: BossResult | null;
      /** The item list's scroll offset (px); 0 when missing. */
      scroll?: number;
    };

/** How the boss clash went: the boss's size and whether the army won (a tie is a loss). */
export type BossResult = { size: number; won: boolean };

/** What runs are built from this page load, and whether results are saved. */
export type Session = {
  progress: Progress;
  kana: readonly KanaItem[];
  /** The level the last run unlocked, shown until the next run starts. */
  unlocked: number | null;
  /**
   * The progress just before the last run, kept for the end screen's level
   * card (`endLevelCard`); null before the first run and once a new run starts.
   */
  before: Progress | null;
  /** The taught WaniKani kanji when runs use WaniKani mode, else null (Built-in). */
  wk: WkList | null;
  /**
   * "Meanings only": kanji meaning gates of the Built-in list, its own save,
   * never synced, no reveal or study cards.
   */
  meaning: boolean;
};

/** A session plays and saves the stored progress (in "Meanings only": its own save). */
export function createSession(stored: Progress, meaning = false): Session {
  return {
    progress: stored,
    kana: meaning ? [] : KANA,
    unlocked: null,
    before: null,
    wk: null,
    meaning,
  };
}

/**
 * The session with synced progress merged in. Merging (not replacing) keeps a
 * run that finished while the sync was in flight. Meaning mode never syncs: synced (the owner's) progress is never adopted into it.
 */
export function adoptProgress(session: Session, synced: Progress): Session {
  if (session.meaning) return session;
  return { ...session, progress: mergeProgress(session.progress, synced) };
}

/**
 * The words that count toward a level: Built-in mode's; none in WaniKani or
 * Meaning mode (they ask no words).
 */
export const levelWords = (session: Session): readonly WordItem[] =>
  session.meaning || session.wk ? [] : WORDS;

/**
 * A new run. WaniKani runs have re-asks on (built with `reaskRun`, same rows
 * as `buildPoolRun`); Built-in runs have none and are unchanged.
 */
function newRun(seed: number, session: Session): Scene {
  const track = buildTrack(seed, ROWS_PER_RUN);
  const { progress, kana, wk } = session;
  let run: RunState;
  if (session.meaning) {
    const pool = meaningPool(progress, KANJI);
    run = createRunState(buildPoolRun(seed, progress, pool), track, null);
  } else if (wk) {
    const pool = wanikaniPool(progress, kana, wk);
    const { rows, reask } = reaskRun(seed, progress, pool);
    run = createRunState(rows, track, reask);
  } else {
    const pool = builtInPool(progress, kana, KANJI, WORDS);
    run = createRunState(buildPoolRun(seed, progress, pool), track, null);
  }
  return { kind: "run", seed, run, paused: false };
}

/**
 * The session after one update step: if `prev → next` just left the run (to
 * the boss, or to the end screen if the army died), its answers go into the
 * SRS and the run stats, then the unlock rule runs. The SRS updates whatever
 * the boss outcome; only beating the boss counts as a win. Otherwise the same
 * session.
 */
export function afterStep(
  session: Session,
  prev: Scene,
  next: Scene,
  now: number,
): Session {
  if (prev.kind !== "run" || (next.kind !== "boss" && next.kind !== "end"))
    return session;
  const { rows, results, army, reask } = next.run;
  const won = next.kind === "boss" && bossWon(army, next.boss);
  const progress = applyUnlock(
    recordRun(session.progress, rows, results, won, now, reask ?? undefined),
    session.kana,
    KANJI,
    levelWords(session),
    session.meaning,
  );
  const gained = progress.unlockedLevel > session.progress.unlockedLevel;
  return {
    ...session,
    progress,
    unlocked: gained ? progress.unlockedLevel : null,
    before: session.progress,
  };
}

/**
 * The end screen's level card for the last run (see `levelCard`); counts the
 * same way as the start screen's level bar. Without a run behind it, nothing gained.
 */
export function endLevelCard(session: Session): LevelCard {
  return levelCard(
    session.before ?? session.progress,
    session.progress,
    session.kana,
    KANJI,
    levelWords(session),
    session.meaning,
  );
}

let itemsCache: {
  run: RunState;
  before: Progress | null;
  items: RunItem[];
} | null = null;

/**
 * Every item met in the last run, with how it moved (`runItems`), from the
 * mode's own kanji and words. Cached per run: the end screen asks every frame.
 */
export function endItems(run: RunState, session: Session): RunItem[] {
  if (itemsCache?.run === run && itemsCache.before === session.before)
    return itemsCache.items;
  const items = runItems(
    session.before ?? session.progress,
    session.progress,
    run.rows,
    run.results,
    session.kana,
    session.wk?.kanji ?? KANJI,
    levelWords(session),
  );
  itemsCache = { run, before: session.before, items };
  return items;
}

/** How far the end screen's item list scrolls, at this screen size. */
export function endScrollMax(
  w: number,
  h: number,
  scene: Extract<Scene, { kind: "end" }>,
  session: Session,
): number {
  const { top, bottom } = endListArea(
    w,
    h,
    endLevelCard(session),
    studyOffered(scene.run, scene.boss, session),
  );
  return endListLayout(top, bottom, endItems(scene.run, session)).maxScroll;
}

/**
 * Whether the end screen offers Study: what `canStudy` says about the run's
 * misses and kanji. Never in meaning mode (its cards show readings).
 */
export function studyOffered(
  run: RunState,
  boss: BossResult | null,
  session: Session,
): boolean {
  if (session.meaning) return false;
  const misses = missedItems(
    run.rows,
    run.results,
    run.track.charges,
    session.wk?.kanji ?? KANJI,
  );
  return canStudy(
    misses.length + runKanji(run.rows, run.results).length,
    boss?.won ?? false,
  );
}

/**
 * The start screen: `confirm` starts a run; ←/→ or `place` open the placement
 * picker at the current placement (unlocked level − 1, −1 = none). In the
 * picker ←/→ change the pick (`leftTen`/`rightTen` by 10), `confirm` applies
 * it, `back` closes it.
 */
function startAction(
  scene: Extract<Scene, { kind: "start" }>,
  action: Action,
  newSeed: () => number,
  session: Session,
): { scene: Scene; session: Session } {
  const { pick } = scene;
  if (pick === undefined) {
    if (action === "confirm") {
      const next = { ...session, unlocked: null, before: null };
      return { scene: newRun(newSeed(), next), session: next };
    }
    if (action === "progress") return { scene: openProgress(session), session };
    // placement is off in WaniKani mode: WaniKani's level gates the pool
    if (
      !session.wk &&
      (action === "left" || action === "right" || action === "place")
    )
      return {
        scene: { kind: "start", pick: session.progress.unlockedLevel - 1 },
        session,
      };
    return { scene, session };
  }
  const top = maxLevel(KANJI) - 1;
  // meaning mode has no kana levels: its lowest pick (1, "none") starts at Kanji 1
  const bottom = session.meaning ? 1 : -1;
  switch (action) {
    case "left":
    case "right":
    case "leftTen":
    case "rightTen": {
      const step = { left: -1, right: 1, leftTen: -10, rightTen: 10 }[action];
      const next = pick + step;
      return {
        scene: { kind: "start", pick: Math.max(bottom, Math.min(top, next)) },
        session,
      };
    }
    case "confirm":
    case "place":
      return {
        scene: { kind: "start" },
        session: {
          ...session,
          progress: session.meaning
            ? placeMeaning(session.progress, pick, KANJI)
            : place(session.progress, pick, KANA, KANJI, WORDS),
        },
      };
    case "back":
      return { scene: { kind: "start" }, session };
    default:
      return { scene, session };
  }
}

/** The overall view's data with `expanded` groups open. */
const overallOf = (session: Session, expanded: readonly number[]): Overall =>
  overall(
    session.progress,
    session.kana,
    KANJI,
    levelWords(session),
    session.meaning,
    expanded,
  );

/** The overall view of the session's progress, scrolled to the current level. */
const openProgress = (session: Session): Scene => ({
  kind: "progress",
  view: overallOf(session, []),
  scroll: null,
  expanded: [],
});

type ProgressScene = Extract<Scene, { kind: "progress" }>;

/**
 * An item tapped on the level page (its key and kind), for its study card.
 * The hook for opening it: nothing acts on it yet.
 */
export type StudyRequest = Extract<LevelPageHit, { kind: "item" }>["item"];

/**
 * A tap at (x, y) on the overall view or its level page. Overall view: Back →
 * start screen; a group row other than the current group toggles it (the
 * scroll is pinned first, so rows above don't jump); a level row opens its
 * level page. Level page: Back → the overall view as it was; an item row → a
 * `study` request, the scene unchanged.
 */
export function progressTap(
  scene: ProgressScene,
  w: number,
  h: number,
  x: number,
  y: number,
  session: Session,
): { scene: Scene; study: StudyRequest | null } {
  const { page } = scene;
  if (page) {
    const hit = levelPageHit(w, h, page.view, page.scroll, x, y);
    if (hit?.kind === "back") return { scene: closePage(scene), study: null };
    return { scene, study: hit?.kind === "item" ? hit.item : null };
  }
  const hit = progressHit(w, h, scene.view, scene.scroll, x, y);
  if (hit?.kind === "back") return { scene: { kind: "start" }, study: null };
  if (hit?.kind === "level") {
    const view = levelPage(
      session.progress,
      hit.level,
      session.kana,
      KANJI,
      levelWords(session),
      session.meaning,
    );
    return { scene: { ...scene, page: { view, scroll: 0 } }, study: null };
  }
  if (hit?.kind === "group" && hit.group !== groupOf(scene.view.level)) {
    const { expanded } = scene;
    const next = expanded.includes(hit.group)
      ? expanded.filter((g) => g !== hit.group)
      : [...expanded, hit.group];
    const max = progressLayout(w, h, scene.view).maxScroll;
    return {
      scene: {
        ...scene,
        view: overallOf(session, next),
        expanded: next,
        scroll: resolveScroll(scene.scroll, max),
      },
      study: null,
    };
  }
  return { scene, study: null };
}

/** The overall view under the level page, at its scroll and expanded groups. */
const closePage = (scene: ProgressScene): Scene => {
  const { view, scroll, expanded } = scene;
  return { kind: "progress", view, scroll, expanded };
};

/** The overall view or its level page scrolled by `dy` px (positive = further down). */
export function scrollProgress(
  scene: ProgressScene,
  dy: number,
  w: number,
  h: number,
): Scene {
  const { page } = scene;
  if (page) {
    const max = levelPageLayout(w, h, page.view).maxScroll;
    return {
      ...scene,
      page: { ...page, scroll: clampScroll(page.scroll + dy, max) },
    };
  }
  const max = progressLayout(w, h, scene.view).maxScroll;
  return { ...scene, scroll: scrollBy(scene.scroll, dy, max) };
}

/** The scene, and the session (placement changes progress), after an action. */
export function handleAction(
  scene: Scene,
  action: Action,
  newSeed: () => number,
  session: Session,
): { scene: Scene; session: Session } {
  switch (scene.kind) {
    case "start":
      return startAction(scene, action, newSeed, session);
    // Back (Esc) closes the level page, else returns to the start screen
    case "progress":
      return {
        scene:
          action !== "back"
            ? scene
            : scene.page
              ? closePage(scene)
              : { kind: "start" },
        session,
      };
    case "boss":
      return {
        scene: action === "pause" ? { ...scene, paused: !scene.paused } : scene,
        session,
      };
    // Play again starts the next run as the start screen's Play does; Home goes back
    case "end":
      if (action === "confirm")
        return startAction({ kind: "start" }, action, newSeed, session);
      return {
        scene: action === "back" ? { kind: "start" } : scene,
        session,
      };
    case "run":
      return {
        scene: action === "pause" ? { ...scene, paused: !scene.paused } : scene,
        session,
      };
  }
}

/**
 * `steer` is the held axis (-1, 0 or 1); holding moves the target at STEER_MAX_SPEED.
 * `dragDx` is target movement from drag, in track units.
 * `pace` is the speed preset's multiplier on the scroll.
 */
export function updateScene(
  scene: Scene,
  dt: number,
  steer: number,
  dragDx = 0,
  pace = 1,
): Scene {
  if (scene.kind === "boss")
    return scene.paused ? scene : stepBoss(scene, dt, steer, dragDx);
  if (scene.kind !== "run" || scene.paused) return scene;
  const { seed } = scene;
  if (scene.cheer !== undefined) {
    const cheer = scene.cheer + dt;
    return cheer >= CHEER_SECONDS
      ? { kind: "end", seed, run: scene.run, boss: null }
      : { ...scene, cheer };
  }
  const dx = steer * STEER_MAX_SPEED * dt + dragDx;
  let run = dx ? nudgeTarget(scene.run, dx) : scene.run;
  run = stepRun(run, dt, pace);
  // wiped out in a melee: the enemies cheer first
  if (run.status === "dead")
    return enemiesWon(run)
      ? { ...scene, run, cheer: 0 }
      : { kind: "end", seed, run, boss: null };
  if (run.status === "finished")
    return {
      kind: "boss",
      seed,
      run,
      boss: bossSize(plannedRows(run), run.track.charges, seed),
      t: 0,
    };
  return { ...scene, run };
}

/**
 * Steering after the run is finished, look-only: the run's own target nudge and
 * easing (sim's, so same speed and clamp), run for a step that doesn't scroll.
 * Only `targetX` and `x` are taken from it.
 */
function steerOnly(run: RunState, dt: number, dx: number): RunState {
  const live = { ...run, status: "running" as const };
  const { x, targetX } = stepRun(dx ? nudgeTarget(live, dx) : live, dt, 0);
  return x === run.x && targetX === run.targetX ? run : { ...run, x, targetX };
}

/** The sides close in, the clash plays out, the result holds, then the end screen. */
function stepBoss(
  scene: Extract<Scene, { kind: "boss" }>,
  dt: number,
  steer: number,
  dragDx: number,
): Scene {
  const t = scene.t + dt;
  const run = steerOnly(scene.run, dt, steer * STEER_MAX_SPEED * dt + dragDx);
  if (t < CLASH_APPROACH_SECONDS + CLASH_SECONDS + CLASH_HOLD_SECONDS)
    return { ...scene, run, t };
  const { seed, boss } = scene;
  return {
    kind: "end",
    seed,
    run,
    boss: { size: boss, won: bossWon(run.army, boss) },
  };
}
