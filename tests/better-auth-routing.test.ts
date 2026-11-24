import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

import { signupAttributionCookie } from "@/adapters/analytics/events";
import { analytics } from "@/adapters/analytics/server";
import { auth } from "@/features/auth/better-auth/server";
import { app } from "@/server/routes";
import { createTestActor } from "./infra/admin-actor";

const origin = "http://localhost:3000";
const password = "TestPassword123!";

describe("Better Auth Elysia routes", () => {
  afterEach(() => vi.restoreAllMocks());

  it("preserves session cookies through sign-in, session lookup, and sign-out", async () => {
    const actor = await createTestActor({ emailVerified: true });
    const track = vi.spyOn(analytics, "track");
    const signIn = await app.fetch(
      new Request(`${origin}/api/auth/sign-in/email`, {
        method: "POST",
        headers: { "content-type": "application/json", origin },
        body: JSON.stringify({ email: actor.email, password }),
      }),
    );

    expect(signIn.status).toBe(200);
    expect(track).toHaveBeenCalledWith("login_completed", {
      context: { distinctId: actor.id },
    });
    const sessionCookie = signIn.headers
      .getSetCookie()
      .find((value) => value.includes("better-auth.session_token="))
      ?.split(";", 1)[0];
    expect(sessionCookie).toBeTruthy();

    const session = await app.fetch(
      new Request(`${origin}/api/auth/get-session`, {
        headers: { cookie: sessionCookie as string },
      }),
    );
    expect(session.status).toBe(200);
    expect(await session.json()).toMatchObject({
      user: { email: actor.email, id: actor.id },
    });

    const signOut = await app.fetch(
      new Request(`${origin}/api/auth/sign-out`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: sessionCookie as string,
          origin,
        },
      }),
    );
    expect(signOut.status).toBe(200);
    expect(
      signOut.headers
        .getSetCookie()
        .some((value) => value.includes("better-auth.session_token=")),
    ).toBe(true);

    const revokedSession = await app.fetch(
      new Request(`${origin}/api/auth/get-session`, {
        headers: { cookie: sessionCookie as string },
      }),
    );
    expect(revokedSession.status).toBe(200);
    expect(await revokedSession.json()).toBeNull();

    const passwordReset = await app.fetch(
      new Request(`${origin}/api/auth/request-password-reset`, {
        method: "POST",
        headers: { "content-type": "application/json", origin },
        body: JSON.stringify({
          email: actor.email,
          redirectTo: `${origin}/reset-password`,
        }),
      }),
    );
    expect(passwordReset.status).toBe(200);
  });

  it("records Google signup and login after a successful OAuth callback", async () => {
    const track = vi.spyOn(analytics, "track");
    const google = (await auth.$context).socialProviders.find(
      (provider) => provider.id === "google",
    );
    if (!google)
      throw new Error("Google provider is not configured for tests.");
    const profile = {
      email: `${randomUUID()}@example.com`,
      sub: randomUUID(),
    };
    vi.spyOn(google, "validateAuthorizationCode").mockResolvedValue({
      accessToken: "test-google-token",
    });
    vi.spyOn(google, "getUserInfo").mockResolvedValue({
      data: profile,
      user: {
        email: profile.email,
        emailVerified: true,
        name: "Google Test",
      },
    });

    const response = await app.fetch(
      new Request(`${origin}/api/auth/sign-in/social`, {
        method: "POST",
        headers: { "content-type": "application/json", origin },
        body: JSON.stringify({
          callbackURL: `${origin}/welcome`,
          provider: "google",
        }),
      }),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { url: string };
    const authorizationUrl = new URL(body.url);
    expect(authorizationUrl.searchParams.get("redirect_uri")).toBe(
      `${origin}/api/auth/callback/google`,
    );
    expect(
      response.headers
        .getSetCookie()
        .some((value) => value.includes("better-auth.state=")),
    ).toBe(true);

    const callback = new URL("/api/auth/callback/google", origin);
    callback.searchParams.set(
      "state",
      authorizationUrl.searchParams.get("state") ?? "",
    );
    callback.searchParams.set("code", "test-google-code");
    const cookies = response.headers
      .getSetCookie()
      .map((value) => value.split(";", 1)[0]);
    const attribution = { utmSource: "youtube" };
    cookies.push(
      `${signupAttributionCookie}=${encodeURIComponent(JSON.stringify(attribution))}`,
    );
    expect(track).not.toHaveBeenCalled();

    const completed = await app.fetch(
      new Request(callback, {
        headers: { cookie: cookies.join("; ") },
      }),
    );
    expect(completed.status).toBe(302);
    expect(completed.headers.get("location")).toBe(`${origin}/welcome`);
    expect(track).toHaveBeenCalledWith(
      "signup_completed",
      { attribution },
      {
        context: { distinctId: expect.any(String) },
      },
    );
    expect(track).toHaveBeenCalledWith("login_completed", {
      context: { distinctId: expect.any(String) },
    });
  });

  it("preserves two-factor challenge cookies", async () => {
    const actor = await createTestActor({ twoFactorEnabled: true });
    const track = vi.spyOn(analytics, "track");
    const response = await app.fetch(
      new Request(`${origin}/api/auth/sign-in/email`, {
        method: "POST",
        headers: { "content-type": "application/json", origin },
        body: JSON.stringify({ email: actor.email, password }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ twoFactorRedirect: true });
    expect(track).not.toHaveBeenCalledWith(
      "login_completed",
      expect.anything(),
    );
    expect(
      response.headers
        .getSetCookie()
        .some((value) => value.includes("better-auth.two_factor=")),
    ).toBe(true);
  });

  it("includes first-touch campaign fields on completed signup", async () => {
    const track = vi.spyOn(analytics, "track");
    const attribution = { utmCampaign: "launch", utmSource: "youtube" };
    const encoded = encodeURIComponent(JSON.stringify(attribution));
    const response = await app.fetch(
      new Request(`${origin}/api/auth/sign-up/email`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `${signupAttributionCookie}=${encoded}`,
          origin,
        },
        body: JSON.stringify({
          agreeToTerms: true,
          email: `${randomUUID()}@example.com`,
          password,
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(track).toHaveBeenCalledWith(
      "signup_completed",
      { attribution },
      {
        context: { distinctId: expect.any(String) },
      },
    );
  });

  it("keeps the Better Auth mount scoped to /api/auth", async () => {
    const authNotFound = await app.fetch(
      new Request(`${origin}/api/auth/not-a-real-endpoint`),
    );
    expect(authNotFound.status).toBe(404);

    const apiNotFound = await app.fetch(
      new Request(`${origin}/api/not-a-real-endpoint`),
    );
    expect(apiNotFound.status).toBe(404);
    expect(await apiNotFound.json()).toEqual({ message: "Not Found" });
  });
});
