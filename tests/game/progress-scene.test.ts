import { describe, expect, it } from "vitest";
import { KANA } from "../../src/core/kana";
import { KANJI } from "../../src/core/kanji";
import { place } from "../../src/core/progression";
import { defaultProgress } from "../../src/core/srs";
import { WORDS } from "../../src/core/words";
import {
  levelPageHit,
  levelPageLayout,
  progressLayout,
} from "../../src/game/progress";
import {
  createSession,
  handleAction,
  progressTap,
  scrollProgress,
  type Scene,
} from "../../src/game/scenes";
import { NOW } from "../now";

const W = 390;
const H = 844;
/** At Kanji 30 (Everyday): Kana and Foundations are past groups. */
const session = createSession(place(defaultProgress(), 30, KANA, KANJI, WORDS));

type ProgressScene = Extract<Scene, { kind: "progress" }>;

function opened(): ProgressScene {
  const s = handleAction(
    { kind: "start" },
    "progress",
    () => 1,
    session,
    NOW,
  ).scene;
  if (s.kind !== "progress") throw new Error("not opened");
  return s;
}

const asProgress = (s: Scene): ProgressScene => {
  if (s.kind !== "progress") throw new Error(`not progress: ${s.kind}`);
  return s;
};

/** Tap the middle of the first row matching `pick`, at the scene's scroll. */
function tapRow(
  scene: ProgressScene,
  pick: (r: ProgressScene["view"]["rows"][number]) => boolean,
) {
  const l = progressLayout(W, H, scene.view);
  const s = scene.scroll ?? l.maxScroll;
  const r = l.rows.find((p) => pick(p.row));
  if (!r) throw new Error("no such row");
  const y = l.listTop + r.y - s + r.h / 2;
  return progressTap(scene, W, H, W / 2, y, session);
}

describe("progress view taps", () => {
  it("a past group toggles open and shut; several can be open", () => {
    let s = asProgress(scrollProgress(opened(), -10000, W, H));
    expect(s.scroll).toBe(0);
    s = asProgress(tapRow(s, (r) => r.name === "Foundations").scene);
    expect(s.expanded).toEqual([1]);
    expect(s.view.rows.filter((r) => r.kind === "level")).toHaveLength(25 + 6);
    s = asProgress(tapRow(s, (r) => r.name === "Kana").scene);
    expect(s.expanded).toEqual([1, 0]);
    expect(s.view.rows[1]).toMatchObject({ kind: "level", name: "Hiragana" });
    s = asProgress(tapRow(s, (r) => r.name === "Foundations").scene);
    expect(s.expanded).toEqual([0]);
    expect(s.view.rows.find((r) => r.name === "Kanji 1")).toBeUndefined();
  });

  it("the current group doesn't toggle; the dimmed next group does", () => {
    const s = opened();
    expect(tapRow(s, (r) => r.name === "Everyday").scene).toBe(s);
    const next = asProgress(
      tapRow(s, (r) => r.name === "Getting around").scene,
    );
    expect(next.expanded).toEqual([3]);
  });

  it("toggling pins the scroll so the rows above stay put", () => {
    const s = opened();
    const max = progressLayout(W, H, s.view).maxScroll;
    const t = asProgress(tapRow(s, (r) => r.name === "Getting around").scene);
    expect(t.scroll).toBe(max);
  });

  it("a level row opens its level page, locked levels too", () => {
    const s = opened();
    const r = tapRow(s, (row) => row.name === "Kanji 29");
    expect(r.study).toBeNull();
    const page = asProgress(r.scene).page;
    expect(page?.view.title).toBe("Kanji 29 · Everyday");
    expect(page?.view.locked).toBe(false);
    expect(page?.scroll).toBe(0);
    const locked = asProgress(
      tapRow(s, (row) => row.name === "Kanji 31").scene,
    );
    expect(locked.page?.view.locked).toBe(true);
  });

  it("Back (button or Esc) returns at the same scroll and expanded groups", () => {
    let s = asProgress(scrollProgress(opened(), -10000, W, H));
    s = asProgress(tapRow(s, (r) => r.name === "Foundations").scene);
    s = asProgress(scrollProgress(s, 120, W, H));
    const before = s;
    s = asProgress(tapRow(s, (r) => r.name === "Kanji 4").scene);
    expect(s.page?.view.title).toBe("Kanji 4 · Foundations");
    // the page scrolls on its own; the view's scroll is kept
    s = asProgress(scrollProgress(s, 40, W, H));
    expect(s.scroll).toBe(before.scroll);
    const esc = asProgress(
      handleAction(s, "back", () => 1, session, NOW).scene,
    );
    expect(esc).toEqual(before);
    const { back } = levelPageLayout(W, H, s.page?.view ?? fail());
    const tapped = progressTap(s, W, H, back.x + 5, back.y + 5, session);
    expect(tapped.scene).toEqual(before);
    // Back on the view itself goes to the start screen
    expect(handleAction(before, "back", () => 1, session, NOW).scene).toEqual({
      kind: "start",
    });
  });

  it("an item row asks for its study card and leaves the page as it is", () => {
    const s = asProgress(tapRow(opened(), (r) => r.name === "Kanji 29").scene);
    const page = s.page ?? fail();
    const l = levelPageLayout(W, H, page.view);
    const first = page.view.items[0] ?? fail();
    const r = progressTap(s, W, H, W / 2, l.listTop + 10, session);
    expect(r.scene).toBe(s);
    expect(r.study).toEqual({ key: first.key, kind: first.kind });
  });
});

describe("level page layout", () => {
  it("rows stack under the header; a long page scrolls; hits count the scroll", () => {
    const s = asProgress(tapRow(opened(), (r) => r.name === "Kanji 29").scene);
    const page = s.page?.view ?? fail();
    const l = levelPageLayout(W, H, page);
    expect(l.listTop).toBeGreaterThan(110);
    expect(l.listBottom).toBeLessThan(l.back.y);
    const content = l.rows.length * (l.rows[0]?.h ?? 0);
    expect(l.maxScroll).toBe(Math.max(0, content - (l.listBottom - l.listTop)));
    const second = page.items[1] ?? fail();
    const h = l.rows[0]?.h ?? 0;
    expect(levelPageHit(W, H, page, h, W / 2, l.listTop + 5)).toEqual({
      kind: "item",
      item: { key: second.key, kind: second.kind },
    });
    expect(levelPageHit(W, H, page, 0, W / 2, l.listTop - 5)).toBeNull();
    expect(levelPageHit(W, H, page, 0, W / 2, l.back.y + 5)).toEqual({
      kind: "back",
    });
  });
});

function fail(): never {
  throw new Error("missing");
}
