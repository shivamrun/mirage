import { and, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import db from "@/server/db";
import {
  getAdminUserDetail,
  listAdminUserCreditLedger,
  listAdminUserReferrals,
} from "@/server/db/dal/admin-user-detail";
import { findAcceptedInvitationForUser } from "@/server/db/dal/invitations";
import { referralCode, referrals, user } from "@/server/db/schema";
import { getCreditBalance } from "../credits/ledger";

const referrerUser = alias(user, "referrer_user");
const ADMIN_USER_DETAIL_PAGE_SIZE = 10;

export async function getAdminUserDetailView(userId: string) {
  const detail = await getAdminUserDetail(userId);

  if (!detail) {
    return null;
  }

  const [creditBalance, referralSummary, acceptedInvitation] =
    await Promise.all([
      getCreditBalance(userId),
      getAdminUserReferralSummaryView(userId),
      findAcceptedInvitationForUser(userId),
    ]);

  return {
    accounts: detail.accounts,
    acceptedInvitation,
    creditBalance,
    referralSummary,
    sessions: detail.sessions,
    user: detail.user,
  };
}

export async function getAdminUserReferralSummaryView(userId: string) {
  const [code, referredBy, total, completed, pending] = await Promise.all([
    db
      .select({
        code: referralCode.code,
        createdAt: referralCode.createdAt,
        id: referralCode.id,
      })
      .from(referralCode)
      .where(eq(referralCode.userId, userId))
      .limit(1),
    db
      .select({
        completedAt: referrals.completedAt,
        createdAt: referrals.createdAt,
        id: referrals.id,
        referralCode: referralCode.code,
        status: referrals.status,
        user: {
          email: referrerUser.email,
          id: referrerUser.id,
          image: referrerUser.image,
          name: referrerUser.name,
        },
      })
      .from(referrals)
      .innerJoin(referrerUser, eq(referrals.referrerUserId, referrerUser.id))
      .innerJoin(referralCode, eq(referrals.referralCodeId, referralCode.id))
      .where(eq(referrals.referredUserId, userId))
      .limit(1),
    db.$count(referrals, eq(referrals.referrerUserId, userId)),
    db.$count(
      referrals,
      and(
        eq(referrals.referrerUserId, userId),
        eq(referrals.status, "completed"),
      ),
    ),
    db.$count(
      referrals,
      and(
        eq(referrals.referrerUserId, userId),
        eq(referrals.status, "pending"),
      ),
    ),
  ]);

  return {
    code: code[0] ?? null,
    completedReferred: completed,
    pendingReferred: pending,
    referredBy: referredBy[0] ?? null,
    totalReferred: total,
  };
}

export async function getAdminUserReferralsView({
  page,
  userId,
}: {
  page: number;
  userId: string;
}) {
  return listAdminUserReferrals({
    limit: ADMIN_USER_DETAIL_PAGE_SIZE,
    page,
    userId,
  });
}

export async function getAdminUserCreditLedgerView({
  page,
  userId,
}: {
  page: number;
  userId: string;
}) {
  return listAdminUserCreditLedger({
    limit: ADMIN_USER_DETAIL_PAGE_SIZE,
    page,
    userId,
  });
}

export type AdminUserDetailViewModel = NonNullable<
  Awaited<ReturnType<typeof getAdminUserDetailView>>
>;
export type AdminUserDetailUser = AdminUserDetailViewModel["user"];
export type AdminUserDetailAcceptedInvitation =
  AdminUserDetailViewModel["acceptedInvitation"];
export type AdminUserDetailCreditBalance =
  AdminUserDetailViewModel["creditBalance"];
export type AdminUserDetailCreditLedgerEntry = Awaited<
  ReturnType<typeof getAdminUserCreditLedgerView>
>["items"][number];
export type AdminUserDetailAccount =
  AdminUserDetailViewModel["accounts"][number];
export type AdminUserDetailReferralSummary =
  AdminUserDetailViewModel["referralSummary"];
export type AdminUserDetailReferralsView = Awaited<
  ReturnType<typeof getAdminUserReferralsView>
>;
export type AdminUserDetailSession =
  AdminUserDetailViewModel["sessions"][number];
