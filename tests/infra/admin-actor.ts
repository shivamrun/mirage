import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import db from "@/server/db";
import { markAdminSessionAssurance } from "@/server/db/dal/admin-session-assurance";
import { user } from "@/server/db/schema";

const password = "TestPassword123!";
const origin = "http://localhost:3000";

async function authRequest(path: string, body: object) {
  const response = await auth.handler(
    new Request(`${origin}/api/auth${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin },
      body: JSON.stringify(body),
    }),
  );
  if (!response.ok) {
    throw new Error(
      `${path} failed: ${response.status} ${await response.text()}`,
    );
  }
  return response;
}

export async function createTestActor({
  role = "user",
  emailVerified = false,
  twoFactorEnabled,
}: {
  role?: "admin" | "user";
  emailVerified?: boolean;
  twoFactorEnabled?: boolean;
} = {}) {
  const email = `test-${randomUUID()}@example.com`;
  await authRequest("/sign-up/email", {
    email,
    password,
    agreeToTerms: true,
  });

  const [record] = await db.select().from(user).where(eq(user.email, email));
  if (!record) throw new Error("Test actor was not created.");
  await db
    .update(user)
    .set({ role, emailVerified })
    .where(eq(user.id, record.id));

  const response = await authRequest("/sign-in/email", { email, password });
  const sessionCookie = response.headers
    .getSetCookie()
    .find((value) => value.includes("better-auth.session_token="))
    ?.split(";")[0];
  if (!sessionCookie)
    throw new Error("Sign-in did not return a session cookie.");

  await db
    .update(user)
    .set({ twoFactorEnabled: twoFactorEnabled ?? role === "admin" })
    .where(eq(user.id, record.id));

  const authSession = await auth.api.getSession({
    headers: new Headers({ cookie: sessionCookie }),
  });
  if (
    authSession &&
    role === "admin" &&
    (twoFactorEnabled ?? role === "admin")
  ) {
    await markAdminSessionAssurance({
      sessionId: authSession.session.id,
      userId: record.id,
    });
  }

  return { cookie: sessionCookie, email, id: record.id };
}
