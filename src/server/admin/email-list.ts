import type { AdminEmailSubscriberQueryState } from "@/lib/admin/email-list-query";
import {
  listEmailLists,
  listEmailSubscribers,
} from "@/server/db/dal/email-list";

export async function listAdminEmailListsView() {
  return listEmailLists();
}

export async function listAdminEmailSubscribersView({
  state,
}: {
  state: AdminEmailSubscriberQueryState;
}) {
  return listEmailSubscribers({ state });
}
