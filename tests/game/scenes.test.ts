import { describe, expect, it } from "vitest";
import { KANA } from "../../src/core/kana";
import { KANJI } from "../../src/core/kanji";
import { levelKeys } from "../../src/core/progression";
import { crowdWidth } from "../../src/core/crowd";
import { bossSize } from "../../src/core/boss";
import { builtInPool, wanikaniPool } from "../../src/core/pool";
import { buildPoolRun, missedItems } from "../../src/core/run";
import type { SessionLog } from "../../src/core/session";
import { studyCards } from "../../src/core/study";
import { itemKey, defaultProgress } from "../../src/core/srs";
import {
  plannedRows,
  rowOpenings,
  setTarget,
  type RunState,
} from "../../src/core/sim";
import { CLASH_SECONDS, REASK_MAX_BOX } from "../../src/core/tuning";
import { syntheticList } from "../core/wk-fixture";
import { STEP } from "../../src/game/loop";
import {
  adoptProgress,
  afterStep,
  createSession,
  devLevel,
  handleAction,
  updateScene,
  type Scene,
  type Session,
} from "../../src/game/scenes";
import type { Action } from "../../src/game/input";
import {
  startLayout,
  startTap,
  syncLabel,
  syncTap,
} from "../../src/game/start";

describe("dev level flag", () => {
  it("reads ?level=N for N ≥ 2 and ignores anything else", () => {
    expect(devLevel("?level=4")).toBe(4);
    expect(devLevel("")).toBeNull();
    expect(devLevel("?level=1")).toBeNull();
    expect(devLevel("?level=abc")).toBeNull();
  });

  it("a dev session is kanji-only at that level and never saved", () => {
    const stored = defaultProgress();
    const dev = createSession(stored, 3);
    expect(dev).toMatchObject({ persist: false, kana: [] });
    expect(dev.progress.unlockedLevel).toBe(3);
    expect(stored.unlockedLevel).toBe(0);
    expect(createSession(stored, null).persist).toBe(true);
  });

  it("a WaniKani session asks only its taught kanji and has no placement", () => {
    const start = { kind: "start" } as const;
    const wk = syntheticList(30) as unknown as NonNullable<Session["wk"]>;
    const session = { ...createSession(defaultProgress(), null), wk };
    const chars = new Set(wk.kanji.map((k) => k.char));
    const run = handleAction(start, "confirm", () => 5, session).scene;
    if (run.kind !== "run") throw new Error("no run");
    const kanjiRows = run.run.rows.filter((r) => r.type !== "kana");
    expect(kanjiRows.length).toBeGreaterThan(0);
    expect(kanjiRows.every((r) => chars.has(r.prompt))).toBe(true);
    for (const a of ["place", "left", "right"] as const)
      expect(handleAction(start, a, () => 1, session).scene).toEqual(start);
  });

  it("starts a kanji run when set, a kana run otherwise", () => {
    const start = { kind: "start" } as const;
    const stored = defaultProgress();
    const kanji = handleAction(
      start,
      "confirm",
      () => 1,
      createSession(stored, 3),
    ).scene;
    const kana = handleAction(
      start,
      "confirm",
      () => 1,
      createSession(stored, null),
    ).scene;
    if (kanji.kind !== "run" || kana.kind !== "run") throw new Error("no run");
    expect(kanji.run.rows.every((r) => r.type !== "kana")).toBe(true);
    expect(kana.run.rows.every((r) => r.type === "kana")).toBe(true);
  });
});

describe("afterStep", () => {
  const session = createSession(defaultProgress(), null);
  const run = handleAction(
    { kind: "start" },
    "confirm",
    () => 7,
    session,
  ).scene;
  if (run.kind !== "run") throw new Error("no run");

  it("records the run's answers when a run ends", () => {
    const ended: Scene = {
      kind: "end",
      seed: 7,
      boss: null,
      run: { ...run.run, results: [true, false], status: "dead" },
    };
    const after = afterStep(session, run, ended, 99);
    const [a, b] = run.run.rows;
    if (!a || !b) throw new Error("no rows");
    expect(after.progress.stats).toEqual({ runs: 1, wins: 0, losses: 1 });
    // a fresh run can ask the same kana twice in a row; check the sum
    const seen = Object.values(after.progress.items).reduce(
      (n, i) => n + i.seen,
      0,
    );
    expect(seen).toBe(2);
    expect(after.progress.items[`${a.prompt}:kana`]?.lastSeen).toBe(99);
  });

  it("changes nothing on any other step", () => {
    expect(afterStep(session, run, run, 1)).toBe(session);
    expect(afterStep(session, { kind: "start" }, run, 1)).toBe(session);
  });

  it("unlocks the next level when a run brings it to 80%", () => {
    // 23/30 of Kanji 1 learned; the run's answers push one more to box 2
    const progress = { ...defaultProgress(), unlockedLevel: 2 };
    const keys = levelKeys(2, KANA, KANJI);
    keys.forEach((k, i) => {
      progress.items[k] = {
        box: i < 23 ? 2 : 1,
        seen: 1,
        correct: 1,
        wrong: 0,
        lastSeen: 1,
      };
    });
    const s = { ...createSession(progress, null), progress };
    const row = {
      type: "meaning" as const,
      prompt: (keys[29] as string).split(":")[0] as string,
      options: ["a", "b"],
      answerIndex: 0,
      answer: "a",
    };
    const ended: Scene = {
      kind: "end",
      seed: 7,
      boss: null,
      run: { ...run.run, rows: [row], results: [true], status: "finished" },
    };
    const after = afterStep(s, run, ended, 5);
    expect(after.progress.unlockedLevel).toBe(3);
    expect(after.unlocked).toBe(3);
    // the next step on the same session reports no new unlock
    expect(afterStep(after, run, ended, 6).unlocked).toBeNull();
    // starting the next run clears the message
    const start = handleAction({ kind: "start" }, "confirm", () => 1, after);
    expect(start.session.unlocked).toBeNull();
  });

  it("reports no unlock when the level does not change", () => {
    const ended: Scene = {
      kind: "end",
      seed: 7,
      boss: null,
      run: { ...run.run, results: [true], status: "dead" },
    };
    expect(afterStep(session, run, ended, 1).unlocked).toBeNull();
  });
});

describe("end screen", () => {
  const session = createSession(defaultProgress(), null);
  const end = (): Scene => {
    const run = handleAction(
      { kind: "start" },
      "confirm",
      () => 7,
      session,
    ).scene;
    if (run.kind !== "run") throw new Error("no run");
    return { kind: "end", seed: 7, run: run.run, boss: null };
  };

  it("confirm (Enter or tap) returns to the start screen, not a new run", () => {
    const r = handleAction(end(), "confirm", () => 1, session);
    expect(r.scene).toEqual({ kind: "start" });
    expect(r.session).toBe(session);
  });

  it("other actions leave the end screen alone", () => {
    const e = end();
    expect(handleAction(e, "left", () => 1, session).scene).toBe(e);
  });

  it("a tap and then a tap again starts the next run", () => {
    const first = handleAction(end(), "confirm", () => 1, session);
    const second = handleAction(first.scene, "confirm", () => 1, first.session);
    expect(second.scene.kind).toBe("run");
  });
});

describe("placement picker", () => {
  const fresh = createSession(defaultProgress(), null);
  const act = (
    scene: Scene,
    session: Session,
    ...actions: Action[]
  ): { scene: Scene; session: Session } =>
    actions.reduce((r, a) => handleAction(r.scene, a, () => 1, r.session), {
      scene,
      session,
    });

  it("opens at the current placement, moves, and applies on confirm", () => {
    const opened = act({ kind: "start" }, fresh, "place");
    expect(opened.scene).toEqual({ kind: "start", pick: -1 });
    expect(opened.session).toBe(fresh);
    const placed = act(opened.scene, fresh, "right", "right", "confirm");
    expect(placed.scene).toEqual({ kind: "start" });
    expect(placed.session.progress.unlockedLevel).toBe(2);
    // the next run is a kanji level run
    const run = act(placed.scene, placed.session, "confirm").scene;
    if (run.kind !== "run") throw new Error("no run");
    expect(run.run.rows.some((r) => r.type === "meaning")).toBe(true);
  });

  it("clamps the pick and cancels without changing progress", () => {
    const low = act({ kind: "start", pick: -1 }, fresh, "left");
    expect(low.scene).toEqual({ kind: "start", pick: -1 });
    const high = act({ kind: "start", pick: 72 }, fresh, "right");
    expect(high.scene).toEqual({ kind: "start", pick: 72 });
    const back = act({ kind: "start", pick: 5 }, fresh, "back");
    expect(back).toEqual({ scene: { kind: "start" }, session: fresh });
  });

  it("re-opens at the placed level, so re-picking lower is easy", () => {
    const placed = act({ kind: "start" }, fresh, "place", "right", "confirm");
    expect(placed.session.progress.unlockedLevel).toBe(1);
    expect(act(placed.scene, placed.session, "left").scene).toEqual({
      kind: "start",
      pick: 0,
    });
  });
});

describe("start screen taps", () => {
  const W = 390;
  const H = 844;
  const l = startLayout(W, H);
  const mid = (r: { x: number; y: number; w: number; h: number }) =>
    [r.x + r.w / 2, r.y + r.h / 2] as const;

  it("the placement button opens the picker; elsewhere starts a run", () => {
    expect(startTap(false, W, H, ...mid(l.place))).toBe("place");
    expect(startTap(false, W, H, W / 2, H / 2)).toBe("confirm");
  });

  it("in the picker only its buttons act", () => {
    expect(startTap(true, W, H, ...mid(l.minus))).toBe("left");
    expect(startTap(true, W, H, ...mid(l.plus))).toBe("right");
    expect(startTap(true, W, H, ...mid(l.apply))).toBe("confirm");
    expect(startTap(true, W, H, ...mid(l.cancel))).toBe("back");
    expect(startTap(true, W, H, ...mid(l.place))).toBeNull();
    expect(startTap(true, W, H, 5, 5)).toBeNull();
  });
});

describe("boss", () => {
  const session = createSession(defaultProgress(), null);
  const start = handleAction({ kind: "start" }, "confirm", () => 7, session);
  if (start.scene.kind !== "run") throw new Error("no run");
  const run = start.scene;
  const rows = run.run.rows;
  const allRight = rows.map(() => true);
  // one step from the last wall: the next update finishes the run
  const lastRow = run.run.track.questions.at(-1) ?? 0;
  const almost: Scene = {
    ...run,
    run: {
      ...run.run,
      dist: lastRow - 1e-6,
      next: rows.length - 1,
      nextHazard: run.run.track.hazards.length,
      results: allRight.slice(1),
      army: 50,
    },
  };

  it("plays after the last question, sized for this run and seed", () => {
    const next = updateScene(almost, STEP, 0);
    if (next.kind !== "boss") throw new Error(`got ${next.kind}`);
    expect(next.t).toBe(0);
    expect(next.boss).toBe(bossSize(rows, run.run.track.charges, 7));
  });

  it("leads to the end screen with the result once the clash is over", () => {
    const boss: Scene = { kind: "boss", seed: 7, run: run.run, boss: 3, t: 0 };
    let s: Scene = boss;
    let steps = 0;
    while (s.kind === "boss") {
      s = updateScene(s, STEP, 0);
      steps++;
    }
    expect(steps * STEP).toBeGreaterThanOrEqual(CLASH_SECONDS);
    expect(s).toMatchObject({
      kind: "end",
      boss: { size: 3, won: run.run.army > 3 },
    });
  });

  it("ignores input during the clash", () => {
    const boss: Scene = { kind: "boss", seed: 7, run: run.run, boss: 3, t: 0 };
    expect(handleAction(boss, "confirm", () => 1, session).scene).toBe(boss);
  });

  it("steers during the clash as in the run, clamped, without changing the result", () => {
    const fin = { ...run.run, status: "finished" as const };
    const boss: Scene = { kind: "boss", seed: 7, run: fin, boss: 3, t: 0 };
    const live: Scene = { ...run, run: { ...fin, status: "running" } };
    let a: Scene = boss;
    let b: Scene = live;
    for (let i = 0; i < 20; i++) {
      a = updateScene(a, STEP, -1);
      b = updateScene(b, STEP, -1);
    }
    if (a.kind !== "boss" || b.kind !== "run") throw new Error("kind");
    expect(a.run.x).toBeLessThan(fin.x);
    expect(a.run.x).toBeCloseTo(b.run.x, 9);
    expect(a.run.dist).toBe(fin.dist);
    // far left: stops at the track edge, a crowd's half width in
    if (a.kind !== "boss") throw new Error("kind");
    let edge = a.run;
    for (let i = 0; i < 100; i++) {
      const n = updateScene({ ...a, t: 0 }, STEP, -1, -1);
      if (n.kind !== "boss") throw new Error("kind");
      a = n;
      edge = n.run;
    }
    const w = crowdWidth(fin.army);
    expect(edge.x).toBeCloseTo(w / 2, 6);
    // same timings and result as unsteered
    const count = (sc: Scene, steer: number): [number, Scene] => {
      let n = 0;
      while (sc.kind === "boss") {
        sc = updateScene(sc, STEP, steer);
        n++;
      }
      return [n, sc];
    };
    const [n0, e0] = count(boss, 0);
    const [n1, e1] = count(boss, 1);
    expect(n1).toBe(n0);
    if (e0.kind !== "end" || e1.kind !== "end") throw new Error("end");
    expect(e1.boss).toEqual(e0.boss);
  });

  it("ignores taps during the clash", () => {
    const boss: Scene = { kind: "boss", seed: 7, run: run.run, boss: 3, t: 0 };
    expect(handleAction(boss, "pause", () => 1, session).scene).toBe(boss);
  });

  const reached = (
    army: number,
    size: number,
  ): Extract<Scene, { kind: "boss" }> => ({
    kind: "boss",
    seed: 7,
    run: { ...run.run, army, results: allRight, status: "finished" },
    boss: size,
    t: 0,
  });

  it("updates the review boxes whatever the outcome; only a boss win is a win", () => {
    const win = afterStep(session, run, reached(60, 59), 1);
    const loss = afterStep(session, run, reached(10, 59), 1);
    const tie = afterStep(session, run, reached(59, 59), 1);
    expect(win.progress.stats).toEqual({ runs: 1, wins: 1, losses: 0 });
    expect(loss.progress.stats).toEqual({ runs: 1, wins: 0, losses: 1 });
    expect(tie.progress.stats).toEqual({ runs: 1, wins: 0, losses: 1 });
    expect(loss.progress.items).toEqual(win.progress.items);
    expect(Object.keys(loss.progress.items).length).toBeGreaterThan(0);
  });

  it("records the run once: not again when the clash ends", () => {
    const boss = reached(60, 59);
    const after = afterStep(session, run, boss, 1);
    const end = updateScene({ ...boss, t: 99 }, STEP, 0);
    expect(end.kind).toBe("end");
    expect(afterStep(after, boss, end, 2)).toBe(after);
  });
});

describe("sync label", () => {
  const W = 390;
  const H = 844;
  const r = startLayout(W, H).sync;
  const [x, y] = [r.x + r.w / 2, r.y + r.h / 2];

  it("names each status, and is hidden when sync is disabled", () => {
    expect(syncLabel("synced")).toBe("Synced");
    expect(syncLabel("offline")).toBe("Offline");
    expect(syncLabel("login")).toBe("Log in");
    expect(syncLabel("disabled")).toBeNull();
  });

  it("a tap on the label hits it unless sync is disabled", () => {
    expect(syncTap("login", W, H, x, y)).toBe(true);
    expect(syncTap("disabled", W, H, x, y)).toBe(false);
    expect(syncTap("login", W, H, W / 2, H / 2)).toBe(false);
  });

  it("sits clear of the placement button and inside the screen", () => {
    const p = startLayout(W, H).place;
    expect(r.y + r.h).toBeLessThan(p.y);
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.x + r.w).toBeLessThanOrEqual(W);
  });
});

describe("adopting synced progress", () => {
  it("merges, so a run recorded while a sync was in flight is kept", () => {
    const session = createSession(defaultProgress(), null);
    const local = {
      ...session,
      progress: {
        ...session.progress,
        items: { a: { box: 2, seen: 3, correct: 2, wrong: 1, lastSeen: 200 } },
      },
    };
    const remote = {
      ...defaultProgress(),
      unlockedLevel: 3,
      items: { b: { box: 1, seen: 1, correct: 1, wrong: 0, lastSeen: 100 } },
    };
    const next = adoptProgress(local, remote);
    expect(next.progress.unlockedLevel).toBe(3);
    expect(Object.keys(next.progress.items).sort()).toEqual(["a", "b"]);
  });

  it("leaves a dev session alone", () => {
    const dev = createSession(defaultProgress(), 4);
    expect(adoptProgress(dev, { ...defaultProgress(), unlockedLevel: 9 })).toBe(
      dev,
    );
  });
});

describe("re-asks in runs", () => {
  const wk = syntheticList(60) as unknown as NonNullable<Session["wk"]>;
  const wkSession = { ...createSession(defaultProgress(), null), wk };
  const start = { kind: "start" } as const;
  const startRun = (seed: number, session: Session) => {
    const scene = handleAction(start, "confirm", () => seed, session).scene;
    if (scene.kind !== "run") throw new Error("no run");
    return scene;
  };

  /**
   * Plays a run through the scenes, going through the chosen opening of every
   * wall with an army too big to die. Returns the last run scene and the next.
   */
  function play(
    scene: Extract<Scene, { kind: "run" }>,
    wrong: (q: number, run: RunState) => boolean,
  ): { prev: Scene; next: Scene } {
    let s: Scene = { ...scene, run: { ...scene.run, army: 100_000 } };
    for (;;) {
      if (s.kind !== "run") throw new Error("left the run");
      const { run } = s;
      const row = run.rows[run.next];
      const n = row?.options.length ?? 2;
      const answer = row?.answerIndex ?? 0;
      const pick = wrong(run.next, run) ? (answer + 1) % n : answer;
      const aim = rowOpenings(run, run.next)[pick]?.centre ?? 0.5;
      const prev: Scene = { ...s, run: setTarget(run, aim) };
      const next = updateScene(prev, STEP, 0);
      if (next.kind !== "run") return { prev, next };
      s = next;
    }
  }

  it("a Built-in run is unchanged: same seed, same rows, no re-asks", () => {
    for (const session of [
      createSession(defaultProgress(), null),
      createSession(defaultProgress(), 3),
    ])
      for (const seed of [1, 7, 42]) {
        const { run } = startRun(seed, session);
        const { progress, kana } = session;
        const pool = builtInPool(progress, kana, KANJI);
        expect(run.rows).toEqual(buildPoolRun(seed, progress, pool));
        expect(run.reask).toBeNull();
      }
  });

  it("a WaniKani run has re-asks on, with buildPoolRun's rows", () => {
    for (const seed of [1, 7, 42]) {
      const { run } = startRun(seed, wkSession);
      const { progress, kana } = wkSession;
      const pool = wanikaniPool(progress, kana, wk);
      expect(run.rows).toEqual(buildPoolRun(seed, progress, pool));
      expect(run.reask).not.toBeNull();
    }
  });

  it("a missed kanji comes back 3–5 rows later as a 3-answer wall; the boss is sized from the planned rows", () => {
    const scene = startRun(3, wkSession);
    const { next } = play(scene, (q) => q === 0);
    if (next.kind !== "boss") throw new Error(`got ${next.kind}`);
    const link = next.run.reask?.links.find((l) => l.of === 0);
    if (!link) throw new Error("no re-ask of row 0");
    expect(link.row - link.of).toBeGreaterThanOrEqual(3);
    expect(link.row - link.of).toBeLessThanOrEqual(5);
    const [first, again] = [next.run.rows[0], next.run.rows[link.row]];
    expect(again?.prompt).toBe(first?.prompt);
    expect(again?.type).toBe(first?.type);
    expect(again?.options).toHaveLength(3);
    expect(next.boss).toBe(
      bossSize(plannedRows(next.run), next.run.track.charges, 3),
    );
  });

  it("the summary lists a missed re-ask as its own question; study has one card", () => {
    const { next } = play(startRun(3, wkSession), (q, run) => {
      const of = run.reask?.links.find((l) => l.row === q)?.of;
      return q === 0 || of === 0;
    });
    if (next.kind === "start") throw new Error("no end");
    const { rows, results, track } = next.run;
    const link = next.run.reask?.links.find((l) => l.of === 0);
    if (!link) throw new Error("no re-ask of row 0");
    const missed = missedItems(rows, results, track.charges, wk.kanji);
    const again = missed.find((m) => m.q === link.row + 1);
    expect(missed[0]?.q).toBe(1);
    expect(again?.prompt).toBe(missed[0]?.prompt);
    expect(again?.type).toBe(missed[0]?.type);
    expect(again?.answers).toEqual(missed[0]?.answers);
    const cards = studyCards(missed, wk.kanji, KANA);
    expect(cards.filter((c) => c.char === missed[0]?.prompt)).toHaveLength(1);
  });

  it("after a WaniKani run, records follow the pair table", () => {
    const cases = new Set<string>();
    for (const seed of Array.from({ length: 30 }, (_, i) => i)) {
      // miss row 0; miss its re-ask on every 3rd seed, other re-asks on odd seeds
      const wrong = (q: number, run: RunState) => {
        const of = run.reask?.links.find((l) => l.row === q)?.of;
        if (of === undefined) return q === 0;
        return of === 0 ? seed % 3 === 0 : seed % 2 === 1;
      };
      const { prev, next } = play(startRun(seed, wkSession), wrong);
      if (next.kind === "start") throw new Error("no end");
      const after = afterStep(wkSession, prev, next, 50);
      const { rows, results } = next.run;
      const reask = next.run.reask;
      if (!reask) throw new Error("no re-asks");
      const { links, startBoxes, planned } = reask;
      const keys = planned.map((r) => itemKey(r.prompt, r.type));
      const once = (k: string) => keys.filter((x) => x === k).length === 1;
      const asked = rows.map((r) => itemKey(r.prompt, r.type));
      results.forEach((ok, i) => {
        const key = asked[i] as string;
        if (!once(key) || links.some((l) => l.row === i)) return;
        const start = startBoxes[i] as number;
        const link = links.find((l) => l.of === i);
        const item = after.progress.items[key];
        let box: number;
        if (link) {
          const again = results[link.row] as boolean;
          box = ok && again ? Math.min(5, start + 1) : 0;
          cases.add(`${ok}/${again}`);
          expect(item?.seen).toBe(2);
          expect(item?.correct).toBe(Number(ok) + Number(again));
        } else {
          box = !ok
            ? 0
            : start <= REASK_MAX_BOX
              ? start
              : Math.min(5, start + 1);
          cases.add(!ok ? "wrong" : start <= REASK_MAX_BOX ? "weak" : "known");
          expect(item?.seen).toBe(1);
        }
        expect(item?.box, `seed ${seed} row ${i}`).toBe(box);
        expect(item?.lastSeen).toBe(50);
      });
      // a replaced row's item gets no record
      for (const l of links) {
        const key = keys[l.row] as string;
        if (once(key) && !asked.includes(key))
          expect(after.progress.items[key]).toBeUndefined();
      }
    }
    for (const c of [
      "true/true",
      "true/false",
      "false/true",
      "false/false",
      "weak",
      "known",
    ])
      expect(cases).toContain(c);
  });
});

describe("session log in the session", () => {
  const stored: SessionLog = {
    startedAt: 1,
    lastRunAt: 2,
    runs: 1,
    items: [],
    fixedThisRun: [],
  };
  const endOf = (s: Session, kind: "end" | "boss", ok: boolean) => {
    const run = handleAction({ kind: "start" }, "confirm", () => 7, s).scene;
    if (run.kind !== "run") throw new Error("no run");
    const results = run.run.rows.map(() => ok);
    const done = { ...run.run, results };
    const next: Scene =
      kind === "end"
        ? { kind: "end", seed: 7, boss: null, run: { ...done, status: "dead" } }
        : ({ kind: "boss", seed: 7, run: done } as unknown as Scene);
    return { run, next };
  };

  it("starts from the stored log; a dev sandbox ignores it", () => {
    expect(createSession(defaultProgress(), null, stored).log).toBe(stored);
    expect(createSession(defaultProgress(), null).log).toBeNull();
    expect(createSession(defaultProgress(), 3, stored).log).toBeNull();
  });

  it("logs exactly one run per ending, for losses and wins, in both modes", () => {
    for (const level of [null, 3]) {
      const s = createSession(defaultProgress(), level, stored);
      for (const kind of ["end", "boss"] as const) {
        const { run, next } = endOf(s, kind, false);
        const after = afterStep(s, run, next, 1000);
        expect(after.log?.runs).toBe((s.log?.runs ?? 0) + 1);
        expect(after.log?.items.length).toBeGreaterThan(0);
        // a step that is not a run ending leaves the log alone
        expect(afterStep(after, run, run, 1001).log).toBe(after.log);
      }
    }
  });

  it("adoptProgress keeps the log", () => {
    const s = createSession(defaultProgress(), null, stored);
    expect(adoptProgress(s, defaultProgress()).log).toBe(stored);
  });
});
