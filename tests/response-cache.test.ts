import { Elysia } from "elysia";
import { afterEach, describe, expect, it } from "vitest";

import { cacheStore } from "@/adapters/cache";
import { responseCache } from "@/server/http/response-cache";
import { installMemoryCacheStore } from "./infra/memory-cache";

let memoryCache: ReturnType<typeof installMemoryCacheStore> | null = null;

afterEach(() => {
  memoryCache?.restore();
  memoryCache = null;
});

function installCache() {
  memoryCache = installMemoryCacheStore();
  return memoryCache;
}

describe("responseCache macro", () => {
  it("stores the first GET response and serves the second from cache", async () => {
    installCache();
    let calls = 0;
    const app = new Elysia().use(responseCache).get(
      "/value",
      () => {
        calls += 1;
        return { calls };
      },
      {
        routeCache: {
          policy: "activeEmailLists",
        },
      },
    );

    const first = await app.fetch(new Request("http://localhost/value"));
    const second = await app.fetch(new Request("http://localhost/value"));

    expect(first.headers.get("X-Cache")).toBe("MISS");
    expect(second.headers.get("X-Cache")).toBe("HIT");
    await expect(first.json()).resolves.toEqual({ calls: 1 });
    await expect(second.json()).resolves.toEqual({ calls: 1 });
    expect(calls).toBe(1);
  });

  it("isolates private cache entries per authenticated user id", async () => {
    installCache();
    let calls = 0;
    const app = new Elysia()
      .derive(({ request }) => ({
        user: { id: request.headers.get("x-user-id") ?? "" },
      }))
      .use(responseCache)
      .get(
        "/private",
        ({ user }) => {
          calls += 1;
          return { calls, userId: user.id };
        },
        {
          routeCache: {
            policy: "apiCreditBalance",
          },
        },
      );

    const first = await app.fetch(
      new Request("http://localhost/private", {
        headers: { "x-user-id": "user-1" },
      }),
    );
    const second = await app.fetch(
      new Request("http://localhost/private", {
        headers: { "x-user-id": "user-2" },
      }),
    );
    const third = await app.fetch(
      new Request("http://localhost/private", {
        headers: { "x-user-id": "user-1" },
      }),
    );

    expect(first.headers.get("X-Cache")).toBe("MISS");
    expect(second.headers.get("X-Cache")).toBe("MISS");
    expect(third.headers.get("X-Cache")).toBe("HIT");
    await expect(third.json()).resolves.toEqual({ calls: 1, userId: "user-1" });
    expect(calls).toBe(2);
  });

  it("requires and scopes an admin user for admin cache policies", async () => {
    installCache();
    let calls = 0;
    const app = new Elysia()
      .derive(({ request }) => {
        const adminId = request.headers.get("x-admin-id");
        const userId = request.headers.get("x-user-id");

        if (adminId) {
          return { authUser: { id: adminId, roles: ["user", "admin"] } };
        }

        return userId ? { authUser: { id: userId, roles: ["user"] } } : {};
      })
      .use(responseCache)
      .get(
        "/admin",
        ({ authUser }) => {
          calls += 1;
          return { calls, userId: authUser.id };
        },
        {
          routeCache: {
            policy: "adminEmailListSummary",
          },
        },
      );

    const anonymous = await app.fetch(new Request("http://localhost/admin"));
    const regularUser = await app.fetch(
      new Request("http://localhost/admin", {
        headers: { "x-user-id": "user-1" },
      }),
    );
    const first = await app.fetch(
      new Request("http://localhost/admin", {
        headers: { "x-admin-id": "admin-1" },
      }),
    );
    const second = await app.fetch(
      new Request("http://localhost/admin", {
        headers: { "x-admin-id": "admin-2" },
      }),
    );
    const third = await app.fetch(
      new Request("http://localhost/admin", {
        headers: { "x-admin-id": "admin-1" },
      }),
    );

    expect(anonymous.status).toBe(401);
    expect(anonymous.headers.get("X-Cache")).toBe("BYPASS");
    expect(regularUser.status).toBe(401);
    expect(regularUser.headers.get("X-Cache")).toBe("BYPASS");
    expect(first.headers.get("X-Cache")).toBe("MISS");
    expect(second.headers.get("X-Cache")).toBe("MISS");
    expect(third.headers.get("X-Cache")).toBe("HIT");
    await expect(third.json()).resolves.toEqual({
      calls: 1,
      userId: "admin-1",
    });
    expect(calls).toBe(2);
  });

  it("normalizes query params into stable cache keys", async () => {
    installCache();
    let calls = 0;
    const app = new Elysia().use(responseCache).get(
      "/items",
      ({ request }) => {
        calls += 1;
        return {
          calls,
          query: new URL(request.url).search,
        };
      },
      {
        routeCache: {
          policy: "activeEmailLists",
        },
      },
    );

    const first = await app.fetch(
      new Request("http://localhost/items?b=2&a=1"),
    );
    const second = await app.fetch(
      new Request("http://localhost/items?a=1&b=2"),
    );

    expect(first.headers.get("X-Cache")).toBe("MISS");
    expect(second.headers.get("X-Cache")).toBe("HIT");
    await expect(second.json()).resolves.toEqual({
      calls: 1,
      query: "?b=2&a=1",
    });
    expect(calls).toBe(1);
  });

  it("misses old entries after generation increments", async () => {
    installCache();
    let calls = 0;
    const generationParts = ["credit-balance", "user-1"];
    const app = new Elysia()
      .derive(() => ({ user: { id: "user-1" } }))
      .use(responseCache)
      .get(
        "/balance",
        () => {
          calls += 1;
          return { calls };
        },
        {
          routeCache: {
            generationParts,
            policy: "apiCreditBalance",
          },
        },
      );

    const first = await app.fetch(new Request("http://localhost/balance"));
    const second = await app.fetch(new Request("http://localhost/balance"));
    await cacheStore.incrementGeneration({
      parts: generationParts,
      policy: "apiCreditBalance",
    });
    const third = await app.fetch(new Request("http://localhost/balance"));

    expect(first.headers.get("X-Cache")).toBe("MISS");
    expect(second.headers.get("X-Cache")).toBe("HIT");
    expect(third.headers.get("X-Cache")).toBe("MISS");
    await expect(third.json()).resolves.toEqual({ calls: 2 });
    expect(calls).toBe(2);
  });

  it("does not cache non-200 responses or raw Response values", async () => {
    installCache();
    let statusCalls = 0;
    let rawCalls = 0;
    const app = new Elysia()
      .use(responseCache)
      .get(
        "/missing",
        ({ status }) => {
          statusCalls += 1;
          return status(404, { message: "Missing" });
        },
        {
          routeCache: {
            policy: "activeEmailLists",
          },
        },
      )
      .get(
        "/raw",
        () => {
          rawCalls += 1;
          return Response.json({ calls: rawCalls });
        },
        {
          routeCache: {
            policy: "activeEmailLists",
          },
        },
      );

    const firstStatus = await app.fetch(
      new Request("http://localhost/missing"),
    );
    const secondStatus = await app.fetch(
      new Request("http://localhost/missing"),
    );
    const firstRaw = await app.fetch(new Request("http://localhost/raw"));
    const secondRaw = await app.fetch(new Request("http://localhost/raw"));

    expect(firstStatus.headers.get("X-Cache")).toBe("MISS");
    expect(secondStatus.headers.get("X-Cache")).toBe("MISS");
    expect(firstRaw.headers.get("X-Cache")).toBe("MISS");
    expect(secondRaw.headers.get("X-Cache")).toBe("MISS");
    await expect(firstRaw.json()).resolves.toEqual({ calls: 1 });
    await expect(secondRaw.json()).resolves.toEqual({ calls: 2 });
    expect(statusCalls).toBe(2);
    expect(rawCalls).toBe(2);
  });
});
