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
import {
  modeTap,
  settingsTap,
  startLayout,
  type Rect,
} from "../../src/game/start";
import type { Action } from "../../src/game/input";
import { MEANING_STORAGE_KEY, STORAGE_KEY } from "../../src/storage/storage";
import { NOW } from "../now";

const act = (
  scene: Scene,
  session: Session,
  ...actions: Action[]
): { scene: Scene; session: Session } =>
  actions.reduce((r, a) => handleAction(r.scene, a, () => 7, r.session, NOW), {
    scene,
    session,
  });

const meaning = (): Session => createSession(meaningProgress(), true);

describe("meaning-mode session", () => {
  it("is kana-free and Built-in", () => {
    expect(meaning()).toMatchObject({
      meaning: true,
      kana: [],
      wk: null,
    });
    expect(createSession(defaultProgress()).meaning).toBe(false);
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

  it("a finished run updates its own progress, without kana", () => {
    const s = meaning();
    const start = act({ kind: "start" }, s, "confirm");
    let scene = start.scene;
    for (let i = 0; i < 20000 && scene.kind === "run"; i++) {
      const next = updateScene(scene, 1 / 60, 0);
      if (next.kind !== "run") {
        const after = afterStep(start.session, scene, next, 1000);
        expect(after.meaning).toBe(true);
        expect(after.progress.stats.runs).toBe(1);
      }
      scene = next;
    }
    expect(scene.kind).not.toBe("run");
  });
});

describe("persistence", () => {
  it("owner session: owner keys, synced", () => {
    expect(persistence(createSession(defaultProgress()))).toEqual({
      progress: STORAGE_KEY,
      sync: true,
    });
  });

  it("meaning mode: its own keys, never the owner's, never synced", () => {
    const p = persistence(meaning());
    expect(p).toEqual({
      progress: MEANING_STORAGE_KEY,
      sync: false,
    });
    expect(p?.progress).not.toBe(STORAGE_KEY);
  });
});

describe("the start screen's controls", () => {
  const overlaps = (a: Rect, b: Rect): boolean =>
    a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const mid = (r: Rect) => [r.x + r.w / 2, r.y + r.h / 2] as const;

  it("never overlap, stay on screen, and the switch and settings are hit by a tap", () => {
    for (const [w, h] of [
      [390, 844],
      [390, 667],
      [375, 667],
    ] as const) {
      const l = startLayout(w, h);
      const keys = [
        "settings",
        "sync",
        "modeNormal",
        "modeMeaning",
        "play",
        "place",
        "stamp",
      ] as const;
      for (const a of keys) {
        const r = l[a];
        expect(r.x, `${w}x${h} ${a}`).toBeGreaterThanOrEqual(0);
        expect(r.x + r.w, `${w}x${h} ${a}`).toBeLessThanOrEqual(w);
        expect(r.y + r.h, `${w}x${h} ${a}`).toBeLessThanOrEqual(h);
        for (const b of keys)
          if (a < b)
            expect(overlaps(r, l[b]), `${w}x${h} ${a}/${b}`).toBe(false);
      }
      expect(modeTap(w, h, ...mid(l.modeNormal))).toBe("normal");
      expect(modeTap(w, h, ...mid(l.modeMeaning))).toBe("meaning");
      expect(modeTap(w, h, w / 2, h / 2)).toBeNull();
      expect(settingsTap(w, h, ...mid(l.settings))).toBe(true);
      expect(settingsTap(w, h, w / 2, h / 2)).toBe(false);
    }
  });
});
