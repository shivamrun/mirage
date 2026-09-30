import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/features/auth/better-auth/server";
import {
  getLoginRedirectPath,
  getSafeAuthRedirect,
} from "@/features/auth/redirect";
import { proxy } from "@/proxy";

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
