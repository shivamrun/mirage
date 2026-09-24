import { beforeEach, vi } from "vitest";

import {
  sendTestEmail,
  setTestEmailDeliveryHook,
  testEmailOutbox,
} from "./email-fake";
import { getSafeTestDatabaseUrl, openTestDatabase } from "./test-database";

const { url } = getSafeTestDatabaseUrl();
process.env.DATABASE_URL = url;
process.env.RESEND_API_KEY = "";
process.env.EMAIL_FROM = "";
delete process.env.TRUSTED_CLIENT_IP_HEADER;
process.env.BETTER_AUTH_SECRET ??= "test-only-secret-at-least-32-characters";
process.env.BETTER_AUTH_URL ??= "http://localhost:3000";
process.env.NEXT_PUBLIC_BASE_URL ??= "http://localhost:3000";
process.env.STRIPE_SECRET_KEY ??= "sk_test_test-only";
process.env.STRIPE_WEBHOOK_SECRET ??= "whsec_test-only";

vi.mock("@/adapters/email/send-email", () => ({ sendEmail: sendTestEmail }));

beforeEach(async () => {
  testEmailOutbox.length = 0;
  setTestEmailDeliveryHook(null);
  const client = await openTestDatabase();
  try {
    const tables = await client<{ tablename: string }[]>`
      select tablename from pg_tables where schemaname = 'public'
    `;
    if (tables.length > 0) {
      const names = tables.map(
        ({ tablename }) => `"public"."${tablename.replaceAll('"', '""')}"`,
      );
      await client.unsafe(
        `truncate table ${names.join(", ")} restart identity cascade`,
      );
    }
  } finally {
    await client.end();
  }
});
