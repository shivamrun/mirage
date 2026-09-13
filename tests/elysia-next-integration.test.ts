import { Elysia, t } from "elysia";
import { describe, expect, it } from "vitest";

import { apiErrors } from "@/server/http/errors";
import { requestPolicy } from "@/server/http/request-policy";
import { httpRequest } from "./infra/http-request";

function createFixtureApp() {
  return new Elysia({ prefix: "/api" })
    .use(apiErrors)
    .use(requestPolicy)
    .get("/health", () => ({ ok: true }))
    .post("/echo", ({ body, status }) => status(201, body), {
      body: t.Object({
        name: t.String({
          minLength: 2,
          error: "Name must be at least 2 characters.",
        }),
      }),
      response: {
        201: t.Object({ name: t.String() }),
        400: t.Object({ message: t.String() }),
      },
    })
    .post(
      "/origin-guarded",
      ({ set }) => {
        set.headers["X-Phase"] = "10";
        return { status: true as const };
      },
      {
        sameOrigin: true,
        response: {
          200: t.Object({ status: t.Literal(true) }),
          403: t.Object({ message: t.String() }),
        },
      },
    )
    .get("/raw-response", () =>
      Response.json(
        { message: "kept" },
        { status: 202, headers: { "X-Raw": "kept" } },
      ),
    );
}

describe("Elysia and Next route-handler compatibility", () => {
  const app = createFixtureApp();

  it("serves ordinary responses", async () => {
    const response = await httpRequest(app, "/api/health");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("parses and validates JSON bodies", async () => {
    const valid = await httpRequest(app, "/api/echo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Phase 10" }),
    });

    expect(valid.status).toBe(201);
    expect(await valid.json()).toEqual({ name: "Phase 10" });

    const invalid = await httpRequest(app, "/api/echo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "x" }),
    });

    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toEqual({
      message: "Name must be at least 2 characters.",
    });
  });

  it("keeps returned raw Response objects", async () => {
    const response = await httpRequest(app, "/api/raw-response");

    expect(response.status).toBe(202);
    expect(response.headers.get("X-Raw")).toBe("kept");
    expect(await response.json()).toEqual({ message: "kept" });
  });

  it("preserves the same-origin macro behavior", async () => {
    const blocked = await httpRequest(app, "/api/origin-guarded", {
      method: "POST",
      headers: { origin: "https://evil.example" },
    });

    expect(blocked.status).toBe(403);
    expect(await blocked.json()).toEqual({
      message: "Invalid request origin.",
    });

    const allowed = await httpRequest(app, "/api/origin-guarded", {
      method: "POST",
      headers: { origin: "http://localhost:3000" },
    });

    expect(allowed.status).toBe(200);
    expect(allowed.headers.get("X-Phase")).toBe("10");
    expect(await allowed.json()).toEqual({ status: true });
  });
});
