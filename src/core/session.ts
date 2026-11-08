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
    if (!correct) {
      if (at === undefined) {
        index.set(key, items.length);
        items.push({ prompt: row.prompt, type: row.type, state: "missing" });
      } else items[at].state = "missing";
      fixedNow.delete(key);
    } else if (at !== undefined && items[at].state === "missing") {
      items[at].state = "fixed";
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
