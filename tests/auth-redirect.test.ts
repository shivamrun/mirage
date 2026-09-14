import { describe, expect, it } from "vitest";

import { getLoginRedirectPath, getSafeAuthRedirect } from "@/lib/auth/redirect";

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
});
