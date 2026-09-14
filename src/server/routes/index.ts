import { Elysia } from "elysia";

import { authActionRoutes } from "@/server/auth-actions/routes";
import { checkDatabaseHealth } from "@/server/db/dal/health";
import { apiErrors } from "@/server/http/errors";
import { accountRoutes } from "./account";
import { adminRoutes } from "./admin";
import { contactRoutes } from "./contact";
import { emailListRoutes } from "./email-list";
import { uploadsRoutes } from "./uploads";

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
  .use(authActionRoutes)
  .use(contactRoutes)
  .use(emailListRoutes)
  .use(uploadsRoutes)
  .use(adminRoutes);

export type App = typeof app;
