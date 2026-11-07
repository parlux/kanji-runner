import { describe, expect, it } from "vitest";
import { devLevel, handleAction } from "../../src/game/scenes";

describe("dev level flag", () => {
  it("reads ?level=N for N ≥ 2 and ignores anything else", () => {
    expect(devLevel("?level=4")).toBe(4);
    expect(devLevel("")).toBeNull();
    expect(devLevel("?level=1")).toBeNull();
    expect(devLevel("?level=abc")).toBeNull();
  });

  it("starts a kanji run when set, a kana run otherwise", () => {
    const start = { kind: "start" } as const;
    const kanji = handleAction(start, "confirm", () => 1, 3);
    const kana = handleAction(start, "confirm", () => 1);
    if (kanji.kind !== "run" || kana.kind !== "run") throw new Error("no run");
    expect(kanji.run.rows.every((r) => r.type !== "kana")).toBe(true);
    expect(kana.run.rows.every((r) => r.type === "kana")).toBe(true);
  });
});
