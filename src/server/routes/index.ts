import { Elysia } from "elysia";
import { checkRedisHealth } from "@/adapters/redis/client";
import { accessVerificationRoutes } from "@/features/auth/access-verification-routes";
import { checkDatabaseHealth } from "@/server/db/dal/health";
import { apiErrors } from "@/server/http/errors";
import { accountRoutes } from "@/server/routes/account";
import { adminRoutes } from "@/server/routes/admin";
import { billingRoutes } from "@/server/routes/billing";
import { contactRoutes } from "@/server/routes/contact";
import { creditsRoutes } from "@/server/routes/credits";
import { emailListRoutes } from "@/server/routes/email-list";
import { uploadsRoutes } from "@/server/routes/uploads";

export const app = new Elysia({ prefix: "/api" })
  .use(apiErrors)
  .get("/", () => "Hello Elysia")
  .get("/health", async ({ status }) => {
    const redis = await checkRedisHealth();

    try {
      await checkDatabaseHealth();

      return {
        checks: {
          database: "ok",
          redis,
        },
        ok: true,
      };
    } catch {
      return status(503, {
        checks: {
          database: "error",
          redis,
        },
        ok: false,
      });
    }
  })
  .use(accountRoutes)
  .use(accessVerificationRoutes)
  .use(billingRoutes)
  .use(contactRoutes)
  .use(creditsRoutes)
  .use(emailListRoutes)
  .use(uploadsRoutes)
  .use(adminRoutes);

export type App = typeof app;
