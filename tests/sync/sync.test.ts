import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { defaultProgress } from "../../src/core/srs";
import type { Progress } from "../../src/core/types";
import {
  loadProgress,
  STORAGE_KEY,
  type KeyValueStore,
} from "../../src/storage/storage";
import {
  createSync,
  createSyncFromEnv,
  type SyncStatus,
} from "../../src/sync/sync";

function fakeStore(
  p?: Progress,
): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  if (p) data.set(STORAGE_KEY, JSON.stringify(p));
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  };
}

const item = (lastSeen: number, box = 1) => ({
  box,
  seen: 1,
  correct: 1,
  wrong: 0,
  lastSeen,
});

const local: Progress = {
  ...defaultProgress(),
  unlockedLevel: 1,
  items: { "kana:あ": item(100), "kana:い": item(100) },
  stats: { runs: 2, wins: 1, losses: 1 },
};
const remote: Progress = {
  ...defaultProgress(),
  unlockedLevel: 2,
  items: { "kana:あ": item(200, 3), "kanji:日": item(50) },
  stats: { runs: 3, wins: 1, losses: 2 },
};

type Resp = { data: unknown; error: unknown; status: number };
const ok = (data: unknown): Resp => ({ data, error: null, status: 200 });
const NETWORK: Resp = {
  data: null,
  error: { message: "TypeError: Failed to fetch", code: "" },
  status: 0,
};

type FakeOpts = {
  session?: Resp;
  select?: Resp;
  upsert?: Resp;
  signIn?: Resp;
};

const SESSION = ok({ session: { user: { id: "u1" } } });

/** A stand-in for the slice of SupabaseClient that sync uses. */
function fakeClient(opts: FakeOpts = {}) {
  const upserts: unknown[] = [];
  const queries: unknown[] = [];
  let session = opts.session ?? SESSION;
  const client = {
    auth: {
      getSession: vi.fn(async () => session),
      signInWithPassword: vi.fn(async () => {
        const r = opts.signIn ?? ok({ session: { user: { id: "u1" } } });
        if (!r.error) session = SESSION;
        return r;
      }),
      signOut: vi.fn(async () => {
        session = ok({ session: null });
        return { error: null };
      }),
    },
    from: vi.fn(() => ({
      select: () => ({
        eq: (col: string, val: string) => ({
          maybeSingle: async () => {
            queries.push([col, val]);
            return opts.select ?? ok(null);
          },
        }),
      }),
      upsert: async (row: unknown) => {
        upserts.push(row);
        return opts.upsert ?? { data: null, error: null, status: 201 };
      },
    })),
  };
  return {
    client,
    upserts,
    queries,
    factory: () => Promise.resolve(client as unknown as SupabaseClient),
  };
}

function setup(opts: FakeOpts = {}, online = true) {
  const fake = fakeClient(opts);
  const store = fakeStore(local);
  const sync = createSync({
    client: fake.factory,
    store,
    isOnline: () => online,
  });
  const seen: SyncStatus[] = [];
  sync.onStatus((s) => seen.push(s));
  return { ...fake, store, sync, seen };
}

describe("sync", () => {
  it("pull merges remote into local and saves it", async () => {
    const { sync, store, queries } = setup({ select: ok({ data: remote }) });
    const p = await sync.pull();
    expect(sync.status()).toBe("synced");
    expect(queries).toEqual([["user_id", "u1"]]);
    expect(p.unlockedLevel).toBe(2);
    expect(p.items["kana:あ"]?.box).toBe(3);
    expect(Object.keys(p.items).sort()).toEqual([
      "kana:あ",
      "kana:い",
      "kanji:日",
    ]);
    expect(loadProgress(store)).toEqual(p);
  });

  it("push merges and upserts the user's row", async () => {
    const { sync, upserts } = setup({ select: ok({ data: remote }) });
    const p = await sync.push();
    expect(sync.status()).toBe("synced");
    expect(upserts).toHaveLength(1);
    const row = upserts[0] as Record<string, unknown>;
    expect(row.user_id).toBe("u1");
    expect(row.data).toEqual(p);
    expect(typeof row.updated_at).toBe("string");
  });

  it("no remote row: pull is synced and leaves local unchanged", async () => {
    const { sync, store } = setup({ select: ok(null) });
    const before = store.data.get(STORAGE_KEY);
    await expect(sync.pull()).resolves.toEqual(local);
    expect(sync.status()).toBe("synced");
    expect(store.data.get(STORAGE_KEY)).toBe(before);
  });

  it("no remote row: push uploads local", async () => {
    const { sync, upserts } = setup({ select: ok(null) });
    await sync.push();
    expect((upserts[0] as { data: unknown }).data).toEqual(local);
  });

  it("offline: resolves with local, status offline, no client created", async () => {
    const factory = vi.fn(fakeClient().factory);
    const store = fakeStore(local);
    const sync = createSync({ client: factory, store, isOnline: () => false });
    await expect(sync.pull()).resolves.toEqual(local);
    await expect(sync.push()).resolves.toEqual(local);
    expect(sync.status()).toBe("offline");
    expect(factory).not.toHaveBeenCalled();
  });

  it("network error (paused project) on select: offline, local kept", async () => {
    const { sync, store, upserts } = setup({ select: NETWORK });
    await expect(sync.push()).resolves.toEqual(local);
    expect(sync.status()).toBe("offline");
    expect(upserts).toHaveLength(0);
    expect(loadProgress(store)).toEqual(local);
  });

  it("server error (5xx) on upsert: offline", async () => {
    const { sync } = setup({
      upsert: { data: null, error: { message: "down", code: "" }, status: 503 },
    });
    await sync.push();
    expect(sync.status()).toBe("offline");
  });

  it("network error while refreshing the session: offline", async () => {
    const { sync } = setup({
      session: {
        data: { session: null },
        error: { name: "AuthRetryableFetchError", status: 0 },
        status: 0,
      },
    });
    await sync.pull();
    expect(sync.status()).toBe("offline");
  });

  it("expired session that cannot be refreshed: login", async () => {
    const { sync } = setup({
      session: {
        data: { session: null },
        error: {
          name: "AuthApiError",
          status: 400,
          code: "refresh_token_not_found",
        },
        status: 400,
      },
    });
    await expect(sync.pull()).resolves.toEqual(local);
    expect(sync.status()).toBe("login");
  });

  it("no session: login", async () => {
    const { sync } = setup({ session: ok({ session: null }) });
    await sync.push();
    expect(sync.status()).toBe("login");
  });

  it("expired JWT rejected by the API: login", async () => {
    const { sync } = setup({
      select: {
        data: null,
        error: { message: "JWT expired", code: "PGRST303" },
        status: 401,
      },
    });
    await sync.pull();
    expect(sync.status()).toBe("login");
  });

  it("a thrown client error or failed lazy load resolves offline", async () => {
    const store = fakeStore(local);
    const factory = vi
      .fn<() => Promise<SupabaseClient>>()
      .mockRejectedValueOnce(new Error("chunk failed"))
      .mockImplementation(fakeClient().factory);
    const sync = createSync({ client: factory, store, isOnline: () => true });
    await expect(sync.pull()).resolves.toEqual(local);
    expect(sync.status()).toBe("offline");
    await sync.pull();
    expect(sync.status()).toBe("synced");

    const { client } = fakeClient();
    client.auth.getSession.mockRejectedValue(new Error("boom"));
    const s2 = createSync({
      client: () => Promise.resolve(client as unknown as SupabaseClient),
      store,
      isOnline: () => true,
    });
    await expect(s2.push()).resolves.toEqual(local);
    expect(s2.status()).toBe("offline");
  });

  it.each([
    ["not an object", "hello"],
    ["foreign shape", { foo: 1 }],
    ["future version", { ...remote, version: 99 }],
    ["bad stats", { ...remote, stats: null }],
  ])("bad remote data (%s) does not crash or wipe local", async (_, data) => {
    const { sync, store } = setup({ select: ok({ data }) });
    await expect(sync.pull()).resolves.toEqual(local);
    expect(loadProgress(store)).toEqual(local);
    expect(sync.status()).toBe("synced");
  });

  it("reports status changes to subscribers and supports unsubscribe", async () => {
    const { sync, seen } = setup({ session: ok({ session: null }) });
    await sync.pull();
    expect(seen).toEqual(["login"]);
    const later: SyncStatus[] = [];
    const off = sync.onStatus((s) => later.push(s));
    off();
    await sync.signOut();
    expect(later).toEqual([]);
  });

  it("signIn pulls on success; bad credentials and offline are reported", async () => {
    const good = setup({
      session: ok({ session: null }),
      select: ok({ data: remote }),
    });
    const r = await good.sync.signIn("me@example.com", "pw");
    expect(r.ok).toBe(true);
    expect(good.sync.status()).toBe("synced");
    if (r.ok) expect(r.progress.unlockedLevel).toBe(2);

    const bad = setup({
      signIn: {
        data: null,
        error: {
          name: "AuthApiError",
          status: 400,
          code: "invalid_credentials",
        },
        status: 400,
      },
    });
    await expect(bad.sync.signIn("me@example.com", "x")).resolves.toEqual({
      ok: false,
      reason: "credentials",
    });

    const net = setup({
      signIn: {
        data: null,
        error: { name: "AuthRetryableFetchError", status: 0 },
        status: 0,
      },
    });
    await expect(net.sync.signIn("a", "b")).resolves.toEqual({
      ok: false,
      reason: "offline",
    });
    const off = setup({}, false);
    await expect(off.sync.signIn("a", "b")).resolves.toEqual({
      ok: false,
      reason: "offline",
    });
  });

  it("signOut drops the session locally and reports login", async () => {
    const { sync, client, store } = setup();
    await sync.pull();
    await sync.signOut();
    expect(client.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(sync.status()).toBe("login");
    expect(loadProgress(store)).toEqual(local);
  });

  it("serialises overlapping pull and push", async () => {
    const { sync, upserts } = setup({ select: ok({ data: remote }) });
    const [a, b] = await Promise.all([sync.pull(), sync.push()]);
    expect(b).toEqual(a);
    expect(upserts).toHaveLength(1);
  });
});

describe("sync disabled (env vars missing)", () => {
  it.each([
    [{}],
    [{ VITE_SUPABASE_URL: "https://x.supabase.co" }],
    [{ VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x" }],
    [{ VITE_SUPABASE_URL: "", VITE_SUPABASE_PUBLISHABLE_KEY: "" }],
  ])("is a no-op and reports disabled for %j", async (env) => {
    const store = fakeStore(local);
    const setItem = vi.spyOn(store, "setItem");
    const sync = createSyncFromEnv(store, env);
    expect(sync.enabled).toBe(false);
    expect(sync.status()).toBe("disabled");
    await expect(sync.pull()).resolves.toEqual(local);
    await expect(sync.push()).resolves.toEqual(local);
    await expect(sync.signIn("a", "b")).resolves.toEqual({
      ok: false,
      reason: "disabled",
    });
    await sync.signOut();
    expect(sync.status()).toBe("disabled");
    expect(setItem).not.toHaveBeenCalled();
  });

  it("is enabled when both are set, without loading the client up front", () => {
    const sync = createSyncFromEnv(fakeStore(), {
      VITE_SUPABASE_URL: "https://x.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x",
    });
    expect(sync.enabled).toBe(true);
    expect(sync.status()).toBe("offline");
  });
});
