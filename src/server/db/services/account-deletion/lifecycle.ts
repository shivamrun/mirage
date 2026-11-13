import { and, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { createStorageProfiles } from "@/adapters/uploads/storage";
import db, { type DBTransaction } from "@/server/db";
import { lockAccountDeletionUser } from "@/server/db/dal/account-deletion";
import { deleteInvitationsForUser } from "@/server/db/dal/invitations";
import {
  account,
  accountDeletionRequests,
  contactSubmission,
  creditLedgerEntries,
  emailContact,
  emailDeliveries,
  notification,
  subscription,
  user,
  userDataExports,
  verification,
} from "@/server/db/schema";
import {
  cancelBillingSubscriptions,
  deleteBillingCustomer,
} from "@/server/db/services/billing/customer-lifecycle";
import { deliverUserDataExport } from "./export";

const EXPORT_DELIVERY_WINDOW_SQL = sql`clock_timestamp() + interval '24 hours'`;

export async function startAccountDeletion(userId: string) {
  const deletion = await db.transaction(async (tx) => {
    await lockAccountDeletionUser(tx, userId);
    const [existingUser] = await tx
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    if (!existingUser) return { deleted: false as const };

    const [existingDeletion] = await tx
      .select()
      .from(accountDeletionRequests)
      .where(
        and(
          eq(accountDeletionRequests.userId, userId),
          eq(accountDeletionRequests.state, "deleting"),
        ),
      )
      .limit(1);
    if (existingDeletion) {
      return {
        attemptCount: existingDeletion.attemptCount,
        auditId: existingDeletion.id,
        deleted: true as const,
      };
    }

    const [audit] = await tx
      .insert(accountDeletionRequests)
      .values({
        cleanupPhase: "sessions_and_grants",
        deletingAt: sql`clock_timestamp()`,
        state: "deleting",
        userId,
      })
      .returning();
    if (!audit) throw new Error("Could not begin account deletion.");

    return {
      attemptCount: audit.attemptCount,
      auditId: audit.id,
      deleted: true as const,
    };
  });

  if (deletion.deleted) {
    await processAccountDeletion(deletion.auditId);
  }
  return deletion;
}

export async function processAccountDeletion(deletionId: string) {
  const [record] = await db
    .update(accountDeletionRequests)
    .set({
      attemptCount: sql`${accountDeletionRequests.attemptCount} + 1`,
      failureKind: null,
      lastAttemptAt: sql`clock_timestamp()`,
    })
    .where(
      and(
        eq(accountDeletionRequests.id, deletionId),
        eq(accountDeletionRequests.state, "deleting"),
        or(
          isNull(accountDeletionRequests.lastAttemptAt),
          lt(
            accountDeletionRequests.lastAttemptAt,
            sql`clock_timestamp() - interval '15 minutes'`,
          ),
        ),
      ),
    )
    .returning();
  if (!record?.userId || !record.cleanupPhase) {
    return { outcome: "noop" as const };
  }

  try {
    const nextPhase = await runAccountDeletionPhase({
      phase: record.cleanupPhase,
      deletionId: record.id,
      userId: record.userId,
    });
    if (nextPhase) {
      const advanced = await advanceAccountDeletion(
        record.id,
        record.cleanupPhase,
        nextPhase,
      );
      if (advanced) {
        await processAccountDeletion(record.id);
      }
    }
    return { outcome: "processed" as const };
  } catch (error) {
    await db
      .update(accountDeletionRequests)
      .set({
        failureKind: sanitizeFailureKind(error),
        lastAttemptAt: null,
      })
      .where(
        and(
          eq(accountDeletionRequests.id, record.id),
          eq(accountDeletionRequests.state, "deleting"),
          eq(accountDeletionRequests.cleanupPhase, record.cleanupPhase),
        ),
      );
    throw error;
  }
}

async function runAccountDeletionPhase({
  deletionId,
  phase,
  userId,
}: {
  deletionId: string;
  phase: (typeof accountDeletionRequests.$inferSelect)["cleanupPhase"];
  userId: string;
}) {
  switch (phase) {
    case "sessions_and_grants": {
      const linkedAccounts = await db
        .select({
          accessToken: account.accessToken,
          providerId: account.providerId,
          refreshToken: account.refreshToken,
        })
        .from(account)
        .where(eq(account.userId, userId));
      await revokeGoogleAccounts(linkedAccounts);
      return "billing" as const;
    }
    case "billing": {
      const [existingUser, subscriptions] = await Promise.all([
        db
          .select({ stripeCustomerId: user.stripeCustomerId })
          .from(user)
          .where(eq(user.id, userId))
          .limit(1)
          .then(([value]) => value),
        db
          .select({ stripeSubscriptionId: subscription.stripeSubscriptionId })
          .from(subscription)
          .where(eq(subscription.referenceId, userId)),
      ]);
      if (!existingUser) throw new Error("AccountDeletionUserNotFoundError");
      await deleteStripeResources({
        customerId: existingUser.stripeCustomerId,
        subscriptionIds: subscriptions.flatMap(({ stripeSubscriptionId }) =>
          stripeSubscriptionId ? [stripeSubscriptionId] : [],
        ),
      });
      return "storage" as const;
    }
    case "storage":
      await deleteUserUploads(userId);
      return "cross_user_data" as const;
    case "cross_user_data":
      await deleteCrossUserData({ deletionId, userId });
      return "owned_data" as const;
    case "owned_data":
      await deleteOwnedUserData({ deletionId, userId });
      return null;
    case "complete":
    case null:
      return null;
  }
}

async function advanceAccountDeletion(
  deletionId: string,
  currentPhase: NonNullable<
    (typeof accountDeletionRequests.$inferSelect)["cleanupPhase"]
  >,
  nextPhase: NonNullable<
    (typeof accountDeletionRequests.$inferSelect)["cleanupPhase"]
  >,
) {
  const [updated] = await db
    .update(accountDeletionRequests)
    .set({ cleanupPhase: nextPhase, lastAttemptAt: null })
    .where(
      and(
        eq(accountDeletionRequests.id, deletionId),
        eq(accountDeletionRequests.state, "deleting"),
        eq(accountDeletionRequests.cleanupPhase, currentPhase),
      ),
    )
    .returning({ id: accountDeletionRequests.id });
  return Boolean(updated);
}

async function deleteCrossUserData({
  deletionId,
  userId,
}: {
  deletionId: string;
  userId: string;
}) {
  await db.transaction(async (tx) => {
    await lockAccountDeletionUser(tx, userId);
    const [existingUser] = await tx
      .select({ email: user.email })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    if (!existingUser) throw new Error("AccountDeletionUserNotFoundError");
    const [audit] = await tx
      .select({ auditSubjectId: accountDeletionRequests.auditSubjectId })
      .from(accountDeletionRequests)
      .where(eq(accountDeletionRequests.id, deletionId))
      .limit(1);
    if (!audit) throw new Error("AccountDeletionRequestNotFoundError");

    await tx
      .update(subscription)
      .set({
        referenceId: `deleted:${audit.auditSubjectId}`,
        stripeCustomerId: null,
      })
      .where(eq(subscription.referenceId, userId));
    await tx
      .update(creditLedgerEntries)
      .set({
        metadata: sql`${creditLedgerEntries.metadata} - 'referredUserId' - 'referrerUserId'`,
      })
      .where(
        sql`${creditLedgerEntries.metadata}->>'referredUserId' = ${userId} or ${creditLedgerEntries.metadata}->>'referrerUserId' = ${userId}`,
      );
    await tx
      .delete(notification)
      .where(
        or(
          eq(notification.actorId, userId),
          eq(notification.subjectId, userId),
        ),
      );
    await deleteInvitationsForUser(
      { email: existingUser.email, userId },
      tx,
    );
    await tx
      .delete(emailDeliveries)
      .where(
        or(
          eq(emailDeliveries.recipientId, userId),
          sql`${emailDeliveries.data}->>'email' = ${existingUser.email}`,
          sql`${emailDeliveries.data}->>'referredUserEmail' = ${existingUser.email}`,
          sql`${emailDeliveries.data}->>'referrerEmail' = ${existingUser.email}`,
        ),
      );
    await tx
      .delete(contactSubmission)
      .where(eq(contactSubmission.email, existingUser.email));
    await tx
      .delete(emailContact)
      .where(eq(emailContact.email, existingUser.email));
    await tx
      .delete(verification)
      .where(
        or(
          eq(verification.identifier, existingUser.email),
          eq(verification.value, userId),
          sql`right(${verification.identifier}, length(${existingUser.email})) = ${existingUser.email}`,
        ),
      );
  });
}

async function deleteOwnedUserData({
  deletionId,
  userId,
}: {
  deletionId: string;
  userId: string;
}) {
  await db.transaction(async (tx) => {
    await lockAccountDeletionUser(tx, userId);
    await tx.delete(user).where(eq(user.id, userId));
    await tx
      .update(accountDeletionRequests)
      .set({
        cleanupPhase: "complete",
        completedAt: sql`clock_timestamp()`,
        state: "completed",
        userId: null,
      })
      .where(eq(accountDeletionRequests.id, deletionId));
  });
}

export async function requestUserDataExport(userId: string) {
  const exportRequest = await db.transaction(async (tx) => {
    await expireUserDataExports(tx, userId);
    const [created] = await tx
      .insert(userDataExports)
      .values({ deliveryDueAt: EXPORT_DELIVERY_WINDOW_SQL, userId })
      .onConflictDoNothing()
      .returning();
    if (created) return created;

    const [existing] = await tx
      .select()
      .from(userDataExports)
      .where(
        and(
          eq(userDataExports.userId, userId),
          inArray(userDataExports.status, ["pending", "processing", "failed"]),
        ),
      )
      .limit(1);
    if (!existing) throw new Error("Could not request the data export.");
    return existing;
  });

  await prepareAccountDataExport(exportRequest.id);
  return exportRequest;
}

export async function getUserDataExportStatus(userId: string) {
  const [record] = await db
    .select()
    .from(userDataExports)
    .where(eq(userDataExports.userId, userId))
    .orderBy(sql`${userDataExports.createdAt} desc`)
    .limit(1);
  return record ?? null;
}

export async function prepareAccountDataExport(exportId: string) {
  await db
    .update(userDataExports)
    .set({ failureKind: "DeliveryWindowExpired", status: "expired" })
    .where(
      and(
        eq(userDataExports.id, exportId),
        inArray(userDataExports.status, ["pending", "processing", "failed"]),
        sql`${userDataExports.deliveryDueAt} <= clock_timestamp()`,
      ),
    );
  const [record] = await db
    .update(userDataExports)
    .set({
      attemptCount: sql`${userDataExports.attemptCount} + 1`,
      failureKind: null,
      lastAttemptAt: sql`clock_timestamp()`,
      status: "processing",
    })
    .where(
      and(
        eq(userDataExports.id, exportId),
        or(
          inArray(userDataExports.status, ["pending", "failed"]),
          and(
            eq(userDataExports.status, "processing"),
            lt(
              userDataExports.lastAttemptAt,
              sql`clock_timestamp() - interval '15 minutes'`,
            ),
          ),
        ),
        sql`${userDataExports.deliveryDueAt} > clock_timestamp()`,
      ),
    )
    .returning();
  if (!record?.userId) return { outcome: "noop" as const };

  try {
    const result = await deliverUserDataExport({
      deliveryDueAt: record.deliveryDueAt,
      exportId: record.id,
      userId: record.userId,
    });
    if (!result.delivered) {
      if (result.reason === "expired") {
        await db
          .update(userDataExports)
          .set({ failureKind: "DeliveryWindowExpired", status: "expired" })
          .where(eq(userDataExports.id, record.id));
      } else {
        await db
          .delete(userDataExports)
          .where(eq(userDataExports.id, record.id));
      }
      return { outcome: "noop" as const };
    }

    await db
      .update(userDataExports)
      .set({
        checksum: result.checksum,
        failureKind: null,
        readyAt: sql`clock_timestamp()`,
        sizeBytes: result.sizeBytes,
        status: "ready",
      })
      .where(
        and(
          eq(userDataExports.id, record.id),
          eq(userDataExports.status, "processing"),
        ),
      );
    return { outcome: "delivered" as const };
  } catch (error) {
    await db
      .update(userDataExports)
      .set({ failureKind: sanitizeFailureKind(error), status: "failed" })
      .where(
        and(
          eq(userDataExports.id, record.id),
          eq(userDataExports.status, "processing"),
        ),
      );
    throw error;
  }
}

async function expireUserDataExports(tx: DBTransaction, userId: string) {
  await tx
    .update(userDataExports)
    .set({ failureKind: "DeliveryWindowExpired", status: "expired" })
    .where(
      and(
        eq(userDataExports.userId, userId),
        inArray(userDataExports.status, ["pending", "processing", "failed"]),
        sql`${userDataExports.deliveryDueAt} <= clock_timestamp()`,
      ),
    );
}

function sanitizeFailureKind(error: unknown) {
  return error instanceof Error && error.name
    ? error.name.slice(0, 80)
    : "UnknownError";
}

type DeletionLinkedAccount = {
  accessToken: null | string;
  providerId: string;
  refreshToken: null | string;
};

async function revokeGoogleAccounts(accounts: DeletionLinkedAccount[]) {
  for (const linkedAccount of accounts) {
    if (linkedAccount.providerId !== "google") continue;
    const token = linkedAccount.accessToken ?? linkedAccount.refreshToken;
    if (!token) continue;

    const response = await fetch("https://oauth2.googleapis.com/revoke", {
      body: new URLSearchParams({ token }),
      headers: { "content-type": "application/x-www-form-urlencoded" },
      method: "POST",
    });
    if (!response.ok && response.status !== 400 && response.status !== 404) {
      throw new Error("GoogleRevokeError");
    }
  }
}

async function deleteStripeResources({
  customerId,
  subscriptionIds,
}: {
  customerId: null | string;
  subscriptionIds: string[];
}) {
  await cancelBillingSubscriptions(subscriptionIds);

  if (customerId) {
    await deleteBillingCustomer(customerId);
  }
}

async function deleteUserUploads(userId: string) {
  const storage = createStorageProfiles().s3;
  if (!storage.deletePrefix) {
    throw new Error("UploadDeletionUnsupportedError");
  }

  await storage.deletePrefix(`avatars/${userId}`);
}
