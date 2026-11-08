import { SESSION_IDLE_MINUTES } from "./tuning";
import type { GateRow, GateType } from "./types";

export type SessionItemState = "missing" | "fixed";

export type SessionItem = {
  prompt: string;
  type: GateType;
  state: SessionItemState;
};

/** One sitting. Plain JSON data. `items` are in first-miss order. */
export type SessionLog = {
  startedAt: number;
  lastRunAt: number;
  runs: number;
  items: SessionItem[];
  /** Item keys (`prompt:type`) that became fixed in the latest run. */
  fixedThisRun: string[];
};

const keyOf = (prompt: string, type: GateType): string => `${prompt}:${type}`;

const fresh = (now: number): SessionLog => ({
  startedAt: now,
  lastRunAt: now,
  runs: 0,
  items: [],
  fixedThisRun: [],
});

/**
 * Records a finished run. A null log, or a gap since the last run longer than
 * SESSION_IDLE_MINUTES (exactly at the limit continues), starts a new session.
 * Answered rows apply in order: wrong -> missing; right on a logged item ->
 * fixed; right on a never-missed item -> nothing. Unanswered rows are ignored.
 */
export function logRun(
  log: SessionLog | null,
  rows: GateRow[],
  results: boolean[],
  now: number,
): SessionLog {
  const idle =
    log !== null && now - log.lastRunAt > SESSION_IDLE_MINUTES * 60_000;
  const base = log === null || idle ? fresh(now) : log;
  const items = base.items.map((it) => ({ ...it }));
  const index = new Map(items.map((it, i) => [keyOf(it.prompt, it.type), i]));
  const fixedNow = new Set<string>();
  results.forEach((correct, i) => {
    const row = rows[i];
    if (!row) return;
    const key = keyOf(row.prompt, row.type);
    const at = index.get(key);
    const hit = at === undefined ? undefined : items[at];
    if (!correct) {
      if (!hit) {
        index.set(key, items.length);
        items.push({ prompt: row.prompt, type: row.type, state: "missing" });
      } else hit.state = "missing";
      fixedNow.delete(key);
    } else if (hit && hit.state === "missing") {
      hit.state = "fixed";
      fixedNow.add(key);
    }
  });
  return {
    startedAt: base.startedAt,
    lastRunAt: now,
    runs: base.runs + 1,
    items,
    fixedThisRun: [...fixedNow],
  };
}

export type SessionEntry = {
  prompt: string;
  type: GateType;
  /** Only meaningful for fixed entries. */
  thisRun: boolean;
};

/** The panel's data: fixed and still-missing items, in first-miss order. */
export function sessionLists(log: SessionLog): {
  runs: number;
  fixed: SessionEntry[];
  missing: SessionEntry[];
} {
  const now = new Set(log.fixedThisRun);
  const entry = (it: SessionItem): SessionEntry => ({
    prompt: it.prompt,
    type: it.type,
    thisRun: now.has(keyOf(it.prompt, it.type)),
  });
  return {
    runs: log.runs,
    fixed: log.items.filter((it) => it.state === "fixed").map(entry),
    missing: log.items.filter((it) => it.state === "missing").map(entry),
  };
}

/** One piece of a panel line: an item, or the dim `reading` divider. */
export type PanelToken =
  { kind: "item"; entry: SessionEntry } | { kind: "label"; s: string };

/**
 * Which entries of a panel line fit in `avail` px. Meaning and kana items come
 * first, reading items follow a `reading` label. When some are hidden, room is
 * kept for a ` +k` suffix and the label is never left dangling at the end.
 * `measure` gives the width of a string at the drawn font.
 */
export function panelLine(
  entries: SessionEntry[],
  avail: number,
  measure: (s: string) => number,
): { tokens: PanelToken[]; hidden: number } {
  const item = (entry: SessionEntry): PanelToken => ({ kind: "item", entry });
  const plain = entries.filter((e) => e.type !== "reading").map(item);
  const reading = entries.filter((e) => e.type === "reading").map(item);
  const all: PanelToken[] = [
    ...plain,
    ...(reading.length
      ? [{ kind: "label", s: "· reading" } as PanelToken]
      : []),
    ...reading,
  ];
  const text = (t: PanelToken): string =>
    t.kind === "item" ? t.entry.prompt : t.s;
  for (let c = all.length; c >= 0; c--) {
    const shown = all.slice(0, c);
    if (shown.length && shown[shown.length - 1].kind === "label") continue;
    const hidden =
      entries.length - shown.filter((t) => t.kind === "item").length;
    const s = shown.map(text).join(" ") + (hidden ? ` +${hidden}` : "");
    if (c === 0 || measure(s) <= avail) return { tokens: shown, hidden };
  }
  return { tokens: [], hidden: entries.length };
}
