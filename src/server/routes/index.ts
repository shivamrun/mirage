import { Elysia } from "elysia";
import { accessVerificationRoutes } from "@/features/auth/access-verification-routes";
import { checkDatabaseHealth } from "@/server/db/dal/health";
import { apiErrors } from "@/server/http/errors";
import { accountRoutes } from "@/server/routes/account";
import { adminRoutes } from "@/server/routes/admin";
import { contactRoutes } from "@/server/routes/contact";
import { emailListRoutes } from "@/server/routes/email-list";
import { uploadsRoutes } from "@/server/routes/uploads";

export const app = new Elysia({ prefix: "/api" })
  .use(apiErrors)
  .get("/", () => "Hello Elysia")
  .get("/health", async ({ status }) => {
    try {
      await checkDatabaseHealth();

      return {
        checks: {
          database: "ok",
        },
        ok: true,
      };
    } catch {
      return status(503, {
        checks: {
          database: "error",
        },
        ok: false,
      });
    }
  })
  .use(accountRoutes)
  .use(accessVerificationRoutes)
  .use(contactRoutes)
  .use(emailListRoutes)
  .use(uploadsRoutes)
  .use(adminRoutes);

export type App = typeof app;
