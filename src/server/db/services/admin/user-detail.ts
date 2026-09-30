import { and, desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import db from "@/server/db";
import { getAdminUserDetail } from "@/server/db/dal/admin-user-detail";
import { findAcceptedInvitationForUser } from "@/server/db/dal/invitations";
import { paginateList, totalCount } from "@/server/db/helpers/paginate";
import {
  creditLedgerEntries,
  referralCode,
  referrals,
  user,
} from "@/server/db/schema";
import { resolvePaginatedView } from "@/server/db/services/pagination";
import { DEFAULT_PAGE_SIZE } from "@/shared/pagination";
import { getCreditBalance } from "../credits/ledger";

const referrerUser = alias(user, "referrer_user");
const referredUser = alias(user, "referred_user");

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
    db
      .select({ total: totalCount })
      .from(referrals)
      .where(eq(referrals.referrerUserId, userId)),
    db
      .select({ total: totalCount })
      .from(referrals)
      .where(
        and(
          eq(referrals.referrerUserId, userId),
          eq(referrals.status, "completed"),
        ),
      ),
    db
      .select({ total: totalCount })
      .from(referrals)
      .where(
        and(
          eq(referrals.referrerUserId, userId),
          eq(referrals.status, "pending"),
        ),
      ),
  ]);

  return {
    code: code[0] ?? null,
    completedReferred: completed[0]?.total ?? 0,
    pendingReferred: pending[0]?.total ?? 0,
    referredBy: referredBy[0] ?? null,
    totalReferred: total[0]?.total ?? 0,
  };
}

export async function getAdminUserReferralsView({
  page,
  userId,
}: {
  page: number;
  userId: string;
}) {
  const summary = await getAdminUserReferralSummaryView(userId);
  const result = await resolvePaginatedView({
    limit: DEFAULT_PAGE_SIZE,
    page,
    loadPage: ({ limit, offset }) =>
      paginateList({
        countQuery: db
          .select({ total: totalCount })
          .from(referrals)
          .where(eq(referrals.referrerUserId, userId)),
        limit,
        offset,
        query: db
          .select({
            completedAt: referrals.completedAt,
            createdAt: referrals.createdAt,
            id: referrals.id,
            status: referrals.status,
            user: {
              email: referredUser.email,
              id: referredUser.id,
              image: referredUser.image,
              name: referredUser.name,
            },
          })
          .from(referrals)
          .innerJoin(
            referredUser,
            eq(referrals.referredUserId, referredUser.id),
          )
          .where(eq(referrals.referrerUserId, userId))
          .orderBy(desc(referrals.createdAt)),
      }),
  });

  return {
    ...summary,
    pagination: result.pagination,
    referredUsers: result.items,
  };
}

export async function getAdminUserCreditLedgerView({
  page,
  userId,
}: {
  page: number;
  userId: string;
}) {
  return resolvePaginatedView({
    limit: DEFAULT_PAGE_SIZE,
    page,
    loadPage: ({ limit, offset }) =>
      paginateList({
        countQuery: db
          .select({ total: totalCount })
          .from(creditLedgerEntries)
          .where(eq(creditLedgerEntries.userId, userId)),
        limit,
        offset,
        query: db
          .select()
          .from(creditLedgerEntries)
          .where(eq(creditLedgerEntries.userId, userId))
          .orderBy(desc(creditLedgerEntries.createdAt)),
      }),
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
