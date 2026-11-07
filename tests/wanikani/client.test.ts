import { describe, expect, it, vi } from "vitest";
import { saveToken, saveWkCache, type WkStore } from "../../src/wanikani/cache";
import {
  createWkClient,
  WK_BASE,
  WK_THROTTLE_MS,
} from "../../src/wanikani/client";
import { trim } from "../../src/wanikani/parse";
import assignments from "./fixtures/assignments.json";
import subjects from "./fixtures/subjects.json";
import user from "./fixtures/user.json";

const TOKEN = "secret-token-123";
const PAGE2 = `${WK_BASE}subjects?page_after_id=1`;

function fakeStore(): WkStore {
  const data = new Map<string, string>();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

type Call = { url: string; init?: RequestInit };

/** A fetch that serves the fixtures; `override` can replace any response. */
function makeFetch(override?: (url: string) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    const o = override?.(url);
    if (o) return o;
    if (url === `${WK_BASE}user`) return json(user);
    if (url === PAGE2) return json(subjects[1]);
    if (url.startsWith(`${WK_BASE}subjects`)) {
      return json({ ...subjects[0], pages: { next_url: PAGE2 } });
    }
    if (url.startsWith(`${WK_BASE}assignments`)) return json(assignments[0]);
    return json({}, 404);
  });
  return { fn: fn as unknown as typeof fetch, calls };
}

function setup(override?: (url: string) => Response | Promise<Response>) {
  const store = fakeStore();
  saveToken(store, TOKEN);
  const f = makeFetch(override);
  let t = 1_000_000;
  const clock = { advance: (ms: number) => (t += ms) };
  const client = createWkClient({ fetch: f.fn, store, now: () => t });
  return { store, f, client, clock };
}

const expected = (() => {
  const r = trim(user, subjects, assignments);
  if (!r.ok) throw new Error(r.error);
  return r.value;
})();

describe("fetching", () => {
  it("returns none without a token and does not fetch", async () => {
    const f = makeFetch();
    const client = createWkClient({
      fetch: f.fn,
      store: fakeStore(),
      now: () => 0,
    });
    expect(await client.refresh()).toEqual({ status: "none", cache: null });
    expect(f.calls).toHaveLength(0);
  });

  it("fetches user, subjects and assignments for levels 1..N", async () => {
    const { client, f } = setup();
    const r = await client.refresh();
    expect(r.status).toBe("ok");
    expect(f.calls[0]?.url).toBe(`${WK_BASE}user`);
    expect(f.calls[1]?.url).toBe(
      `${WK_BASE}subjects?types=kanji&levels=1,2,3,4,5`,
    );
    expect(f.calls[3]?.url).toBe(
      `${WK_BASE}assignments?subject_types=kanji&levels=1,2,3,4,5`,
    );
  });

  it("follows next_url across pages and caches the trimmed result", async () => {
    const { client, f, store } = setup();
    const r = await client.refresh();
    expect(r.status).toBe("ok");
    expect(r.cache).toEqual(expected);
    expect(f.calls.map((c) => c.url)).toContain(PAGE2);
    // Written to the store.
    const offline = createWkClient({
      fetch: (() => Promise.reject(new Error("x"))) as typeof fetch,
      store,
      now: () => 0,
    });
    expect((await offline.refresh()).cache).toEqual(expected);
  });

  it("sends only GETs to the API, token only in Authorization", async () => {
    const { client, f } = setup();
    await client.refresh();
    expect(f.calls.length).toBeGreaterThan(0);
    for (const c of f.calls) {
      expect(c.url.startsWith("https://api.wanikani.com/v2/")).toBe(true);
      expect(c.url).not.toContain(TOKEN);
      expect(c.init?.method).toBe("GET");
      expect(c.init?.body).toBeUndefined();
      const h = c.init?.headers as Record<string, string>;
      expect(h.Authorization).toBe(`Bearer ${TOKEN}`);
      expect(h["Wanikani-Revision"]).toBe("20170710");
      expect(Object.values(h).filter((v) => v.includes(TOKEN))).toHaveLength(1);
    }
  });

  it("refuses a next_url outside the API and keeps the cache", async () => {
    const { client, f, store } = setup();
    saveWkCache(store, expected);
    const evil = makeFetch((url) =>
      url.startsWith(`${WK_BASE}subjects`)
        ? json({ ...subjects[0], pages: { next_url: "https://evil.test/x" } })
        : (undefined as never),
    );
    const c2 = createWkClient({ fetch: evil.fn, store, now: () => 0 });
    const r = await c2.refresh();
    expect(r.status).toBe("offline");
    expect(r.cache).toEqual(expected);
    expect(evil.calls.some((c) => c.url.includes("evil"))).toBe(false);
    expect(f.calls).toHaveLength(0);
    void client;
  });

  it("never logs the token", async () => {
    const spies = (["log", "warn", "error", "info"] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => undefined),
    );
    const { client } = setup(() => json({}, 500));
    await client.refresh();
    for (const s of spies) {
      expect(JSON.stringify(s.mock.calls)).not.toContain(TOKEN);
      s.mockRestore();
    }
  });
});

describe("failures never throw", () => {
  it("401 gives invalid", async () => {
    const { client } = setup(() => json({ error: "no" }, 401));
    expect((await client.refresh()).status).toBe("invalid");
  });

  it.each([429, 500])(
    "%i gives offline with the stored cache",
    async (code) => {
      const { client, store } = setup(() => json({}, code));
      saveWkCache(store, expected);
      const r = await client.refresh();
      expect(r.status).toBe("offline");
      expect(r.cache).toEqual(expected);
    },
  );

  it("a network error gives offline with the stored cache", async () => {
    const { client, store } = setup(() => {
      throw new TypeError("Failed to fetch");
    });
    saveWkCache(store, expected);
    const r = await client.refresh();
    expect(r).toEqual({ status: "offline", cache: expected });
  });

  it("a malformed body gives offline", async () => {
    const bodies: Response[] = [
      new Response("<html>", { status: 200 }),
      json({ data: { level: "five" } }),
    ];
    for (const body of bodies) {
      const { client } = setup(() => body.clone());
      const r = await client.refresh();
      expect(r).toEqual({ status: "offline", cache: null });
    }
  });

  it("a malformed subject entry gives offline, not a partial cache", async () => {
    const { client, store } = setup((url) =>
      url.startsWith(`${WK_BASE}subjects`)
        ? json({ data: [{ id: 1, data: {} }] })
        : (undefined as never),
    );
    saveWkCache(store, expected);
    const r = await client.refresh();
    expect(r.status).toBe("offline");
    expect(r.cache).toEqual(expected);
  });
});

describe("throttle", () => {
  it("skips a refetch within 5 minutes and refetches after", async () => {
    const { client, f, clock } = setup();
    const a = await client.refresh();
    const n = f.calls.length;
    clock.advance(WK_THROTTLE_MS - 1);
    expect(await client.refresh()).toEqual(a);
    expect(f.calls).toHaveLength(n);
    clock.advance(1);
    await client.refresh();
    expect(f.calls.length).toBe(n * 2);
  });

  it("throttles failed attempts too", async () => {
    const { client, f } = setup(() => json({}, 429));
    await client.refresh();
    await client.refresh();
    expect(f.calls).toHaveLength(1);
  });

  it("a different token is not throttled", async () => {
    const { client, f, store } = setup();
    await client.refresh();
    const n = f.calls.length;
    saveToken(store, "another-token");
    await client.refresh();
    expect(f.calls.length).toBe(n * 2);
  });

  it("concurrent calls share one fetch", async () => {
    const { client, f } = setup();
    const [a, b] = await Promise.all([client.refresh(), client.refresh()]);
    expect(a).toBe(b);
    expect(f.calls).toHaveLength(4);
  });
});
