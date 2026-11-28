import { describe, expect, it } from "vitest";
import type { Cue } from "../../src/core/cues";
import { defaultProgress } from "../../src/core/srs";
import { playCues, unlockSound } from "../../src/game/cues";
import { createSession, handleAction, type Scene } from "../../src/game/scenes";
import { NOW } from "../now";

describe("playCues", () => {
  it("plays every cue as its sound, and nothing for an empty step", () => {
    const played: string[][] = [];
    const play = (names: readonly string[]) => void played.push([...names]);
    playCues(play, []);
    const list: Cue[] = [{ kind: "gate-right", row: 0 }, { kind: "shot" }];
    playCues(play, list);
    expect(played).toEqual([["gate-right", "shot"]]);
  });
});

describe("unlockSound", () => {
  const session = createSession(defaultProgress());
  const run = handleAction(
    { kind: "start" },
    "confirm",
    () => 1,
    session,
    NOW,
  ).scene;
  if (run.kind !== "run") throw new Error("no run");
  const end: Scene = { kind: "end", seed: 1, run: run.run, boss: null };
  const unlocked = { ...session, unlocked: 2 };

  it("sounds once, as the end screen comes up after a run that unlocked a level", () => {
    expect(unlockSound(run, end, unlocked)).toBe(true);
    expect(unlockSound(end, end, unlocked)).toBe(false);
    expect(unlockSound(run, end, session)).toBe(false);
    expect(unlockSound(run, run, unlocked)).toBe(false);
  });
});
