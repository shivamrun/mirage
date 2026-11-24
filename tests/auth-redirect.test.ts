import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/features/auth/better-auth/server";
import {
  getLoginRedirectPath,
  getSafeAuthRedirect,
} from "@/features/auth/redirect";
import { config, proxy } from "@/proxy";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("auth redirect policy", () => {
  it.each([
    [undefined, "/"],
    ["", "/"],
    ["admin", "/"],
    ["//evil.example/admin", "/"],
    ["https://evil.example/admin", "/"],
    ["http://localhost/admin", "/"],
    ["/admin", "/admin"],
    ["/admin?tab=users", "/admin?tab=users"],
    ["/account/security#two-factor", "/account/security#two-factor"],
    [
      "/checkout?plan=pro&interval=monthly",
      "/checkout?plan=pro&interval=monthly",
    ],
  ] as const)("normalizes %s to %s", (input, expected) => {
    expect(getSafeAuthRedirect(input)).toBe(expected);
  });

  it("builds login redirects with an encoded safe callback", () => {
    expect(getLoginRedirectPath("/admin?tab=users")).toBe(
      "/login?callbackURL=%2Fadmin%3Ftab%3Dusers",
    );
    expect(getLoginRedirectPath("https://evil.example/admin")).toBe(
      "/login?callbackURL=%2F",
    );
  });

  it("prevents invite token referrer and cache leakage", async () => {
    vi.spyOn(auth.api, "getSession").mockResolvedValueOnce(null);

    const response = await proxy(
      new NextRequest("http://localhost:3000/invite/accept?token=secret-token"),
    );

    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});

describe("analytics proxy", () => {
  it.each<{ path: string; method: string; headers: Record<string, string> }>([
    { path: "/stats.js", method: "GET", headers: { accept: "*/*" } },
    { path: "/STATS.JS", method: "GET", headers: { accept: "*/*" } },
    {
      path: "/api/send",
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-umami-cache": "test-cache",
        "x-umami-hostname": "localhost",
        "x-umami-website-id": "test-website",
      },
    },
    {
      path: "/Api/sEND",
      method: "POST",
      headers: { "content-type": "application/json" },
    },
  ])("removes sensitive headers from $method $path", async (testCase) => {
    const getSession = vi.spyOn(auth.api, "getSession").mockResolvedValue(null);
    const sensitiveHeaders = {
      authorization: "Bearer test",
      cookie: "session=test",
      "proxy-authorization": "Basic test",
      referer: "http://localhost:3000/?token=test",
    };
    const headers = new Headers({ ...sensitiveHeaders, ...testCase.headers });
    const url = `http://localhost:3000${testCase.path}`;
    expect(unstable_doesMiddlewareMatch({ config, url })).toBe(true);

    const response = await proxy(
      new NextRequest(url, {
        headers,
        method: testCase.method,
      }),
    );

    expect(getSession).not.toHaveBeenCalled();
    expect(response.headers.get("x-middleware-next")).toBe("1");
    const forwardedHeaders = response.headers
      .get("x-middleware-override-headers")
      ?.split(",");
    expect(forwardedHeaders).toBeDefined();
    for (const name of Object.keys(sensitiveHeaders)) {
      expect(forwardedHeaders).not.toContain(name);
      expect(response.headers.has(`x-middleware-request-${name}`)).toBe(false);
    }
    for (const [name, value] of Object.entries(testCase.headers)) {
      expect(response.headers.get(`x-middleware-request-${name}`)).toBe(value);
    }
  });
});
