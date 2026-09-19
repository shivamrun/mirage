import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  contactSubmissionsPageHref,
  parseAdminContactSubmissionSearchParams,
} from "@/features/admin/query/contact-submission-query";
import {
  emailListPageHref,
  parseAdminEmailListSearchParams,
} from "@/features/admin/query/email-list-query";
import {
  parseAdminUsersSearchParams,
  usersPageHref,
} from "@/features/admin/query/users-query";
import db from "@/server/db";
import { paginateList, totalCount } from "@/server/db/helpers/paginate";
import {
  contactSubmission,
  emailContact,
  emailList,
  emailSubscription,
  user,
} from "@/server/db/schema";
import { listAdminContactSubmissionsView } from "@/server/db/services/admin/contact-submission";
import { listAdminEmailSubscribersView } from "@/server/db/services/admin/email-list";
import { listAdminUsersView } from "@/server/db/services/admin/users";
import {
  createPaginationMeta,
  getPaginationWindow,
  parseLimitParam,
  parsePageParam,
} from "@/shared/pagination";

describe("pagination utilities", () => {
  it("normalizes page and limit values", () => {
    expect(parsePageParam(undefined)).toBe(1);
    expect(parsePageParam("0")).toBe(1);
    expect(parsePageParam("3")).toBe(3);
    expect(parseLimitParam("500")).toBe(100);
  });

  it("creates clamped pagination metadata and compact page windows", () => {
    expect(createPaginationMeta({ limit: 10, page: 99, total: 23 })).toEqual({
      firstItem: 21,
      hasNextPage: false,
      hasPreviousPage: true,
      lastItem: 23,
      limit: 10,
      offset: 20,
      page: 3,
      total: 23,
      totalPages: 3,
    });
    expect(getPaginationWindow({ page: 5, totalPages: 10 })).toEqual([
      1,
      "ellipsis",
      4,
      5,
      6,
      "ellipsis",
      10,
    ]);
  });

  it("attaches limit and offset to a Drizzle query and extracts totals", async () => {
    await db.insert(contactSubmission).values(
      Array.from({ length: 12 }, (_, index) => ({
        email: `attach-${index}@example.com`,
        message: "Attach-on pagination",
        name: `Attach ${index}`,
      })),
    );

    const result = await paginateList({
      countQuery: db.select({ total: totalCount }).from(contactSubmission),
      limit: 5,
      offset: 5,
      query: db
        .select({
          id: contactSubmission.id,
        })
        .from(contactSubmission)
        .orderBy(contactSubmission.createdAt),
    });

    expect(result.total).toBe(12);
    expect(result.items).toHaveLength(5);
    expect(result.items[0]).not.toHaveProperty("_total");
  });
});

describe("paginated admin lists", () => {
  it("paginates and canonicalizes filtered users", async () => {
    await db.insert(user).values([
      ...Array.from({ length: 11 }, (_, index) => ({
        id: randomUUID(),
        name: `Matched User ${index}`,
        email: `matched-${index}@example.com`,
        emailVerified: false,
      })),
      {
        id: randomUUID(),
        name: "Other User",
        email: "other@example.com",
        emailVerified: false,
      },
    ]);

    const { page, ...state } = parseAdminUsersSearchParams({
      page: "2",
      q: "matched",
    });
    const result = await listAdminUsersView({ page, state });

    expect(result.total).toBe(11);
    expect(result.totalPages).toBe(2);
    expect(result.users).toHaveLength(1);
    expect(usersPageHref({ page: 2, ...state })).toBe(
      "/admin/users?page=2&q=matched",
    );

    const emptyPage = await listAdminUsersView({ page: 99, state });
    expect(emptyPage.page).toBe(2);
    expect(emptyPage.users).toHaveLength(0);
  });

  it("paginates contact submissions while preserving query state in URLs", async () => {
    await db.insert(contactSubmission).values([
      ...Array.from({ length: 13 }, (_, index) => ({
        company: "Acme",
        email: `contact-${index}@example.com`,
        message: "Need pagination help",
        name: `Acme Contact ${index}`,
      })),
      {
        company: "Other",
        email: "other-contact@example.com",
        message: "Different message",
        name: "Other Contact",
      },
    ]);

    const { page, ...state } = parseAdminContactSubmissionSearchParams({
      page: "2",
      q: "Acme",
    });
    const result = await listAdminContactSubmissionsView({ page, state });

    expect(result.total).toBe(13);
    expect(result.totalPages).toBe(2);
    expect(result.submissions).toHaveLength(3);
    expect(contactSubmissionsPageHref({ page: 2, ...state })).toBe(
      "/admin/contact-submission/all?page=2&q=Acme",
    );
  });

  it("paginates email submissions with list and status filters", async () => {
    await db.insert(emailList).values({
      key: "waitlist",
      name: "Waitlist",
    });
    const contacts = await db
      .insert(emailContact)
      .values(
        Array.from({ length: 13 }, (_, index) => ({
          email: `subscriber-${index}@example.com`,
        })),
      )
      .returning({ id: emailContact.id });
    await db.insert(emailSubscription).values(
      contacts.map((contact, index) => ({
        contactId: contact.id,
        listKey: "waitlist",
        source: "launch",
        status: index === 12 ? ("pending" as const) : ("subscribed" as const),
      })),
    );

    const { page, ...state } = parseAdminEmailListSearchParams({
      listKey: "waitlist",
      page: "2",
      q: "launch",
      status: "subscribed",
    });
    const result = await listAdminEmailSubscribersView({ page, state });

    expect(result.total).toBe(12);
    expect(result.totalPages).toBe(2);
    expect(result.subscribers).toHaveLength(2);
    expect(emailListPageHref({ page: 2, ...state })).toBe(
      "/admin/email-list/submissions?page=2&listKey=waitlist&status=subscribed&q=launch",
    );
  });
});
