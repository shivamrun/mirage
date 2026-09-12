import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { sendVerificationEmail } from "@/server/email/senders/send-verification-email";
import { testEmailOutbox } from "./email-fake";
import { getSafeTestDatabaseUrl, openTestDatabase } from "./test-database";

describe("test harness", () => {
  it("refuses a remote or non-test database target", () => {
    const previousUrl = process.env.TEST_DATABASE_URL;
    try {
      process.env.TEST_DATABASE_URL =
        "postgres://postgres:postgres@db.example.com:5432/mirage_test";
      expect(getSafeTestDatabaseUrl).toThrow("Refusing test database access");
      process.env.TEST_DATABASE_URL =
        "postgres://postgres:postgres@127.0.0.1:5433/mirage";
      expect(getSafeTestDatabaseUrl).toThrow("Refusing test database access");
    } finally {
      if (previousUrl === undefined) {
        delete process.env.TEST_DATABASE_URL;
      } else {
        process.env.TEST_DATABASE_URL = previousUrl;
      }
    }
  });

  it("refuses a test target that matches DATABASE_URL in .env.local", () => {
    const directory = mkdtempSync(join(tmpdir(), "mirage-test-db-"));
    const previousUrl = process.env.TEST_DATABASE_URL;
    const target = "postgres://postgres:postgres@127.0.0.1:5433/local_app_test";

    try {
      writeFileSync(join(directory, ".env.local"), `DATABASE_URL=${target}\n`);
      process.env.TEST_DATABASE_URL = target;

      expect(() => getSafeTestDatabaseUrl(directory)).toThrow(
        "Refusing test database access",
      );
    } finally {
      if (previousUrl === undefined) {
        delete process.env.TEST_DATABASE_URL;
      } else {
        process.env.TEST_DATABASE_URL = previousUrl;
      }
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("uses migrated tables and captures email without delivery", async () => {
    const client = await openTestDatabase();
    try {
      const tables = await client<{ name: string | null }[]>`
        select to_regclass('public.mirage_contact_submission')::text as name
      `;
      expect(tables[0]?.name).toBe("mirage_contact_submission");
      await client`
        insert into public.mirage_contact_submission (name, email, message)
        values ('Test', 'test@example.com', 'Test message')
      `;
    } finally {
      await client.end();
    }

    await sendVerificationEmail({
      email: "test@example.com",
      verificationUrl: "http://localhost:3000/verify",
    });
    expect(testEmailOutbox).toHaveLength(1);
    expect(testEmailOutbox[0]?.to).toBe("test@example.com");
  });

  it("starts the next test with empty database rows and email outbox", async () => {
    const client = await openTestDatabase();
    try {
      const rows = await client<{ count: number }[]>`
        select count(*)::integer as count from public.mirage_contact_submission
      `;
      expect(rows[0]?.count).toBe(0);
    } finally {
      await client.end();
    }
    expect(testEmailOutbox).toHaveLength(0);
  });
});
