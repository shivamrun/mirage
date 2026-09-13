import { node } from "@elysia/node";
import { Elysia } from "elysia";

import { authActionRoutes } from "@/server/auth-actions/routes";
import { apiErrors } from "@/server/http/errors";
import { accountRoutes } from "./account";
import { adminRoutes } from "./admin";
import { contactRoutes } from "./contact";
import { emailListRoutes } from "./email-list";
import { uploadsRoutes } from "./uploads";

export const app = new Elysia({ adapter: node(), prefix: "/api" })
  .use(apiErrors)
  .get("/", () => "Hello Elysia")
  .get("/health", () => ({ ok: true }))
  .use(accountRoutes)
  .use(authActionRoutes)
  .use(contactRoutes)
  .use(emailListRoutes)
  .use(uploadsRoutes)
  .use(adminRoutes);

export type App = typeof app;
