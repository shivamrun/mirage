import { describe, expect, it } from "vitest";

import { app } from "@/server/routes";
import { createTestActor } from "./infra/admin-actor";

const origin = "http://localhost:3000";
const password = "TestPassword123!";

describe("Better Auth Elysia routes", () => {
  it("preserves session cookies through sign-in, session lookup, and sign-out", async () => {
    const actor = await createTestActor({ emailVerified: true });
    const signIn = await app.fetch(
      new Request(`${origin}/api/auth/sign-in/email`, {
        method: "POST",
        headers: { "content-type": "application/json", origin },
        body: JSON.stringify({ email: actor.email, password }),
      }),
    );

    expect(signIn.status).toBe(200);
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

  it("preserves OAuth callback URLs and state cookies", async () => {
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
    expect(new URL(body.url).searchParams.get("redirect_uri")).toBe(
      `${origin}/api/auth/callback/google`,
    );
    expect(
      response.headers
        .getSetCookie()
        .some((value) => value.includes("better-auth.state=")),
    ).toBe(true);
  });

  it("preserves two-factor challenge cookies", async () => {
    const actor = await createTestActor({ twoFactorEnabled: true });
    const response = await app.fetch(
      new Request(`${origin}/api/auth/sign-in/email`, {
        method: "POST",
        headers: { "content-type": "application/json", origin },
        body: JSON.stringify({ email: actor.email, password }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ twoFactorRedirect: true });
    expect(
      response.headers
        .getSetCookie()
        .some((value) => value.includes("better-auth.two_factor=")),
    ).toBe(true);
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
