import {
  ADMIN_EMAIL_SUBMISSIONS_PAGE_SIZE,
  type AdminEmailSubscriberQueryState,
} from "@/features/admin/query/email-list-query";
import type { DBClient } from "@/server/db";
import {
  createEmailList,
  deleteEmailList,
  listEmailLists,
  listEmailSubscribers,
  seedEmailLists,
  updateEmailList,
  updateEmailListStatus,
} from "@/server/db/dal/email-list";
import {
  canDeleteEmailList,
  defaultEmailLists,
} from "@/server/db/services/email-list/config";
import { EMAIL_LIST_VERIFICATION_PREFIX } from "@/server/db/services/email-list/verification";
import { resolvePaginatedView } from "@/server/db/services/pagination";
import type {
  AdminCreateEmailListValues,
  EmailListStatus,
} from "@/shared/schemas";

type AdminUpdateEmailListValues = Omit<AdminCreateEmailListValues, "key"> & {
  key: string;
};

type AdminUpdateEmailListStatusValues = {
  key: string;
  status: EmailListStatus;
};

export async function seedDefaultEmailLists(executor?: DBClient) {
  return seedEmailLists(defaultEmailLists, executor);
}

export async function listAdminEmailListsView() {
  const lists = await listEmailLists();

  return lists.map((list) => ({
    ...list,
    canDelete: canDeleteEmailList(list.key),
  }));
}

export async function listAdminEmailSubscribersView({
  page,
  state,
}: {
  page: number;
  state: AdminEmailSubscriberQueryState;
}) {
  const result = await resolvePaginatedView({
    limit: ADMIN_EMAIL_SUBMISSIONS_PAGE_SIZE,
    page,
    loadPage: async ({ limit, offset }) => {
      const result = await listEmailSubscribers({
        limit,
        offset,
        state,
      });

      return {
        items: result.subscribers,
        total: result.total,
      };
    },
  });

  return {
    ...result.pagination,
    subscribers: result.items,
  };
}

export async function createAdminEmailList(values: AdminCreateEmailListValues) {
  const list = await createEmailList(values);

  return list
    ? {
        list,
        status: "created" as const,
      }
    : {
        status: "failed" as const,
      };
}

export async function updateAdminEmailList(values: AdminUpdateEmailListValues) {
  const list = await updateEmailList(values);

  return list
    ? {
        list,
        status: "updated" as const,
      }
    : {
        status: "not-found" as const,
      };
}

export async function updateAdminEmailListStatus(
  values: AdminUpdateEmailListStatusValues,
) {
  const list = await updateEmailListStatus(values);

  return list
    ? {
        status: "updated" as const,
      }
    : {
        status: "not-found" as const,
      };
}

export async function deleteAdminEmailList(key: string) {
  if (!canDeleteEmailList(key)) {
    return { status: "protected" as const };
  }

  return deleteEmailList({
    key,
    verificationIdentifierPrefix: EMAIL_LIST_VERIFICATION_PREFIX,
  });
}
