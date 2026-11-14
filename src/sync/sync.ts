import type { SupabaseClient } from "@supabase/supabase-js";
import { mergeProgress } from "../core/merge";
import type { Progress } from "../core/types";
import {
  loadProgress,
  migrate,
  saveProgress,
  type KeyValueStore,
} from "../storage/storage";

/**
 * `disabled`: no Supabase config, sync is a no-op. `synced`: the last sync
 * succeeded. `offline`: no network, a paused project or a server error.
 * `login`: no session, or it expired and could not be refreshed.
 */
export type SyncStatus = "disabled" | "synced" | "offline" | "login";

export type SignInResult =
  | { ok: true; status: SyncStatus; progress: Progress }
  | { ok: false; reason: "credentials" | "offline" | "disabled" };

export type Sync = {
  readonly enabled: boolean;
  status(): SyncStatus;
  /** Calls `fn` on every status change; returns an unsubscribe function. */
  onStatus(fn: (status: SyncStatus) => void): () => void;
  /** Fetch remote, merge into local, save locally. Resolves to local progress. */
  pull(): Promise<Progress>;
  /** Fetch remote, merge with local, save locally and upsert. Resolves to local progress. */
  push(): Promise<Progress>;
  /** Email/password sign-in; on success pulls straight away. */
  signIn(email: string, password: string): Promise<SignInResult>;
  /** Drops the session on this device. Local progress is kept. */
  signOut(): Promise<void>;
  /**
   * Saves one horde gauntlet run (dev tool) as a new `tuning_results` row
   * of the signed-in user. Never throws; leaves the sync status alone.
   */
  saveTuning(data: unknown): Promise<SaveResult>;
};

/** How saving a tuning run went: `login` when signed out, `offline` on any other failure. */
export type SaveResult = "saved" | "disabled" | "login" | "offline";

export type SyncOptions = {
  /** Creates the client on first use; null disables sync. */
  client: (() => Promise<SupabaseClient>) | null;
  store: KeyValueStore;
  isOnline?: () => boolean;
};

const TABLE = "progress";
const TUNING_TABLE = "tuning_results";

type ErrorLike = { status?: number; code?: string; name?: string } | null;

/** Auth/JWT failures mean `login`; anything else (network, 5xx, paused) is `offline`. */
function classify(error: ErrorLike, status?: number): "login" | "offline" {
  const s = status ?? error?.status ?? 0;
  if (error?.name === "AuthRetryableFetchError" || s === 0 || s >= 500)
    return "offline";
  if (s === 401 || s === 403 || error?.code?.startsWith("PGRST30"))
    return "login";
  if (error?.name?.startsWith("Auth")) return "login";
  return "offline";
}

class SyncFailure {
  constructor(readonly status: "login" | "offline") {}
}

const browserOnline = () =>
  typeof navigator === "undefined" || navigator.onLine !== false;

export function createSync(options: SyncOptions): Sync {
  const { store, client: factory } = options;
  const isOnline = options.isOnline ?? browserOnline;
  const listeners = new Set<(s: SyncStatus) => void>();
  let current: SyncStatus = factory ? "offline" : "disabled";
  let clientPromise: Promise<SupabaseClient> | null = null;
  let queue: Promise<unknown> = Promise.resolve();

  const setStatus = (s: SyncStatus) => {
    if (s === current) return;
    current = s;
    for (const fn of listeners) {
      try {
        fn(s);
      } catch {
        // a listener's bug must not break sync
      }
    }
  };

  /** Runs jobs one at a time so pulls and pushes never interleave writes. */
  const serial = <T>(job: () => Promise<T>): Promise<T> => {
    const next = queue.then(job);
    queue = next.catch(() => undefined);
    return next;
  };

  const getClient = async (): Promise<SupabaseClient> => {
    if (!factory) throw new SyncFailure("offline");
    clientPromise ??= factory().catch((e: unknown) => {
      clientPromise = null; // e.g. the lazy chunk failed to load offline; retry later
      throw e;
    });
    return clientPromise;
  };

  const userId = async (client: SupabaseClient): Promise<string> => {
    const { data, error } = await client.auth.getSession();
    if (error) throw new SyncFailure(classify(error));
    if (!data.session) throw new SyncFailure("login");
    return data.session.user.id;
  };

  /** Remote progress, or null if there is no row or it is not valid progress. */
  const fetchRemote = async (
    client: SupabaseClient,
    id: string,
  ): Promise<Progress | null> => {
    const { data, error, status } = await client
      .from(TABLE)
      .select("data")
      .eq("user_id", id)
      .maybeSingle();
    if (error) throw new SyncFailure(classify(error, status));
    const row: unknown = data;
    if (typeof row !== "object" || row === null || !("data" in row))
      return null;
    return migrate(row.data);
  };

  /** One sync round; `upload` also writes the merge back to Supabase. */
  const sync = (upload: boolean) =>
    serial(async (): Promise<Progress> => {
      const local = loadProgress(store);
      if (!factory) return local;
      if (!isOnline()) {
        setStatus("offline");
        return local;
      }
      try {
        const client = await getClient();
        const id = await userId(client);
        const remote = await fetchRemote(client, id);
        const merged = remote ? mergeProgress(local, remote) : local;
        if (remote) saveProgress(store, merged);
        if (upload) {
          const { error, status } = await client.from(TABLE).upsert({
            user_id: id,
            data: merged,
            updated_at: new Date().toISOString(),
          });
          if (error) throw new SyncFailure(classify(error, status));
        }
        setStatus("synced");
        return merged;
      } catch (e) {
        setStatus(e instanceof SyncFailure ? e.status : "offline");
        return loadProgress(store);
      }
    });

  const signIn = async (
    email: string,
    password: string,
  ): Promise<SignInResult> => {
    if (!factory) return { ok: false, reason: "disabled" };
    if (!isOnline()) return { ok: false, reason: "offline" };
    try {
      const client = await getClient();
      const { error } = await client.auth.signInWithPassword({
        email,
        password,
      });
      if (error)
        return {
          ok: false,
          reason: classify(error) === "offline" ? "offline" : "credentials",
        };
    } catch {
      return { ok: false, reason: "offline" };
    }
    const progress = await sync(false);
    return { ok: true, status: current, progress };
  };

  const signOut = async (): Promise<void> => {
    if (!factory) return;
    try {
      const client = await getClient();
      await client.auth.signOut({ scope: "local" });
    } catch {
      // the local session is what matters; ignore failures
    }
    setStatus("login");
  };

  const saveTuning = async (data: unknown): Promise<SaveResult> => {
    if (!factory) return "disabled";
    if (!isOnline()) return "offline";
    try {
      const client = await getClient();
      await userId(client);
      // user_id defaults to auth.uid(); row-level security checks it
      const { error, status } = await client
        .from(TUNING_TABLE)
        .insert({ data });
      if (error) return classify(error, status);
      return "saved";
    } catch (e) {
      return e instanceof SyncFailure ? e.status : "offline";
    }
  };

  return {
    enabled: factory !== null,
    status: () => current,
    onStatus(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    pull: () => sync(false),
    push: () => sync(true),
    signIn,
    signOut,
    saveTuning,
  };
}

/**
 * Sync configured from `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
 * Disabled when either is missing. supabase-js loads lazily on first use.
 */
export function createSyncFromEnv(
  store: KeyValueStore,
  env: Partial<ImportMetaEnv> = import.meta.env,
): Sync {
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return createSync({ client: null, store });
  return createSync({
    store,
    client: async () => {
      const { createClient } = await import("@supabase/supabase-js");
      return createClient(url, key);
    },
  });
}
