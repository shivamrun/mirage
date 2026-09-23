import { Elysia } from "elysia";

import { elysiaAuth } from "@/server/http/auth";
import { adminBillingPlanRoutes } from "./billing-plan";
import { adminEmailListRoutes } from "./email-list";
import { adminUserSecurityRoutes } from "./user-security";

export const adminRoutes = new Elysia({ prefix: "/admin" })
  .use(elysiaAuth)
  .guard(
    {
      adminAccess: true,
    },
    (app) =>
      app
        .get("/", ({ authUser }) => ({
          area: "admin",
          user: {
            id: authUser.id,
            email: authUser.email,
            roles: authUser.roles,
          },
        }))
        .use(adminBillingPlanRoutes)
        .use(adminUserSecurityRoutes)
        .use(adminEmailListRoutes),
  );
