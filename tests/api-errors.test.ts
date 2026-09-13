import { node } from "@elysia/node";
import { Elysia, t } from "elysia";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { apiErrors } from "@/server/http/errors";
import { httpRequest } from "./infra/http-request";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Elysia API error boundary", () => {
  it("sanitizes and logs an unexpected error from a child plugin", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const child = new Elysia({ prefix: "/fixture" }).get(
      "/throw/:token",
      () => {
        throw new Error("private-error-value");
      },
    );
    const app = new Elysia({ adapter: node(), prefix: "/api" })
      .use(apiErrors)
      .use(child);

    const response = await httpRequest(
      app,
      "/api/fixture/throw/path-secret?token=query-secret",
    );

    expect(response.status).toBe(500);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toEqual({
      message: "Internal server error.",
    });
    expect(log).toHaveBeenCalledExactlyOnceWith("Unhandled Elysia API error", {
      method: "GET",
      path: "/api/fixture/throw/:token",
      type: "UNKNOWN",
    });
  });

  it("treats response-schema failures as internal errors", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const child = new Elysia({ prefix: "/fixture" }).get(
      "/invalid-response",
      () => ({ count: "private-value" as unknown as number }),
      { response: t.Object({ count: t.Number() }) },
    );
    const app = new Elysia({ adapter: node(), prefix: "/api" })
      .use(apiErrors)
      .use(child);

    const response = await httpRequest(app, "/api/fixture/invalid-response");

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      message: "Internal server error.",
    });
    expect(log).toHaveBeenCalledExactlyOnceWith("Unhandled Elysia API error", {
      method: "GET",
      path: "/api/fixture/invalid-response",
      type: "RESPONSE_VALIDATION",
    });
  });

  it("preserves deliberately thrown HTTP statuses and headers", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const child = new Elysia({ prefix: "/fixture" })
      .get("/denied", ({ status }) => {
        throw status(403, { message: "Denied." });
      })
      .get("/unavailable", ({ set, status }) => {
        set.headers["Retry-After"] = "30";
        throw status(503, { message: "Feature unavailable." });
      });
    const app = new Elysia({ adapter: node(), prefix: "/api" })
      .use(apiErrors)
      .use(child);

    const denied = await httpRequest(app, "/api/fixture/denied");
    expect(denied.status).toBe(403);
    expect(await denied.json()).toEqual({ message: "Denied." });

    const unavailable = await httpRequest(app, "/api/fixture/unavailable");
    expect(unavailable.status).toBe(503);
    expect(unavailable.headers.get("Retry-After")).toBe("30");
    expect(await unavailable.json()).toEqual({
      message: "Feature unavailable.",
    });
    expect(log).not.toHaveBeenCalled();
  });

  it("returns the first input message without submitted values and keeps returned responses intact", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const child = new Elysia({ prefix: "/fixture" })
      .post("/validated", ({ body }) => body, {
        body: t.Object({
          name: t.String({
            minLength: 4,
            maxLength: 8,
            error: "Name must be between 4 and 8 characters.",
          }),
        }),
      })
      .post("/generic-validation", ({ body }) => body, {
        body: t.Object({ name: t.String() }),
      })
      .post("/zod-validation", ({ body }) => body, {
        body: z.object({
          name: z.string().min(4, "Name must be at least 4 characters."),
        }),
      })
      .get("/status", ({ set, status }) => {
        set.headers["Retry-After"] = "12";
        return status(429, { message: "Slow down." });
      })
      .get("/response", () =>
        Response.json(
          { message: "Feature unavailable." },
          { status: 503, headers: { "X-Feature": "kept" } },
        ),
      );
    const app = new Elysia({ adapter: node(), prefix: "/api" })
      .use(apiErrors)
      .use(child);

    const invalid = await httpRequest(app, "/api/fixture/validated", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "x" }),
    });
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toEqual({
      message: "Name must be between 4 and 8 characters.",
    });

    const genericInvalid = await httpRequest(
      app,
      "/api/fixture/generic-validation",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: { secret: "private-input-value" } }),
      },
    );
    expect(genericInvalid.status).toBe(400);
    expect(await genericInvalid.json()).toEqual({ message: "Expected string" });

    const zodInvalid = await httpRequest(app, "/api/fixture/zod-validation", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "x" }),
    });
    expect(zodInvalid.status).toBe(400);
    expect(await zodInvalid.json()).toEqual({
      message: "Name must be at least 4 characters.",
    });

    const returnedStatus = await httpRequest(app, "/api/fixture/status");
    expect(returnedStatus.status).toBe(429);
    expect(returnedStatus.headers.get("Retry-After")).toBe("12");
    expect(await returnedStatus.json()).toEqual({ message: "Slow down." });

    const returnedResponse = await httpRequest(app, "/api/fixture/response");
    expect(returnedResponse.status).toBe(503);
    expect(returnedResponse.headers.get("X-Feature")).toBe("kept");
    expect(await returnedResponse.json()).toEqual({
      message: "Feature unavailable.",
    });
    expect(log).not.toHaveBeenCalled();
  });
});
