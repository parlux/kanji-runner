import { describe, expect, it } from "vitest";
import { KANA } from "../../src/core/kana";
import { KANJI } from "../../src/core/kanji";
import { levelKeys } from "../../src/core/progression";
import { defaultProgress } from "../../src/core/srs";
import {
  afterStep,
  createSession,
  devLevel,
  handleAction,
  type Scene,
  type Session,
} from "../../src/game/scenes";
import type { Action } from "../../src/game/input";
import { startLayout, startTap } from "../../src/game/start";

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
      run: { ...run.run, rows: [row], results: [true], status: "finished" },
    };
    expect(afterStep(s, run, ended, 5).progress.unlockedLevel).toBe(3);
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
