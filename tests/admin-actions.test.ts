import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

import {
  bulkUpdateContactSubmissionStatusAction,
  updateContactSubmissionStatusAction,
} from "@/app/admin/contact-submission/all/actions";
import db from "@/server/db";
import { contactSubmission } from "@/server/db/schema";
import { requireAdmin } from "@/server/db/services/auth/access";
import { createTestActor } from "./infra/admin-actor";

let requestHeaders = new Headers();

vi.mock("next/headers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/headers")>()),
  headers: async () => requestHeaders,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

describe("admin contact-submission actions", () => {
  it.each([
    "visitor",
    "user",
    "unverified admin",
    "verified admin without 2FA",
    "verified admin",
  ] as const)("enforces access for %s", async (actor) => {
    const current =
      actor === "visitor"
        ? null
        : await createTestActor({
            role: actor === "user" ? "user" : "admin",
            emailVerified: actor !== "user" && actor !== "unverified admin",
            twoFactorEnabled: actor !== "verified admin without 2FA",
          });
    requestHeaders = new Headers(current ? { cookie: current.cookie } : {});

    const [single, bulk] = await db
      .insert(contactSubmission)
      .values([
        { name: "Single", email: "single@example.com", message: "Single" },
        { name: "Bulk", email: "bulk@example.com", message: "Bulk" },
      ])
      .returning();

    const singleForm = new FormData();
    singleForm.set("id", single.id);
    singleForm.set("status", "read");
    const bulkForm = new FormData();
    bulkForm.set("status", "archived");
    bulkForm.set("fromStatus", "new");

    if (actor === "unverified admin") {
      await expect(
        requireAdmin({ headers: requestHeaders }),
      ).resolves.toMatchObject({
        id: current?.id,
      });
    }

    if (actor === "verified admin") {
      await updateContactSubmissionStatusAction(singleForm);
      await bulkUpdateContactSubmissionStatusAction(bulkForm);
    } else {
      await expect(
        updateContactSubmissionStatusAction(singleForm),
      ).rejects.toThrow();
      await expect(
        bulkUpdateContactSubmissionStatusAction(bulkForm),
      ).rejects.toThrow();
    }

    const [updatedSingle] = await db
      .select()
      .from(contactSubmission)
      .where(eq(contactSubmission.id, single.id));
    const [updatedBulk] = await db
      .select()
      .from(contactSubmission)
      .where(eq(contactSubmission.id, bulk.id));
    expect(updatedSingle?.status).toBe(
      actor === "verified admin" ? "read" : "new",
    );
    expect(updatedBulk?.status).toBe(
      actor === "verified admin" ? "archived" : "new",
    );
  });
});
