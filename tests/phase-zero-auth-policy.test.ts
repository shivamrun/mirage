import { randomUUID } from "node:crypto";

import { createOTP } from "@better-auth/utils/otp";
import { symmetricEncrypt } from "better-auth/crypto";
import { eq, like } from "drizzle-orm";
import { Elysia } from "elysia";
import { describe, expect, it, vi } from "vitest";

import {
  GET as authGet,
  POST as authPost,
} from "@/app/(backend)/api/auth/[...all]/route";
import {
  bulkUpdateContactSubmissionStatusAction,
  updateContactSubmissionStatusAction,
} from "@/app/admin/contact-submission/all/actions";
import { env } from "@/lib/env";
import { auth } from "@/server/auth/better-auth";
import db from "@/server/db";
import {
  account,
  contactSubmission,
  session,
  twoFactor,
  user,
  verification,
} from "@/server/db/schema";
import { app } from "@/server/routes";
import { adminRoutes } from "@/server/routes/admin";
import { createTestActor } from "./infra/admin-actor";
import { httpRequest } from "./infra/http-request";

const origin = "http://localhost:3000";
const adminApp = new Elysia({ prefix: "/api" }).use(adminRoutes);
const jsonHeaders = { "content-type": "application/json", origin };

let requestHeaders = new Headers();

vi.mock("next/headers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/headers")>()),
  headers: async () => requestHeaders,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

async function addVerifiedTotp(userId: string) {
  const secret = `phase-zero-secret-${randomUUID()}`;
  await db.insert(twoFactor).values({
    backupCodes: await symmetricEncrypt({
      data: JSON.stringify([]),
      key: env.BETTER_AUTH_SECRET,
    }),
    id: randomUUID(),
    secret: await symmetricEncrypt({
      data: secret,
      key: env.BETTER_AUTH_SECRET,
    }),
    userId,
    verified: true,
  });
  return createOTP(secret, {
    digits: 6,
    period: 30,
  }).totp();
}

function wrongCode(code: string) {
  return code === "000000" ? "000001" : "000000";
}

describe("phase 0 auth policy locks", () => {
  it("denies admin access for a session created before TOTP enrollment", async () => {
    const target = await createTestActor();
    const admin = await createTestActor({
      emailVerified: true,
      role: "admin",
      twoFactorEnabled: false,
    });
    await db
      .update(user)
      .set({ twoFactorEnabled: true })
      .where(eq(user.id, admin.id));
    await db.insert(account).values({
      id: randomUUID(),
      accountId: `google-${admin.id}`,
      providerId: "google",
      userId: admin.id,
    });

    const customRead = await adminApp.fetch(
      new Request(`${origin}/api/admin/`, {
        headers: { cookie: admin.cookie },
      }),
    );
    expect(customRead.status).toBe(403);

    const listKey = "phase-zero-session-assurance";
    const customMutation = await adminApp.fetch(
      new Request(`${origin}/api/admin/email-list`, {
        method: "POST",
        headers: {
          ...jsonHeaders,
          cookie: admin.cookie,
        },
        body: JSON.stringify({ key: listKey, name: "Phase zero list" }),
      }),
    );
    expect(customMutation.status).toBe(403);

    const authRead = await authGet(
      new Request(`${origin}/api/auth/admin/list-users`, {
        headers: { cookie: admin.cookie },
      }),
    );
    expect(authRead.status).toBe(403);

    const authMutation = await authPost(
      new Request(`${origin}/api/auth/admin/set-role`, {
        method: "POST",
        headers: {
          ...jsonHeaders,
          cookie: admin.cookie,
        },
        body: JSON.stringify({ userId: target.id, role: "admin" }),
      }),
    );
    expect(authMutation.status).toBe(403);

    requestHeaders = new Headers({ cookie: admin.cookie });
    const [single, bulk] = await db
      .insert(contactSubmission)
      .values([
        {
          email: "phase-zero-single@example.com",
          message: "Single",
          name: "Single",
        },
        {
          email: "phase-zero-bulk@example.com",
          message: "Bulk",
          name: "Bulk",
        },
      ])
      .returning();
    const singleForm = new FormData();
    singleForm.set("id", single.id);
    singleForm.set("status", "read");
    const bulkForm = new FormData();
    bulkForm.set("fromStatus", "new");
    bulkForm.set("status", "archived");

    await expect(
      updateContactSubmissionStatusAction(singleForm),
    ).rejects.toThrow();
    await expect(
      bulkUpdateContactSubmissionStatusAction(bulkForm),
    ).rejects.toThrow();

    const [updatedTarget] = await db
      .select()
      .from(user)
      .where(eq(user.id, target.id));
    const [updatedSingle] = await db
      .select()
      .from(contactSubmission)
      .where(eq(contactSubmission.id, single.id));
    const [updatedBulk] = await db
      .select()
      .from(contactSubmission)
      .where(eq(contactSubmission.id, bulk.id));
    expect(updatedTarget?.role).toBe("user");
    expect(updatedSingle?.status).toBe("new");
    expect(updatedBulk?.status).toBe("new");
  });

  it("allows admin access after valid TOTP step-up for the current session", async () => {
    const admin = await createTestActor({
      emailVerified: true,
      role: "admin",
      twoFactorEnabled: false,
    });
    await db
      .update(user)
      .set({ twoFactorEnabled: true })
      .where(eq(user.id, admin.id));
    const code = await addVerifiedTotp(admin.id);

    const beforeStepUp = await adminApp.fetch(
      new Request(`${origin}/api/admin/`, {
        headers: { cookie: admin.cookie },
      }),
    );
    expect(beforeStepUp.status).toBe(403);

    const stepUp = await httpRequest(app, "/api/account/admin-step-up/totp", {
      method: "POST",
      cookie: admin.cookie,
      headers: jsonHeaders,
      body: JSON.stringify({ code }),
    });
    expect(stepUp.status).toBe(200);
    expect(await stepUp.json()).toEqual({ status: true });

    const afterStepUp = await adminApp.fetch(
      new Request(`${origin}/api/admin/`, {
        headers: { cookie: admin.cookie },
      }),
    );
    expect(afterStepUp.status).toBe(200);
  });

  it("locks admin step-up after repeated invalid TOTP codes and resets after success", async () => {
    const admin = await createTestActor({
      emailVerified: true,
      role: "admin",
      twoFactorEnabled: false,
    });
    await db
      .update(user)
      .set({ twoFactorEnabled: true })
      .where(eq(user.id, admin.id));
    const code = await addVerifiedTotp(admin.id);
    const invalidCode = wrongCode(code);

    for (let attempt = 0; attempt < 10; attempt++) {
      const response = await httpRequest(
        app,
        "/api/account/admin-step-up/totp",
        {
          method: "POST",
          cookie: admin.cookie,
          headers: jsonHeaders,
          body: JSON.stringify({ code: invalidCode }),
        },
      );
      expect(response.status).toBe(400);
    }

    const locked = await httpRequest(app, "/api/account/admin-step-up/totp", {
      method: "POST",
      cookie: admin.cookie,
      headers: jsonHeaders,
      body: JSON.stringify({ code }),
    });
    expect(locked.status).toBe(429);
    expect(Number(locked.headers.get("retry-after"))).toBeGreaterThan(0);

    const [lockedRow] = await db
      .select()
      .from(twoFactor)
      .where(eq(twoFactor.userId, admin.id));
    expect(lockedRow?.failedVerificationCount).toBe(10);
    expect(lockedRow?.lockedUntil?.getTime()).toBeGreaterThan(Date.now());

    await db
      .update(twoFactor)
      .set({ lockedUntil: new Date(Date.now() - 1000) })
      .where(eq(twoFactor.userId, admin.id));

    const afterExpiredLock = await httpRequest(
      app,
      "/api/account/admin-step-up/totp",
      {
        method: "POST",
        cookie: admin.cookie,
        headers: jsonHeaders,
        body: JSON.stringify({ code }),
      },
    );
    expect(afterExpiredLock.status).toBe(200);

    const [resetRow] = await db
      .select()
      .from(twoFactor)
      .where(eq(twoFactor.userId, admin.id));
    expect(resetRow?.failedVerificationCount).toBe(0);
    expect(resetRow?.lockedUntil).toBeNull();
  });

  it("keeps basic account routes available to unverified users", async () => {
    const actor = await createTestActor({ emailVerified: false });

    const accountResponse = await httpRequest(app, "/api/account/", {
      cookie: actor.cookie,
    });
    expect(accountResponse.status).toBe(200);

    const uploadValidationResponse = await httpRequest(app, "/api/uploads/", {
      method: "POST",
      cookie: actor.cookie,
      headers: jsonHeaders,
      body: JSON.stringify({
        contentType: "image/png",
        filename: "",
        key: "avatar",
        size: 10,
      }),
    });
    expect(uploadValidationResponse.status).toBe(400);
    expect(await uploadValidationResponse.json()).toEqual({
      message: "Filename is required.",
    });
  });

  it("keeps emergency global session purge admin-only and effective", async () => {
    const target = await createTestActor();
    const admin = await createTestActor({
      emailVerified: true,
      role: "admin",
    });
    const sessionsBefore = await db.select().from(session);
    expect(sessionsBefore.length).toBeGreaterThanOrEqual(2);

    const visitorResponse = await httpRequest(
      app,
      "/api/admin/security/revoke-all-sessions",
      {
        method: "POST",
        headers: jsonHeaders,
      },
    );
    expect(visitorResponse.status).toBe(404);

    const adminResponse = await httpRequest(
      app,
      "/api/admin/security/revoke-all-sessions",
      {
        method: "POST",
        cookie: admin.cookie,
        headers: jsonHeaders,
      },
    );
    expect(adminResponse.status).toBe(200);
    expect(await adminResponse.json()).toEqual({
      revokedSessions: sessionsBefore.length,
      status: true,
    });
    expect(await db.select().from(session)).toHaveLength(0);
    expect(
      await db.select().from(user).where(eq(user.id, target.id)),
    ).toHaveLength(1);
  });

  it("revokes existing sessions after ordinary password reset", async () => {
    const actor = await createTestActor();
    const before = await db
      .select()
      .from(session)
      .where(eq(session.userId, actor.id));
    expect(before.length).toBeGreaterThan(0);

    await auth.api.requestPasswordReset({
      body: {
        email: actor.email,
        redirectTo: `${origin}/reset-password`,
      },
      headers: new Headers({ origin }),
    });
    const [resetToken] = await db
      .select()
      .from(verification)
      .where(like(verification.identifier, "reset-password:%"))
      .limit(1);
    if (!resetToken) throw new Error("Expected a password reset token.");

    await auth.api.resetPassword({
      body: {
        newPassword: "NewTestPassword123!",
        token: resetToken.identifier.replace("reset-password:", ""),
      },
    });

    expect(
      await db.select().from(session).where(eq(session.userId, actor.id)),
    ).toHaveLength(0);
  });

  it.todo("disables implicit Google account linking");

  it.todo(
    "allows different-email Google linking only from signed-in account settings",
  );
});
