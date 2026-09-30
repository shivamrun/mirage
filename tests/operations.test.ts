import { describe, expect, it } from "vitest";
import { getMetricsSnapshot } from "@/adapters/operations/metrics";
import { observeRequest } from "@/adapters/operations/request-observability";
import { GET as metricsRoute } from "@/app/(backend)/api/admin/metrics/route";
import { app } from "@/server/routes";
import { createTestActor } from "./infra/admin-actor";
import { httpRequest } from "./infra/http-request";

describe("operational observability", () => {
  it("reports database-backed health", async () => {
    const response = await httpRequest(app, "/api/health");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      checks: {
        database: "ok",
        jobsRedis: "ok",
        redis: "not_configured",
      },
      ok: true,
    });
  });

  it("adds request IDs and records route metrics", async () => {
    const request = new Request("http://localhost/api/health", {
      headers: { "x-request-id": "test-request-id" },
    });
    const response = await observeRequest(request, (observedRequest) =>
      app.fetch(observedRequest),
    );

    expect(response.headers.get("x-request-id")).toBe("test-request-id");

    const snapshot = getMetricsSnapshot();
    expect(snapshot.requests.total).toBeGreaterThan(0);
    expect(snapshot.requests.byRoute["GET /api/health"]).toMatchObject({
      count: expect.any(Number),
      errorCount: expect.any(Number),
    });
  });

  it("normalizes dynamic path segments in route metrics", async () => {
    await observeRequest(
      new Request(
        "http://localhost/api/admin/users/8f4c2d1b-2d7a-4e49-9b11-56d0b82c3e00/sessions/abcdefghijklmnopqrstuvwxyz123456",
      ),
      () => Response.json({ ok: true }),
    );

    expect(
      getMetricsSnapshot().requests.byRoute[
        "GET /api/admin/users/:uuid/sessions/:id"
      ],
    ).toMatchObject({
      count: expect.any(Number),
    });
  });

  it("returns request IDs on unhandled API errors", async () => {
    const response = await observeRequest(
      new Request("http://localhost/api/explodes", {
        headers: { "x-request-id": "error-request-id" },
      }),
      () => {
        throw new Error("boom");
      },
    );

    expect(response.status).toBe(500);
    expect(response.headers.get("x-request-id")).toBe("error-request-id");
    expect(await response.json()).toEqual({
      message: "Internal server error.",
    });
  });

  it("protects the concrete admin metrics route", async () => {
    const anonymous = await metricsRoute(
      new Request("http://localhost/api/admin/metrics"),
    );

    expect(anonymous.status).toBe(404);

    const admin = await createTestActor({
      emailVerified: true,
      role: "admin",
    });
    const authorized = await metricsRoute(
      new Request("http://localhost/api/admin/metrics", {
        headers: { cookie: admin.cookie },
      }),
    );

    expect(authorized.status).toBe(200);
    expect(await authorized.json()).toMatchObject({
      generatedAt: expect.any(String),
      process: {
        uptimeSeconds: expect.any(Number),
      },
      requests: {
        byRoute: expect.any(Object),
        total: expect.any(Number),
      },
    });
  });
});
