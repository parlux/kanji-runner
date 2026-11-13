import { describe, expect, it } from "vitest";
import { KANJI } from "../../src/core/kanji";
import { meaningProgress } from "../../src/core/progression";
import { defaultProgress } from "../../src/core/srs";
import { syntheticList } from "../core/wk-fixture";
import {
  adoptProgress,
  afterStep,
  createSession,
  handleAction,
  updateScene,
  type Scene,
  type Session,
} from "../../src/game/scenes";
import { persistence } from "../../src/game/mode";
import type { Action } from "../../src/game/input";
import { MEANING_SESSION_KEY, SESSION_KEY } from "../../src/storage/session";
import { MEANING_STORAGE_KEY, STORAGE_KEY } from "../../src/storage/storage";

const act = (
  scene: Scene,
  session: Session,
  ...actions: Action[]
): { scene: Scene; session: Session } =>
  actions.reduce((r, a) => handleAction(r.scene, a, () => 7, r.session), {
    scene,
    session,
  });

const meaning = (): Session =>
  createSession(meaningProgress(), null, null, true);

describe("meaning-mode session", () => {
  it("is kana-free, persisted and Built-in", () => {
    expect(meaning()).toMatchObject({
      meaning: true,
      persist: true,
      kana: [],
      wk: null,
    });
    expect(createSession(defaultProgress(), null).meaning).toBe(false);
    // a dev sandbox is never meaning mode
    expect(createSession(meaningProgress(), 5, null, true)).toMatchObject({
      meaning: false,
      persist: false,
    });
  });

  it("runs ask only kanji meanings of the unlocked levels, even with a WaniKani list", () => {
    const wk = syntheticList(30) as unknown as NonNullable<Session["wk"]>;
    const placed = act({ kind: "start" }, meaning(), "place");
    expect(placed.scene).toEqual({ kind: "start", pick: 1 });
    const high = act(
      placed.scene,
      placed.session,
      ...Array<Action>(20).fill("right"),
      "confirm",
    );
    expect(high.session.progress.unlockedLevel).toBe(22);
    for (const s of [high.session, { ...high.session, wk }]) {
      const run = act({ kind: "start" }, s, "confirm").scene;
      if (run.kind !== "run") throw new Error("no run");
      expect(run.run.rows.length).toBeGreaterThan(0);
      for (const r of run.run.rows) {
        expect(r.type).toBe("meaning");
        const k = KANJI.find((x) => x.char === r.prompt);
        expect(k && k.level <= 22).toBe(true);
      }
    }
  });

  it("the picker has no kana levels: its lowest pick starts at Kanji 1", () => {
    const low = act(
      { kind: "start", pick: 3 },
      meaning(),
      "left",
      "left",
      "left",
      "left",
    );
    expect(low.scene).toEqual({ kind: "start", pick: 1 });
    const applied = act(low.scene, low.session, "confirm");
    expect(applied.session.progress.unlockedLevel).toBe(2);
    expect(
      Object.keys(applied.session.progress.items).some((k) =>
        k.endsWith(":kana"),
      ),
    ).toBe(false);
  });

  it("never adopts synced progress", () => {
    const s = meaning();
    expect(adoptProgress(s, { ...defaultProgress(), unlockedLevel: 9 })).toBe(
      s,
    );
  });

  it("a finished run updates its own progress and log, without kana", () => {
    const s = meaning();
    const start = act({ kind: "start" }, s, "confirm");
    let scene = start.scene;
    for (let i = 0; i < 20000 && scene.kind === "run"; i++) {
      const next = updateScene(scene, 1 / 60, 0);
      if (next.kind !== "run") {
        const after = afterStep(start.session, scene, next, 1000);
        expect(after.meaning).toBe(true);
        expect(after.progress.stats.runs).toBe(1);
        expect(after.log?.runs).toBe(1);
        expect(after.log?.items.every((it) => it.type === "meaning")).toBe(
          true,
        );
      }
      scene = next;
    }
    expect(scene.kind).not.toBe("run");
  });
});

describe("persistence", () => {
  it("owner session: owner keys, synced", () => {
    expect(persistence(createSession(defaultProgress(), null))).toEqual({
      progress: STORAGE_KEY,
      log: SESSION_KEY,
      sync: true,
    });
  });

  it("meaning mode: its own keys, never the owner's, never synced", () => {
    const p = persistence(meaning());
    expect(p).toEqual({
      progress: MEANING_STORAGE_KEY,
      log: MEANING_SESSION_KEY,
      sync: false,
    });
    expect(p?.progress).not.toBe(STORAGE_KEY);
    expect(p?.log).not.toBe(SESSION_KEY);
  });

  it("dev sandbox: nothing", () => {
    expect(persistence(createSession(defaultProgress(), 4))).toBeNull();
  });
});
