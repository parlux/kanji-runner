import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { addFlag, loadFlags } from "../../src/storage/flags";
import type { KeyValueStore } from "../../src/storage/storage";
import { pushFlags } from "../../src/sync/flags";
import { createSync } from "../../src/sync/sync";

const mem = (): KeyValueStore => {
  const data = new Map<string, string>();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  };
};
const queued = () => {
  const s = mem();
  addFlag(s, { kanji: "日", level: "Kanji 5", note: "odd", at: 0, build: "b" });
  return s;
};
const client = (insert: () => Promise<unknown>) => {
  const rows: unknown[] = [];
  const c = {
    from: (t: string) => ({
      insert: async (r: unknown) => {
        rows.push([t, r]);
        return insert();
      },
    }),
  } as unknown as SupabaseClient;
  return { c, rows };
};

describe("pushFlags", () => {
  it("inserts the queue and empties it", async () => {
    const s = queued();
    const { c, rows } = client(async () => ({ error: null }));
    await pushFlags(c, s);
    expect(loadFlags(s)).toEqual([]);
    expect(rows).toEqual([
      [
        "story_flags",
        [
          {
            kanji: "日",
            level: "Kanji 5",
            note: "odd",
            build: "b",
            created_at: "1970-01-01T00:00:00.000Z",
          },
        ],
      ],
    ]);
  });
  it("keeps the queue on an error or a throw", async () => {
    const s = queued();
    await pushFlags(client(async () => ({ error: { message: "x" } })).c, s);
    expect(loadFlags(s)).toHaveLength(1);
    await expect(
      pushFlags(
        client(async () => {
          throw new Error("offline");
        }).c,
        s,
      ),
    ).resolves.toBeUndefined();
    expect(loadFlags(s)).toHaveLength(1);
  });
  it("does nothing for an empty queue", async () => {
    const { c, rows } = client(async () => ({ error: null }));
    await pushFlags(c, mem());
    expect(rows).toEqual([]);
  });
});

describe("Sync.pushFlags", () => {
  const sync = (
    session: unknown,
    ins = vi.fn(async () => ({ error: null })),
  ) => {
    const store = queued();
    const c = {
      auth: { getSession: async () => ({ data: { session }, error: null }) },
      from: () => ({ insert: ins }),
    } as unknown as SupabaseClient;
    return {
      store,
      ins,
      s: createSync({ client: async () => c, store, isOnline: () => true }),
    };
  };
  it("sends when signed in", async () => {
    const { s, store, ins } = sync({ user: { id: "u" } });
    await s.pushFlags();
    expect(ins).toHaveBeenCalledOnce();
    expect(loadFlags(store)).toEqual([]);
  });
  it("waits when signed out", async () => {
    const { s, store, ins } = sync(null);
    await s.pushFlags();
    expect(ins).not.toHaveBeenCalled();
    expect(loadFlags(store)).toHaveLength(1);
  });
  it("is a no-op when disabled", async () => {
    const store = queued();
    const s = createSync({ client: null, store });
    await expect(s.pushFlags()).resolves.toBeUndefined();
    expect(loadFlags(store)).toHaveLength(1);
  });
});
