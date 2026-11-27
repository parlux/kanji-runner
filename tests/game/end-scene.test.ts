import { describe, expect, it } from "vitest";
import { KANA } from "../../src/core/kana";
import { KANJI } from "../../src/core/kanji";
import { levelItems, levelKeys, place } from "../../src/core/progression";
import { defaultProgress } from "../../src/core/srs";
import { WORDS } from "../../src/core/words";
import type { GateRow, Progress } from "../../src/core/types";
import { createDrag, TAP_MAX_MOVE } from "../../src/game/drag";
import { endListArea, endListLayout } from "../../src/game/endlist";
import {
  afterStep,
  createSession,
  endItems,
  endItemTap,
  endLevelCard,
  endScrollMax,
  handleAction,
  studyOffered,
  type Scene,
  type Session,
} from "../../src/game/scenes";

const W = 390;
const H = 844;
type EndScene = Extract<Scene, { kind: "end" }>;

const meaningRow = (prompt: string): GateRow => ({
  type: "meaning",
  prompt,
  options: ["a", "b"],
  answerIndex: 0,
  answer: "a",
});

/** A run answering `rows` all right (`results` given otherwise), ended, and the session after it. */
function ended(
  progress: Progress,
  rows: GateRow[],
  results = rows.map(() => true),
): { scene: EndScene; session: Session } {
  const session = { ...createSession(progress), progress };
  const run = handleAction({ kind: "start" }, "confirm", () => 7, session);
  if (run.scene.kind !== "run") throw new Error("no run");
  const scene: EndScene = {
    kind: "end",
    seed: 7,
    boss: null,
    run: { ...run.scene.run, rows, results, status: "dead" },
  };
  return { scene, session: afterStep(session, run.scene, scene, 5) };
}

/** Kanji 5's chars and an item from an earlier level. */
const mid = place(defaultProgress(), 4, KANA, KANJI, WORDS);
const level = mid.unlockedLevel;
const levelChars = levelItems(level, KANA, KANJI, WORDS).map((i) => i.char);
const levelKanji = levelItems(level, KANA, KANJI, WORDS).filter(
  (i) => i.part === "kanji",
);
const earlier = levelItems(level - 1, KANA, KANJI, WORDS).find(
  (i) => i.part === "kanji",
);

describe("end list in a session", () => {
  it("shows the level card's level: missing, learned, then the run's other items", () => {
    const first = levelKanji[0]?.char as string;
    const other = earlier?.char as string;
    const { scene, session } = ended(mid, [
      meaningRow(other),
      meaningRow(first),
    ]);
    const e = endItems(scene.run, session);
    expect(endLevelCard(session).level).toBe(level);
    const levelPart = e.filter((x) => x.section !== "also");
    expect(levelPart.map((x) => x.key).sort()).toEqual([...levelChars].sort());
    expect(e.filter((x) => x.section === "also").map((x) => x.key)).toEqual([
      other,
    ]);
    // the met level item carries this run's change; the rest only stages
    expect(
      e
        .filter((x) => x.met)
        .map((x) => x.key)
        .sort(),
    ).toEqual([first, other].sort());
    expect(e.find((x) => x.key === first)?.section).toBe("missing");
  });

  it("after an unlock, lists the new level (mostly new items); the old level's are other items", () => {
    const progress = { ...defaultProgress(), unlockedLevel: 2 };
    const keys = levelKeys(2, KANA, KANJI, WORDS);
    keys.forEach((k, i) => {
      progress.items[k] = {
        box: i === 0 ? 2 : 3,
        seen: 1,
        correct: 1,
        wrong: 0,
        lastSeen: 1,
      };
    });
    const prompt = (keys[0] as string).split(":")[0] as string;
    const { scene, session } = ended(progress, [meaningRow(prompt)]);
    expect(endLevelCard(session).level).toBe(3);
    const e = endItems(scene.run, session);
    const next = levelItems(3, KANA, KANJI, WORDS).map((i) => i.char);
    expect(
      e
        .filter((x) => x.section === "missing")
        .map((x) => x.key)
        .sort(),
    ).toEqual([...next].sort());
    expect(e.filter((x) => x.section === "also").map((x) => x.key)).toEqual([
      prompt,
    ]);
  });
});

describe("end list taps and scroll", () => {
  const { scene, session } = ended(mid, [meaningRow(earlier?.char as string)]);
  const area = endListArea(
    W,
    H,
    endLevelCard(session),
    studyOffered(scene.run, scene.boss, session),
  );
  const list = endListLayout(
    area.top,
    area.bottom,
    endItems(scene.run, session),
  );
  const rowMid = (i: number, scroll = 0): number =>
    area.top + (list.rows[i]?.y ?? 0) - scroll + (list.rows[i]?.h ?? 0) / 2;

  it("a tap on a row asks for that item's study card", () => {
    const r = list.rows[0]?.entry;
    expect(endItemTap(W, H, scene, session, W / 2, rowMid(0))).toEqual({
      key: r?.key,
      kind: r?.kind,
    });
  });

  it("respects the scroll, clamped to the list", () => {
    const max = endScrollMax(W, H, scene, session);
    expect(max).toBe(list.maxScroll);
    expect(max).toBeGreaterThan(0);
    const scrolled = { ...scene, scroll: max };
    const last = list.rows.length - 1;
    expect(
      endItemTap(W, H, scrolled, session, W / 2, rowMid(last, max))?.key,
    ).toBe(list.rows[last]?.entry.key);
    // a scroll past the end lands on the same rows
    const over = { ...scene, scroll: max + 500 };
    expect(endItemTap(W, H, over, session, W / 2, rowMid(last, max))).toEqual(
      endItemTap(W, H, scrolled, session, W / 2, rowMid(last, max)),
    );
  });

  it("taps off the rows (title, card, buttons) open nothing", () => {
    expect(endItemTap(W, H, scene, session, W / 2, 40)).toBeNull();
    expect(endItemTap(W, H, scene, session, W / 2, area.top - 4)).toBeNull();
    expect(endItemTap(W, H, scene, session, W / 2, area.bottom + 4)).toBeNull();
  });

  it("a drag across a row is never a tap", () => {
    const d = createDrag(() => W);
    const y = rowMid(2);
    d.down(1, W / 2, y, 0);
    d.move(1, W / 2, y - TAP_MAX_MOVE - 1);
    d.move(1, W / 2, y);
    expect(d.up(1, W / 2, y, 100)).toBe(false);
  });
});
