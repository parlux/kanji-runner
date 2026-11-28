import { describe, expect, it } from "vitest";
import type { Voice } from "../../src/audio/voice";
import { KANA } from "../../src/core/kana";
import { KANJI } from "../../src/core/kanji";
import { meaningProgress } from "../../src/core/progression";
import type { Spoken } from "../../src/core/speech";
import { defaultProgress, itemKey } from "../../src/core/srs";
import type { Progress } from "../../src/core/types";
import {
  createSession,
  handleAction,
  updateScene,
  type Scene,
  type Session,
} from "../../src/game/scenes";
import { speakStep } from "../../src/game/speak";
import { syntheticList } from "../core/wk-fixture";
import { NOW } from "../now";

/** A voice that logs what it is asked to say. */
function logVoice() {
  const said: Spoken[] = [];
  let prepared = 0;
  let stops = 0;
  const voice: Voice = {
    say: (l) => said.push(l),
    prepare: () => prepared++,
    stop: () => void stops++,
    setEnabled: () => {},
    unlock: () => {},
  };
  return { voice, said, prepared: () => prepared, stops: () => stops };
}

/** Plays a whole run (steering wiggling, so some gates go wrong) through the hook. */
function play(session: Session, seed: number) {
  const v = logVoice();
  const start: Scene = { kind: "start" };
  let scene = handleAction(start, "confirm", () => seed, session, NOW).scene;
  speakStep(v.voice, start, scene, session);
  for (let i = 0; scene.kind === "run" && i < 60 * 600; i++) {
    const next = updateScene(scene, 1 / 60, Math.sin(i / 40));
    speakStep(v.voice, scene, next, session);
    scene = next;
  }
  if (scene.kind !== "boss" && scene.kind !== "end") throw new Error("no end");
  return { ...v, run: scene.run };
}

const rec = (box: number) => ({
  box,
  seen: 1,
  correct: 1,
  wrong: 0,
  lastSeen: 1,
});
const kanjiProgress = (): Progress => {
  const p: Progress = { ...defaultProgress(), unlockedLevel: 12 };
  for (const k of KANA) p.items[itemKey(k.char, "kana")] = rec(5);
  for (const k of KANJI)
    if (k.level <= 11) {
      p.items[itemKey(k.char, "meaning")] = rec(3);
      p.items[itemKey(k.char, "reading")] = rec(3);
    }
  return p;
};

describe("speakStep", () => {
  const modes: [string, Session][] = [
    ["Built-in kana", createSession(defaultProgress())],
    ["Built-in kanji and words", createSession(kanjiProgress())],
    ["Meaning", createSession(meaningProgress(), true)],
    [
      "WaniKani",
      {
        ...createSession(defaultProgress()),
        wk: syntheticList(30) as unknown as NonNullable<Session["wk"]>,
      },
    ],
  ];
  for (const [name, session] of modes)
    it(`${name}: says each resolved gate once, right or wrong`, () => {
      const results: boolean[] = [];
      for (const seed of [1, 2, 3]) {
        const { said, prepared, run } = play(session, seed);
        results.push(...run.results);
        expect(prepared()).toBe(1);
        expect(run.results.length).toBeGreaterThan(0);
        expect(said).toHaveLength(run.results.length);
      }
      expect(results).toContain(true);
      expect(results).toContain(false);
    });
});

describe("speakStep stopping", () => {
  const session = createSession(defaultProgress());
  const running = handleAction(
    { kind: "start" },
    "confirm",
    () => 1,
    session,
    NOW,
  ).scene;
  if (running.kind !== "run") throw new Error("no run");

  it("stops the voice when the run is paused, not when it resumes", () => {
    const v = logVoice();
    const paused = { ...running, paused: true };
    speakStep(v.voice, running, paused, session);
    expect(v.stops()).toBe(1);
    speakStep(v.voice, paused, running, session);
    speakStep(v.voice, running, running, session);
    expect(v.stops()).toBe(1);
  });

  it("stops the voice when the run is left", () => {
    const v = logVoice();
    speakStep(v.voice, running, { kind: "start" }, session);
    expect(v.stops()).toBe(1);
    speakStep(v.voice, { kind: "start" }, { kind: "start" }, session);
    expect(v.stops()).toBe(1);
  });

  it("stops the voice when a run ends with nothing new said", () => {
    const v = logVoice();
    speakStep(
      v.voice,
      running,
      { kind: "end", seed: 1, run: running.run, boss: null },
      session,
    );
    expect(v.stops()).toBe(1);
  });
});
