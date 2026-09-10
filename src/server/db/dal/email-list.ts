import { randomBytes, randomUUID } from "node:crypto";

import {
  and,
  asc,
  desc,
  eq,
  gt,
  ilike,
  lte,
  or,
  type SQL,
  sql,
} from "drizzle-orm";

import db from "@/server/db";
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
} from "@/zod";

type UpdateEmailListStatusOptions = {
  key: string;
  status: EmailListStatus;
};

type EmailListVerificationPayload = {
  email: string;
  listKey: string;
  subscriptionId: string;
  token: string;
};

const EMAIL_LIST_VERIFICATION_PREFIX = "email-list";
const EMAIL_LIST_VERIFICATION_EXPIRES_IN_MS = 1000 * 60 * 60 * 24;
const EMAIL_LIST_VERIFICATION_TOKEN_PATTERN = /^[a-f0-9]{64}$/;

const defaultEmailListKeys = ["waitlist", "newsletter"] as const;
const defaultEmailLists = [
  {
    description: "Early access requests and launch updates.",
    emailVerificationRequired: true,
    key: "waitlist",
    name: "Waitlist",
    status: "active",
  },
  {
    description: "Product news and occasional announcements.",
    emailVerificationRequired: true,
    key: "newsletter",
    name: "Newsletter",
    status: "active",
  },
] satisfies {
  description: string;
  emailVerificationRequired: boolean;
  key: (typeof defaultEmailListKeys)[number];
  name: string;
  status: EmailListStatus;
}[];

function createEmailListVerificationToken() {
  return randomBytes(32).toString("hex");
}

function getEmailListVerificationIdentifier(token: string) {
  return `${EMAIL_LIST_VERIFICATION_PREFIX}:${token}`;
}

function parseEmailListVerificationPayload(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<EmailListVerificationPayload>;

    if (
      typeof parsed.email !== "string" ||
      typeof parsed.listKey !== "string" ||
      typeof parsed.subscriptionId !== "string" ||
      typeof parsed.token !== "string"
    ) {
      return null;
    }

    return parsed as EmailListVerificationPayload;
  } catch {
    return null;
  }
}

export async function ensureDefaultEmailLists() {
  await db
    .insert(emailList)
    .values(defaultEmailLists)
    .onConflictDoUpdate({
      target: emailList.key,
      set: {
        emailVerificationRequired: true,
        status: "active",
        updatedAt: new Date(),
      },
    });
}

function isDefaultEmailListKey(key: string) {
  return defaultEmailListKeys.includes(
    key as (typeof defaultEmailListKeys)[number],
  );
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
  await ensureDefaultEmailLists();

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

    if (!list) {
      throw new Error("Unknown email list.");
    }

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

    const [existingSubscription] = await tx
      .select({
        id: emailSubscription.id,
        status: emailSubscription.status,
      })
      .from(emailSubscription)
      .where(
        and(
          eq(emailSubscription.contactId, contact.id),
          eq(emailSubscription.listKey, values.listKey),
        ),
      )
      .limit(1);

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
      subscriptionExisted: Boolean(existingSubscription),
      subscription,
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

export async function deleteEmailList(key: string) {
  if (isDefaultEmailListKey(key)) {
    return { status: "protected" as const };
  }

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
          ilike(verification.identifier, `${EMAIL_LIST_VERIFICATION_PREFIX}:%`),
          sql`(${verification.value}::jsonb ->> 'listKey') = ${key}`,
        ),
      );
  });

  return { status: "deleted" as const };
}

export async function listEmailLists() {
  await ensureDefaultEmailLists();

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
  await ensureDefaultEmailLists();

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
  await ensureDefaultEmailLists();

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
  email,
  listKey,
  subscriptionId,
}: {
  email: string;
  listKey: string;
  subscriptionId: string;
}) {
  const token = createEmailListVerificationToken();
  const expiresAt = new Date(
    Date.now() + EMAIL_LIST_VERIFICATION_EXPIRES_IN_MS,
  );
  const payload: EmailListVerificationPayload = {
    email,
    listKey,
    subscriptionId,
    token,
  };

  await db.insert(verification).values({
    id: randomUUID(),
    identifier: getEmailListVerificationIdentifier(token),
    value: JSON.stringify(payload),
    expiresAt,
  });

  return {
    expiresAt,
    token,
  };
}

export async function deleteEmailListVerification(token: string) {
  await db
    .delete(verification)
    .where(
      eq(verification.identifier, getEmailListVerificationIdentifier(token)),
    );
}

export async function deletePendingEmailSubscription(subscriptionId: string) {
  await db
    .delete(emailSubscription)
    .where(
      and(
        eq(emailSubscription.id, subscriptionId),
        eq(emailSubscription.status, "pending"),
      ),
    );
}

export async function confirmEmailListVerification(token: string) {
  if (!EMAIL_LIST_VERIFICATION_TOKEN_PATTERN.test(token)) {
    return { status: "invalid" as const };
  }

  await db
    .delete(verification)
    .where(
      and(
        ilike(verification.identifier, `${EMAIL_LIST_VERIFICATION_PREFIX}:%`),
        lte(verification.expiresAt, new Date()),
      ),
    );

  const identifier = getEmailListVerificationIdentifier(token);
  const [record] = await db
    .select()
    .from(verification)
    .where(
      and(
        eq(verification.identifier, identifier),
        gt(verification.expiresAt, new Date()),
      ),
    )
    .limit(1);

  const payload = parseEmailListVerificationPayload(record?.value ?? null);

  if (!record || !payload || payload.token !== token) {
    return { status: "invalid" as const };
  }

  await db.transaction(async (tx) => {
    await tx
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
      );

    await tx.delete(verification).where(eq(verification.id, record.id));
  });

  return {
    email: payload.email,
    listKey: payload.listKey,
    status: "success" as const,
  };
}
