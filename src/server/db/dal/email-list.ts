import { randomUUID } from "node:crypto";

import { and, asc, desc, eq, gt, ilike, or, type SQL, sql } from "drizzle-orm";
import db, { type DBClient } from "@/server/db";
import {
  emailContact,
  emailList,
  emailSubscription,
  verification,
} from "@/server/db/schema";
import type {
  AdminCreateEmailListValues,
  AdminEmailSubscriberQueryState,
  EmailListStatus,
  EmailSubscriptionValues,
} from "@/shared/schemas";

type UpdateEmailListStatusOptions = {
  key: string;
  status: EmailListStatus;
};

type SeedEmailListValues = {
  description: string | null;
  emailVerificationRequired: boolean;
  key: string;
  name: string;
  status: EmailListStatus;
};

export async function seedEmailLists(
  lists: SeedEmailListValues[],
  executor: DBClient = db,
) {
  await executor
    .insert(emailList)
    .values(lists)
    .onConflictDoUpdate({
      target: emailList.key,
      set: {
        description: sql`excluded.description`,
        emailVerificationRequired: true,
        name: sql`excluded.name`,
        updatedAt: new Date(),
      },
    });
}

function getSubscriberListCondition(state: AdminEmailSubscriberQueryState) {
  return state.listKey ? eq(emailSubscription.listKey, state.listKey) : null;
}

function getSubscriberStatusCondition(state: AdminEmailSubscriberQueryState) {
  return state.status ? eq(emailSubscription.status, state.status) : null;
}

function getSubscriberSearchCondition(state: AdminEmailSubscriberQueryState) {
  const query = state.query.trim();

  if (!query) {
    return null;
  }

  const pattern = `%${query}%`;

  return or(
    ilike(emailContact.email, pattern),
    ilike(emailSubscription.listKey, pattern),
    ilike(emailSubscription.source, pattern),
  );
}

function getSubscriberWhereClause(state: AdminEmailSubscriberQueryState) {
  const conditions = [
    getSubscriberListCondition(state),
    getSubscriberStatusCondition(state),
    getSubscriberSearchCondition(state),
  ].filter((condition): condition is SQL => Boolean(condition));

  return conditions.length > 0 ? and(...conditions) : undefined;
}

export async function subscribeEmailToList(values: EmailSubscriptionValues) {
  return db.transaction(async (tx) => {
    const [list] = await tx
      .select({
        emailVerificationRequired: emailList.emailVerificationRequired,
        key: emailList.key,
        name: emailList.name,
      })
      .from(emailList)
      .where(
        and(eq(emailList.key, values.listKey), eq(emailList.status, "active")),
      )
      .limit(1);

    if (!list) return { status: "unknown-list" as const };

    const subscriptionStatus = list.emailVerificationRequired
      ? "pending"
      : "subscribed";

    const [contact] = await tx
      .insert(emailContact)
      .values({
        email: values.email,
      })
      .onConflictDoUpdate({
        target: emailContact.email,
        set: {
          updatedAt: new Date(),
        },
      })
      .returning({
        id: emailContact.id,
        email: emailContact.email,
      });

    if (!contact) {
      throw new Error("Email contact could not be created.");
    }

    const [subscription] = await tx
      .insert(emailSubscription)
      .values({
        contactId: contact.id,
        listKey: values.listKey,
        metadata: values.metadata,
        source: values.source,
        status: subscriptionStatus,
      })
      .onConflictDoUpdate({
        target: [emailSubscription.contactId, emailSubscription.listKey],
        set: {
          metadata: values.metadata,
          source: values.source,
          status: sql`case when ${emailSubscription.status} = 'subscribed' then ${emailSubscription.status} else ${subscriptionStatus} end`,
          updatedAt: new Date(),
        },
      })
      .returning({
        id: emailSubscription.id,
        listKey: emailSubscription.listKey,
        status: emailSubscription.status,
      });

    if (!subscription) {
      throw new Error("Email subscription could not be created.");
    }

    return {
      contact,
      list,
      subscription,
      status: "created" as const,
    };
  });
}

export async function createEmailList(values: AdminCreateEmailListValues) {
  const [list] = await db
    .insert(emailList)
    .values({
      description: values.description,
      emailVerificationRequired: values.emailVerificationRequired,
      key: values.key,
      name: values.name,
      status: "active",
    })
    .onConflictDoUpdate({
      target: emailList.key,
      set: {
        description: values.description,
        emailVerificationRequired: values.emailVerificationRequired,
        name: values.name,
        status: "active",
        updatedAt: new Date(),
      },
    })
    .returning({
      description: emailList.description,
      emailVerificationRequired: emailList.emailVerificationRequired,
      key: emailList.key,
      name: emailList.name,
      status: emailList.status,
    });

  return list;
}

export async function updateEmailList(values: AdminCreateEmailListValues) {
  const [list] = await db
    .update(emailList)
    .set({
      description: values.description,
      emailVerificationRequired: values.emailVerificationRequired,
      name: values.name,
      updatedAt: new Date(),
    })
    .where(eq(emailList.key, values.key))
    .returning({
      description: emailList.description,
      emailVerificationRequired: emailList.emailVerificationRequired,
      key: emailList.key,
      name: emailList.name,
      status: emailList.status,
    });

  return list;
}

export async function updateEmailListStatus({
  key,
  status,
}: UpdateEmailListStatusOptions) {
  const [list] = await db
    .update(emailList)
    .set({
      status,
      updatedAt: new Date(),
    })
    .where(eq(emailList.key, key))
    .returning({
      key: emailList.key,
      status: emailList.status,
    });

  return list ?? null;
}

export async function deleteEmailList({
  key,
  verificationIdentifierPrefix,
}: {
  key: string;
  verificationIdentifierPrefix: string;
}) {
  const [list] = await db
    .select({
      key: emailList.key,
    })
    .from(emailList)
    .where(eq(emailList.key, key))
    .limit(1);

  if (!list) {
    return { status: "not-found" as const };
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(emailSubscription)
      .where(eq(emailSubscription.listKey, key));
    await tx.delete(emailList).where(eq(emailList.key, key));
    await tx
      .delete(verification)
      .where(
        and(
          ilike(verification.identifier, `${verificationIdentifierPrefix}:%`),
          sql`(${verification.value}::jsonb ->> 'listKey') = ${key}`,
        ),
      );
  });

  return { status: "deleted" as const };
}

export async function listEmailLists() {
  return db
    .select({
      activeSubscribers: sql<number>`count(${emailSubscription.id}) filter (where ${emailSubscription.status} = 'subscribed')::int`,
      createdAt: emailList.createdAt,
      description: emailList.description,
      emailVerificationRequired: emailList.emailVerificationRequired,
      key: emailList.key,
      name: emailList.name,
      status: emailList.status,
      totalSubscribers: sql<number>`count(${emailSubscription.id})::int`,
      updatedAt: emailList.updatedAt,
    })
    .from(emailList)
    .leftJoin(emailSubscription, eq(emailSubscription.listKey, emailList.key))
    .groupBy(emailList.key)
    .orderBy(asc(emailList.key));
}

export async function listEmailSubscribers({
  state,
}: {
  state: AdminEmailSubscriberQueryState;
}) {
  const whereClause = getSubscriberWhereClause(state);
  let subscribersQuery = db
    .select({
      createdAt: emailSubscription.createdAt,
      email: emailContact.email,
      id: emailContact.id,
      listKey: emailSubscription.listKey,
      listName: emailList.name,
      metadata: emailSubscription.metadata,
      source: emailSubscription.source,
      status: emailSubscription.status,
      subscriptionId: emailSubscription.id,
      updatedAt: emailSubscription.updatedAt,
    })
    .from(emailSubscription)
    .innerJoin(emailContact, eq(emailContact.id, emailSubscription.contactId))
    .innerJoin(emailList, eq(emailList.key, emailSubscription.listKey))
    .$dynamic();

  if (whereClause) {
    subscribersQuery = subscribersQuery.where(whereClause);
  }

  return subscribersQuery.orderBy(
    desc(emailSubscription.createdAt),
    asc(emailSubscription.id),
  );
}

export async function listActiveEmailLists() {
  return db
    .select({
      key: emailList.key,
      name: emailList.name,
    })
    .from(emailList)
    .where(eq(emailList.status, "active"))
    .orderBy(asc(emailList.key));
}

export async function findEmailContactByEmail(email: string) {
  const [contact] = await db
    .select({
      email: emailContact.email,
      id: emailContact.id,
    })
    .from(emailContact)
    .where(eq(emailContact.email, email))
    .limit(1);

  return contact ?? null;
}

export async function createEmailListVerification({
  expiresAt,
  identifier,
  payload,
  token,
}: {
  expiresAt: Date;
  identifier: string;
  payload: object;
  token: string;
}) {
  await db.insert(verification).values({
    id: randomUUID(),
    identifier,
    value: JSON.stringify(payload),
    expiresAt,
  });

  return { expiresAt, token };
}

export async function deleteEmailListVerification(identifier: string) {
  await db.delete(verification).where(eq(verification.identifier, identifier));
}

export async function deleteExpiredEmailListVerifications(prefix: string) {
  await db
    .delete(verification)
    .where(
      and(
        ilike(verification.identifier, `${prefix}:%`),
        sql`${verification.expiresAt} <= now()`,
      ),
    );
}

export async function confirmEmailListVerificationTransaction<
  TPayload extends { listKey: string; subscriptionId: string },
>({
  confirmPayload,
  identifier,
}: {
  confirmPayload: (value: string | null) => TPayload | null;
  identifier: string;
}) {
  return db.transaction(async (tx) => {
    const [record] = await tx
      .delete(verification)
      .where(
        and(
          eq(verification.identifier, identifier),
          gt(verification.expiresAt, new Date()),
        ),
      )
      .returning({
        value: verification.value,
      });
    const payload = confirmPayload(record?.value ?? null);

    if (!record || !payload) {
      return { status: "invalid" as const };
    }

    const [updated] = await tx
      .update(emailSubscription)
      .set({
        status: "subscribed",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(emailSubscription.id, payload.subscriptionId),
          eq(emailSubscription.listKey, payload.listKey),
          eq(emailSubscription.status, "pending"),
        ),
      )
      .returning({ id: emailSubscription.id });

    if (!updated) {
      return { status: "invalid" as const };
    }

    return {
      payload,
      status: "success" as const,
    };
  });
}
