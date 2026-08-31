import { and, eq } from "drizzle-orm";

import db from "@/server/db";
import { account } from "@/server/db/schema";

export async function getGoogleAccountByUserId(userId: string) {
  return db.query.account.findFirst({
    columns: {
      accountId: true,
      createdAt: true,
      idToken: true,
    },
    where: and(eq(account.userId, userId), eq(account.providerId, "google")),
  });
}
