import { and, asc, desc, eq, gt } from "drizzle-orm";

import db, { type DBClient } from "@/server/db";
import { paginateList, totalCount } from "@/server/db/helpers/paginate";
import { invitation, session, user } from "@/server/db/schema";

export type InvitationRecord = typeof invitation.$inferSelect;
export type CreateInvitationRecordValues = typeof invitation.$inferInsert;
export type AdminInvitationListItem = Pick<
  InvitationRecord,
  | "acceptedAt"
  | "acceptedByUserId"
  | "createdAt"
  | "email"
  | "expiresAt"
  | "id"
  | "invitedByUserId"
  | "revokedAt"
  | "role"
  | "status"
  | "updatedAt"
>;

const adminInvitationSelection = {
  acceptedAt: invitation.acceptedAt,
  acceptedByUserId: invitation.acceptedByUserId,
  createdAt: invitation.createdAt,
  email: invitation.email,
  expiresAt: invitation.expiresAt,
  id: invitation.id,
  invitedByUserId: invitation.invitedByUserId,
  revokedAt: invitation.revokedAt,
  role: invitation.role,
  status: invitation.status,
  updatedAt: invitation.updatedAt,
};

export async function createInvitationRecord(
  values: CreateInvitationRecordValues,
  executor: DBClient = db,
) {
  const [record] = await executor.insert(invitation).values(values).returning();

  if (!record) {
    throw new Error("Invitation could not be created.");
  }

  return record;
}

export async function findInvitationById(id: string) {
  const [record] = await db
    .select()
    .from(invitation)
    .where(eq(invitation.id, id))
    .limit(1);

  return record ?? null;
}

export async function findInvitationByTokenHash(tokenHash: string) {
  const [record] = await db
    .select()
    .from(invitation)
    .where(eq(invitation.tokenHash, tokenHash))
    .limit(1);

  return record ?? null;
}

export async function findInvitationByTokenHashForUpdate(
  tokenHash: string,
  executor: DBClient,
) {
  const [record] = await executor
    .select()
    .from(invitation)
    .where(eq(invitation.tokenHash, tokenHash))
    .for("update")
    .limit(1);

  return record ?? null;
}

export async function findActivePendingInvitationByEmail({
  email,
  now = new Date(),
  executor = db,
}: {
  email: string;
  executor?: DBClient;
  now?: Date;
}) {
  const [record] = await executor
    .select()
    .from(invitation)
    .where(
      and(
        eq(invitation.email, email),
        eq(invitation.status, "pending"),
        gt(invitation.expiresAt, now),
      ),
    )
    .orderBy(asc(invitation.createdAt))
    .limit(1);

  return record ?? null;
}

export async function markInvitationRevoked({
  id,
  now = new Date(),
}: {
  id: string;
  now?: Date;
}) {
  const [record] = await db
    .update(invitation)
    .set({
      revokedAt: now,
      status: "revoked",
      updatedAt: now,
    })
    .where(eq(invitation.id, id))
    .returning();

  return record ?? null;
}

export async function claimPendingInvitationForUser({
  email,
  executor,
  now = new Date(),
  tokenHash,
  userId,
}: {
  email: string;
  executor: DBClient;
  now?: Date;
  tokenHash: string;
  userId: string;
}) {
  const [record] = await executor
    .update(invitation)
    .set({
      acceptedAt: now,
      acceptedByUserId: userId,
      status: "accepted",
      updatedAt: now,
    })
    .where(
      and(
        eq(invitation.tokenHash, tokenHash),
        eq(invitation.email, email),
        eq(invitation.status, "pending"),
        gt(invitation.expiresAt, now),
      ),
    )
    .returning();

  return record ?? null;
}

export async function setUserRole({
  executor,
  role,
  userId,
}: {
  executor: DBClient;
  role: string;
  userId: string;
}) {
  const [record] = await executor
    .update(user)
    .set({ role, updatedAt: new Date() })
    .where(eq(user.id, userId))
    .returning();

  return record ?? null;
}

export async function revokeSessionsForUser(
  userId: string,
  executor: DBClient = db,
) {
  return executor.delete(session).where(eq(session.userId, userId)).returning();
}

export async function listAdminInvitations({
  limit,
  offset,
}: {
  limit: number;
  offset: number;
}) {
  return paginateList({
    limit,
    offset,
    query: db
      .select(adminInvitationSelection)
      .from(invitation)
      .orderBy(desc(invitation.createdAt), desc(invitation.id)),
    countQuery: db.select({ total: totalCount }).from(invitation),
  });
}

export async function listInvitationsByEmailForTest(email: string) {
  return db
    .select()
    .from(invitation)
    .where(eq(invitation.email, email))
    .orderBy(asc(invitation.createdAt), asc(invitation.id));
}
