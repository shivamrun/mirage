import { Elysia } from "elysia";
import { checkJobsRedisHealth } from "@/adapters/jobs/connection";
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
import { invitationRoutes } from "@/server/routes/invitations";
import { uploadsRoutes } from "@/server/routes/uploads";

export const app = new Elysia({ prefix: "/api" })
  .use(apiErrors)
  .get("/", () => "Hello Elysia")
  .get("/health", async ({ status }) => {
    const [jobsRedis, redis] = await Promise.all([
      checkJobsRedisHealth(),
      checkRedisHealth(),
    ]);

    try {
      await checkDatabaseHealth();

      if (jobsRedis !== "ok") {
        return status(503, {
          checks: {
            database: "ok",
            jobsRedis,
            redis,
          },
          ok: false,
        });
      }

      return {
        checks: {
          database: "ok",
          jobsRedis,
          redis,
        },
        ok: true,
      };
    } catch {
      return status(503, {
        checks: {
          database: "error",
          jobsRedis,
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
  .use(invitationRoutes)
  .use(uploadsRoutes)
  .use(adminRoutes);

export type App = typeof app;
