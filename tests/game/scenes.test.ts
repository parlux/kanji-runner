import { describe, expect, it } from "vitest";
import { defaultProgress } from "../../src/core/srs";
import {
  afterStep,
  createSession,
  devLevel,
  handleAction,
  type Scene,
} from "../../src/game/scenes";

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
    );
    const kana = handleAction(
      start,
      "confirm",
      () => 1,
      createSession(stored, null),
    );
    if (kanji.kind !== "run" || kana.kind !== "run") throw new Error("no run");
    expect(kanji.run.rows.every((r) => r.type !== "kana")).toBe(true);
    expect(kana.run.rows.every((r) => r.type === "kana")).toBe(true);
  });
});

describe("afterStep", () => {
  const session = createSession(defaultProgress(), null);
  const run = handleAction({ kind: "start" }, "confirm", () => 7, session);
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
});
