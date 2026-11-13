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

/** One piece of the session line: an item, or a dim label. */
export type PanelToken =
  { kind: "item"; entry: SessionEntry } | { kind: "label"; s: string };

/**
 * The end screen's session line as tokens: "Session · run 3", then "· fixed"
 * and "· still missing" with their items (each group's reading items after a
 * `reading` label); "· no misses this session" when both are empty.
 */
export function sessionTokens(log: SessionLog): PanelToken[] {
  const { runs, fixed, missing } = sessionLists(log);
  const label = (s: string): PanelToken => ({ kind: "label", s });
  const group = (head: string, entries: SessionEntry[]): PanelToken[] => {
    if (!entries.length) return [];
    const item = (entry: SessionEntry): PanelToken => ({ kind: "item", entry });
    const reading = entries.filter((e) => e.type === "reading");
    return [
      label(head),
      ...entries.filter((e) => e.type !== "reading").map(item),
      ...(reading.length ? [label("reading"), ...reading.map(item)] : []),
    ];
  };
  const empty = !fixed.length && !missing.length;
  return [
    label(`Session · run ${runs}`),
    ...(empty ? [label("· no misses this session")] : []),
    ...group("· fixed", fixed),
    ...group("· still missing", missing),
  ];
}

/**
 * Wraps `tokens` greedily onto at most `maxLines` lines of `avail` px, `gap` px
 * between tokens. A line never ends on a label. When not everything fits, the
 * last line is shortened to leave room for "+k", and `hidden` is k (the items
 * not shown; 0 when everything fits). `measure` gives a token's drawn width.
 */
export function wrapTokens(
  tokens: readonly PanelToken[],
  avail: number,
  maxLines: number,
  gap: number,
  measure: (t: PanelToken) => number,
): { lines: PanelToken[][]; hidden: number } {
  const width = (ts: readonly PanelToken[]): number =>
    ts.reduce((s, t) => s + measure(t), 0) + gap * Math.max(0, ts.length - 1);
  const items = (ts: readonly PanelToken[]): number =>
    ts.filter((t) => t.kind === "item").length;
  const trim = (ts: PanelToken[]): PanelToken[] => {
    while (ts.length && ts[ts.length - 1]?.kind === "label") ts.pop();
    return ts;
  };
  const lines: PanelToken[][] = [];
  let at = 0;
  for (let l = 0; l < maxLines && at < tokens.length; l++) {
    const line: PanelToken[] = [];
    while (
      at + line.length < tokens.length &&
      (line.length === 0 ||
        width([...line, tokens[at + line.length] as PanelToken]) <= avail)
    )
      line.push(tokens[at + line.length] as PanelToken);
    if (l === maxLines - 1 && at + line.length < tokens.length) {
      const plus = (n: number): PanelToken => ({ kind: "label", s: `+${n}` });
      const left = (): number => items(tokens.slice(at + line.length));
      while (line.length && width([...line, plus(left())]) > avail) line.pop();
      trim(line);
    } else if (at + line.length < tokens.length) {
      const n = line.length;
      trim(line);
      // a line can't be all label: keep it then
      if (!line.length) line.push(...tokens.slice(at, at + n));
    }
    lines.push(line);
    at += line.length;
  }
  return { lines, hidden: items(tokens.slice(at)) };
}
