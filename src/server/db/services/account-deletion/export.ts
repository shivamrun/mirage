import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { eq, or } from "drizzle-orm";
import { createElement } from "react";

import { sendEmail } from "@/adapters/email";
import AccountDataExportTemplate from "@/adapters/email/templates/account-data-export";
import { getUploadPublicUrl } from "@/adapters/uploads";
import { isUploadKey } from "@/features/uploads/keys";
import db from "@/server/db";
import {
  account,
  contactSubmission,
  creditAccounts,
  creditLedgerEntries,
  creditPeriodGrants,
  emailContact,
  emailSubscription,
  invitation,
  notification,
  referralCode,
  referrals,
  subscription,
  user,
} from "@/server/db/schema";

const sensitiveKeyPattern =
  /(password|token|secret|hash|code|url|credential|authorization)/i;

function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitize);
  if (!value || typeof value !== "object") return value;
  if (value instanceof Date) return value.toISOString();

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !sensitiveKeyPattern.test(key))
      .map(([key, nested]) => [key, sanitize(nested)]),
  );
}

export async function createUserDataExport(userId: string) {
  return db.transaction(
    async (tx) => {
      const [profile] = await tx
        .select({
          createdAt: user.createdAt,
          email: user.email,
          emailVerified: user.emailVerified,
          id: user.id,
          image: user.image,
          name: user.name,
          role: user.role,
          twoFactorEnabled: user.twoFactorEnabled,
          updatedAt: user.updatedAt,
        })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);
      if (!profile) return null;

      const [
        linkedAccounts,
        subscriptions,
        creditAccount,
        creditLedger,
        creditGrants,
        notifications,
        codes,
        referralHistory,
        invitations,
        contacts,
        submissions,
      ] = await Promise.all([
        tx
          .select({
            accountId: account.accountId,
            createdAt: account.createdAt,
            providerId: account.providerId,
            updatedAt: account.updatedAt,
          })
          .from(account)
          .where(eq(account.userId, userId)),
        tx
          .select()
          .from(subscription)
          .where(eq(subscription.referenceId, userId)),
        tx
          .select()
          .from(creditAccounts)
          .where(eq(creditAccounts.userId, userId)),
        tx
          .select()
          .from(creditLedgerEntries)
          .where(eq(creditLedgerEntries.userId, userId)),
        tx
          .select()
          .from(creditPeriodGrants)
          .where(eq(creditPeriodGrants.userId, userId)),
        tx
          .select({
            archivedAt: notification.archivedAt,
            category: notification.category,
            createdAt: notification.createdAt,
            data: notification.data,
            id: notification.id,
            readAt: notification.readAt,
            seenAt: notification.seenAt,
            subjectType: notification.subjectType,
            type: notification.type,
          })
          .from(notification)
          .where(eq(notification.recipientId, userId)),
        tx.select().from(referralCode).where(eq(referralCode.userId, userId)),
        tx
          .select()
          .from(referrals)
          .where(
            or(
              eq(referrals.referrerUserId, userId),
              eq(referrals.referredUserId, userId),
            ),
          ),
        tx
          .select({
            acceptedAt: invitation.acceptedAt,
            createdAt: invitation.createdAt,
            email: invitation.email,
            expiresAt: invitation.expiresAt,
            id: invitation.id,
            role: invitation.role,
            revokedAt: invitation.revokedAt,
            status: invitation.status,
            updatedAt: invitation.updatedAt,
          })
          .from(invitation)
          .where(
            or(
              eq(invitation.invitedByUserId, userId),
              eq(invitation.acceptedByUserId, userId),
              eq(invitation.email, profile.email),
            ),
          ),
        tx
          .select({
            contact: emailContact,
            subscription: emailSubscription,
          })
          .from(emailContact)
          .leftJoin(
            emailSubscription,
            eq(emailSubscription.contactId, emailContact.id),
          )
          .where(eq(emailContact.email, profile.email)),
        tx
          .select()
          .from(contactSubmission)
          .where(eq(contactSubmission.email, profile.email)),
      ]);

      return sanitize({
        manifest: {
          exportedAt: new Date().toISOString(),
          format: "mirage-user-data-export",
          version: 1,
        },
        profile,
        linkedAccounts,
        billing: { subscriptions },
        credits: {
          account: creditAccount[0] ?? null,
          grants: creditGrants,
          ledger: creditLedger,
        },
        notifications,
        referrals: { codes, history: referralHistory },
        invitations,
        emailLists: contacts,
        contactSubmissions: submissions,
      });
    },
    { accessMode: "read only", isolationLevel: "repeatable read" },
  );
}

export async function deliverUserDataExport({
  deliveryDueAt,
  exportId,
  userId,
}: {
  deliveryDueAt: Date;
  exportId: string;
  userId: string;
}) {
  const archive = await createUserDataExport(userId);
  if (!archive) return { delivered: false as const, reason: "user_not_found" };
  if (deliveryDueAt.getTime() <= Date.now()) {
    return { delivered: false as const, reason: "expired" };
  }

  const json = Buffer.from(`${JSON.stringify(archive, null, 2)}\n`, "utf8");
  const compressed = gzipSync(json, { level: 9 });
  const checksum = createHash("sha256").update(compressed).digest("hex");
  const profile = (
    archive as {
      profile: { email: string; image?: null | string; name?: string };
    }
  ).profile;
  const avatar = await loadAvatarAttachment(profile.image);
  const result = await sendEmail({
    attachments: [
      {
        content: compressed,
        contentType: "application/gzip",
        filename: "mirage-data-export.json.gz",
      },
      ...(avatar ? [avatar] : []),
    ],
    idempotencyKey: `account-data-export:${exportId}`,
    react: createElement(AccountDataExportTemplate, { name: profile.name }),
    subject: "Your Mirage data export",
    tags: [{ name: "category", value: "account-data-export" }],
    text: [
      `Hi ${profile.name || "there"},`,
      "Your requested Mirage account data export is attached as a compressed JSON file.",
      "Keep it private because it may contain personal information.",
    ].join("\n\n"),
    to: profile.email,
  });

  if (result.skipped) {
    throw new Error("Data export email delivery is not configured.");
  }

  return {
    checksum,
    delivered: true as const,
    sizeBytes: compressed.byteLength,
  };
}

async function loadAvatarAttachment(image?: null | string) {
  if (!image || !isUploadKey(image)) return null;

  try {
    const response = await fetch(getUploadPublicUrl(image));
    if (!response.ok) return null;
    return {
      content: Buffer.from(await response.arrayBuffer()),
      contentType: response.headers.get("content-type") ?? undefined,
      filename: `avatar${image.match(/\.[A-Za-z0-9]+$/)?.[0] ?? ""}`,
    };
  } catch {
    return null;
  }
}
