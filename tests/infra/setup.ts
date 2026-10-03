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
process.env.JOBS_REDIS_URL ??= "redis://127.0.0.1:6380";
delete process.env.TRUSTED_CLIENT_IP_HEADER;
process.env.BETTER_AUTH_SECRET ??= "test-only-secret-at-least-32-characters";
process.env.BETTER_AUTH_URL ??= "http://localhost:3000";
process.env.NEXT_PUBLIC_BASE_URL ??= "http://localhost:3000";
process.env.GOOGLE_CLIENT_ID ??= "test-google-client-id";
process.env.GOOGLE_CLIENT_SECRET ??= "test-google-client-secret";
process.env.STRIPE_SECRET_KEY ??= "sk_test_test-only";
process.env.STRIPE_WEBHOOK_SECRET ??= "whsec_test-only";
process.env.TURNSTILE_SECRET_KEY ??= "test-turnstile-secret";
process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ??= "test-turnstile-site-key";

vi.mock("@/adapters/email/send-email", () => ({ sendEmail: sendTestEmail }));

beforeEach(async () => {
  const [
    { setBillingStripeClientForTests },
    { setJobEnqueueHandlerForTests },
    { processJob },
  ] = await Promise.all([
    import("@/server/db/services/billing/stripe-client"),
    import("@/server/jobs/enqueue"),
    import("@/server/jobs/processor"),
  ]);
  setBillingStripeClientForTests({
    customers: {
      create: async () => ({ id: `cus_test_${crypto.randomUUID()}` }),
      search: async () => ({ data: [] }),
    },
  } as never);
  setJobEnqueueHandlerForTests(async (name, payload, options) => {
    await processJob(name, payload);
    return { id: options.jobId };
  });
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
