import type { KeyValueStore } from "./storage";

/** "This story is bad": one flag on a kanji card with our story. */
export type StoryFlag = {
  kanji: string;
  /** The level as the player sees it, e.g. "Kanji 5". */
  level: string;
  /** Optional note, at most `NOTE_MAX` characters. */
  note: string;
  /** Epoch ms. */
  at: number;
  build: string;
};

/** Flags wait here (this device only) until they reach Supabase. */
export const FLAGS_KEY = "kanji-runner:story-flags:v1";
export const NOTE_MAX = 200;

const isFlag = (v: unknown): v is StoryFlag => {
  if (typeof v !== "object" || v === null) return false;
  const f = v as Record<string, unknown>;
  return (
    typeof f.kanji === "string" &&
    typeof f.level === "string" &&
    typeof f.note === "string" &&
    typeof f.at === "number" &&
    typeof f.build === "string"
  );
};

/** The queued flags; empty for missing, unreadable or bad data (bad entries are dropped). Never throws. */
export function loadFlags(store: KeyValueStore): StoryFlag[] {
  try {
    const raw = store.getItem(FLAGS_KEY);
    if (!raw) return [];
    const data: unknown = JSON.parse(raw);
    return Array.isArray(data) ? data.filter(isFlag) : [];
  } catch {
    return [];
  }
}

function saveFlags(store: KeyValueStore, flags: readonly StoryFlag[]): void {
  try {
    store.setItem(FLAGS_KEY, JSON.stringify(flags));
  } catch {
    // blocked or full storage: the flag is lost, nothing else is
  }
}

/** Queues a flag (the note is trimmed and cut to `NOTE_MAX`). Never throws. */
export function addFlag(store: KeyValueStore, flag: StoryFlag): void {
  const note = flag.note.trim().slice(0, NOTE_MAX);
  saveFlags(store, [...loadFlags(store), { ...flag, note }]);
}

/** Drops these flags (the ones that were sent) from the queue; flags added meanwhile stay. */
export function removeFlags(
  store: KeyValueStore,
  sent: readonly StoryFlag[],
): void {
  const gone = new Set(sent.map((f) => JSON.stringify(f)));
  saveFlags(
    store,
    loadFlags(store).filter((f) => !gone.has(JSON.stringify(f))),
  );
}
