import { parseLibrary, type StoryLibrary } from "./stories";

/** The one stored record: the library plus what decides when to refetch. */
export type StoredLibrary = {
  library: StoryLibrary;
  /** The last 4 characters of the token it was fetched with. Never the token. */
  tokenTail: string;
  fetchedAt: number;
};

/** Async, never throws. */
export type StoryStore = {
  load(): Promise<StoredLibrary | null>;
  save(record: StoredLibrary): Promise<void>;
  delete(): Promise<void>;
};

export const tokenTail = (token: string): string => token.trim().slice(-4);

const DB_NAME = "kanji-runner-stories";
const STORE = "library";
const KEY = "library";

export function createMemoryStoryStore(): StoryStore {
  let rec: StoredLibrary | null = null;
  return {
    load: async () => rec,
    save: async (r) => void (rec = r),
    delete: async () => void (rec = null),
  };
}

/** Validates a record read back from storage; anything odd is missing. */
export function parseRecord(raw: unknown): StoredLibrary | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.tokenTail !== "string" || typeof r.fetchedAt !== "number") {
    return null;
  }
  const lib = parseLibrary(r.library);
  return lib.ok
    ? { library: lib.value, tokenTail: r.tokenTail, fetchedAt: r.fetchedAt }
    : null;
}

function open(idb: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = idb.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("blocked"));
  });
}

function run<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  op: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = op(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/**
 * IndexedDB-backed store. If IndexedDB is missing or refuses, it keeps the
 * record in memory for the session instead.
 */
export function createStoryStore(
  idb: IDBFactory | undefined = typeof indexedDB === "undefined"
    ? undefined
    : indexedDB,
): StoryStore {
  const memory = createMemoryStoryStore();
  let db: Promise<IDBDatabase | null> | null = null;
  const getDb = (): Promise<IDBDatabase | null> => {
    db ??= idb ? open(idb).catch(() => null) : Promise.resolve(null);
    return db;
  };
  const viaDb = async <T>(
    use: (d: IDBDatabase) => Promise<T>,
    fallback: () => Promise<T>,
  ): Promise<T> => {
    try {
      const d = await getDb();
      if (d) return await use(d);
    } catch {
      // Fall through to memory.
    }
    return fallback();
  };
  return {
    load: () =>
      viaDb(
        async (d) => parseRecord(await run(d, "readonly", (s) => s.get(KEY))),
        memory.load,
      ),
    save: (r) =>
      viaDb(
        async (d) => void (await run(d, "readwrite", (s) => s.put(r, KEY))),
        () => memory.save(r),
      ),
    delete: () =>
      viaDb(
        async (d) => void (await run(d, "readwrite", (s) => s.delete(KEY))),
        memory.delete,
      ),
  };
}
