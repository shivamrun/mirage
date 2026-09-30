import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import db from "@/server/db";
import {
  createInvitationRecord,
  findActivePendingInvitationByEmail,
  findInvitationById,
  findInvitationByTokenHash,
  revokeActivePendingInvitation,
} from "@/server/db/dal/invitations";
import { invitation, user } from "@/server/db/schema";
import {
  buildInvitationAcceptUrl,
  createInvitation,
  createInvitationToken,
  getEffectiveInvitationStatus,
  hashInvitationToken,
} from "@/server/db/services/invitations/service";

async function createUser(email = `user-${randomUUID()}@example.com`) {
  const [record] = await db
    .insert(user)
    .values({
      email,
      id: randomUUID(),
      name: "Test User",
    })
    .returning();

  if (!record) {
    throw new Error("Test user could not be created.");
  }

  return record;
}

async function createInvitationFixture({
  email = `invite-${randomUUID()}@example.com`,
  expiresAt = new Date(Date.now() + 60_000),
  invitedByUserId,
  status = "pending",
  tokenHash = hashInvitationToken(createInvitationToken()),
}: Partial<typeof invitation.$inferInsert> & { invitedByUserId: string }) {
  return createInvitationRecord({
    email,
    expiresAt,
    invitedByUserId,
    role: "user",
    status,
    tokenHash,
  });
}

describe("invitation tokens", () => {
  it("puts invitation tokens in the URL fragment", () => {
    const token = "a".repeat(64);
    const url = new URL(buildInvitationAcceptUrl(token));

    expect(url.search).toBe("");
    expect(url.hash).toBe(`#token=${token}`);
  });

  it("generates 64-character hex tokens", () => {
    expect(createInvitationToken()).toMatch(/^[a-f0-9]{64}$/);
  });

  it("hashes tokens deterministically with distinct hashes per token", () => {
    const token = "a".repeat(64);

    expect(hashInvitationToken(token)).toBe(hashInvitationToken(token));
    expect(hashInvitationToken(token)).not.toBe(
      hashInvitationToken("b".repeat(64)),
    );
  });

  it("never persists the raw invitation token", async () => {
    const inviter = await createUser();
    const result = await createInvitation({
      email: "TokenTarget@example.com",
      invitedByUserId: inviter.id,
    });

    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.token).toMatch(/^[a-f0-9]{64}$/);
    expect(result.invitation.tokenHash).toBe(hashInvitationToken(result.token));
    expect(result.invitation.tokenHash).not.toBe(result.token);

    const [stored] = await db
      .select()
      .from(invitation)
      .where(eq(invitation.id, result.invitation.id));
    expect(stored?.tokenHash).toBe(hashInvitationToken(result.token));
    expect(JSON.stringify(stored)).not.toContain(result.token);
  });
});

describe("invitation effective status", () => {
  it("keeps future pending invitations pending", () => {
    expect(
      getEffectiveInvitationStatus(
        {
          expiresAt: new Date("2026-01-08T00:00:00.000Z"),
          status: "pending",
        },
        new Date("2026-01-01T00:00:00.000Z"),
      ),
    ).toBe("pending");
  });

  it("derives expired only for past pending invitations", () => {
    expect(
      getEffectiveInvitationStatus(
        {
          expiresAt: new Date("2025-12-31T00:00:00.000Z"),
          status: "pending",
        },
        new Date("2026-01-01T00:00:00.000Z"),
      ),
    ).toBe("expired");
  });

  it("treats the exact expiry boundary as expired", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    expect(
      getEffectiveInvitationStatus({ expiresAt: now, status: "pending" }, now),
    ).toBe("expired");
  });

  it.each(["accepted", "revoked"] as const)(
    "keeps %s status regardless of expiration",
    (status) => {
      expect(
        getEffectiveInvitationStatus(
          {
            expiresAt: new Date("2025-12-31T00:00:00.000Z"),
            status,
          },
          new Date("2026-01-01T00:00:00.000Z"),
        ),
      ).toBe(status);
    },
  );
});

describe("invitation creation", () => {
  it("normalizes email before storing and checking duplicates", async () => {
    const inviter = await createUser();
    const created = await createInvitation({
      email: "  Duplicate.Target+Case@Example.COM  ",
      invitedByUserId: inviter.id,
    });

    expect(created.status).toBe("success");
    if (created.status !== "success") return;
    expect(created.invitation.email).toBe("duplicate.target+case@example.com");

    const duplicate = await createInvitation({
      email: "duplicate.target+case@example.com",
      invitedByUserId: inviter.id,
    });
    expect(duplicate.status).toBe("duplicate-active-invitation");
  });

  it("rejects invalid email", async () => {
    const inviter = await createUser();

    await expect(
      createInvitation({ email: "not-an-email", invitedByUserId: inviter.id }),
    ).resolves.toEqual({ status: "invalid-email" });
  });

  it("rejects existing user email via auth user lookup", async () => {
    const inviter = await createUser();
    await createUser("existing-user@example.com");

    await expect(
      createInvitation({
        email: "Existing-User@example.com",
        invitedByUserId: inviter.id,
      }),
    ).resolves.toEqual({ status: "existing-user" });
  });

  it("rejects duplicate active pending invitations", async () => {
    const inviter = await createUser();
    const email = `duplicate-${randomUUID()}@example.com`;

    expect(
      (await createInvitation({ email, invitedByUserId: inviter.id })).status,
    ).toBe("success");
    expect(
      (await createInvitation({ email, invitedByUserId: inviter.id })).status,
    ).toBe("duplicate-active-invitation");
  });

  it("serializes concurrent creation for the same email", async () => {
    const inviter = await createUser();
    const email = `concurrent-${randomUUID()}@example.com`;

    const results = await Promise.all([
      createInvitation({ email, invitedByUserId: inviter.id }),
      createInvitation({
        email: email.toUpperCase(),
        invitedByUserId: inviter.id,
      }),
    ]);

    expect(results.map((result) => result.status).sort()).toEqual([
      "duplicate-active-invitation",
      "success",
    ]);
  });

  it("allows a new invitation after a revoked invitation", async () => {
    const inviter = await createUser();
    const email = `revoked-${randomUUID()}@example.com`;
    const created = await createInvitation({
      email,
      invitedByUserId: inviter.id,
    });
    expect(created.status).toBe("success");
    if (created.status !== "success") return;

    await revokeActivePendingInvitation({
      expectedTokenHash: created.invitation.tokenHash,
      id: created.invitation.id,
    });

    const next = await createInvitation({ email, invitedByUserId: inviter.id });
    expect(next.status).toBe("success");
  });

  it("allows a new invitation after an effectively expired invitation", async () => {
    const inviter = await createUser();
    const email = `expired-${randomUUID()}@example.com`;
    await createInvitationFixture({
      email,
      expiresAt: new Date(Date.now() - 60_000),
      invitedByUserId: inviter.id,
    });

    const next = await createInvitation({ email, invitedByUserId: inviter.id });
    expect(next.status).toBe("success");
  });

  it("defaults role to user", async () => {
    const inviter = await createUser();
    const created = await createInvitation({
      email: `role-default-${randomUUID()}@example.com`,
      invitedByUserId: inviter.id,
    });

    expect(created.status).toBe("success");
    if (created.status !== "success") return;
    expect(created.invitation.role).toBe("user");
  });

  it("rejects roles outside existing auth roles", async () => {
    const inviter = await createUser();

    await expect(
      createInvitation({
        email: `bad-role-${randomUUID()}@example.com`,
        invitedByUserId: inviter.id,
        role: "owner",
      }),
    ).resolves.toEqual({ status: "invalid-role" });
  });
});

describe("invitation DAL", () => {
  it("creates and finds invitations by id", async () => {
    const inviter = await createUser();
    const created = await createInvitationFixture({
      invitedByUserId: inviter.id,
    });

    await expect(findInvitationById(created.id)).resolves.toMatchObject({
      email: created.email,
      id: created.id,
    });
  });

  it("finds invitations by token hash", async () => {
    const inviter = await createUser();
    const tokenHash = hashInvitationToken("c".repeat(64));
    const created = await createInvitationFixture({
      invitedByUserId: inviter.id,
      tokenHash,
    });

    await expect(findInvitationByTokenHash(tokenHash)).resolves.toMatchObject({
      id: created.id,
      tokenHash,
    });
  });

  it("active pending lookup excludes revoked and expired pending rows", async () => {
    const inviter = await createUser();
    const revokedEmail = `revoked-dal-${randomUUID()}@example.com`;
    const expiredEmail = `expired-dal-${randomUUID()}@example.com`;
    const activeEmail = `active-dal-${randomUUID()}@example.com`;

    await createInvitationFixture({
      email: revokedEmail,
      invitedByUserId: inviter.id,
      status: "revoked",
    });
    await createInvitationFixture({
      email: expiredEmail,
      expiresAt: new Date(Date.now() - 60_000),
      invitedByUserId: inviter.id,
    });
    const active = await createInvitationFixture({
      email: activeEmail,
      expiresAt: new Date(Date.now() + 60_000),
      invitedByUserId: inviter.id,
    });

    await expect(
      findActivePendingInvitationByEmail({ email: revokedEmail }),
    ).resolves.toBeNull();
    await expect(
      findActivePendingInvitationByEmail({ email: expiredEmail }),
    ).resolves.toBeNull();
    await expect(
      findActivePendingInvitationByEmail({ email: activeEmail }),
    ).resolves.toMatchObject({ id: active.id });
  });
});
