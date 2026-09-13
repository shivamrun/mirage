import { node } from "@elysia/node";
import { Elysia } from "elysia";

import { accountRoutes } from "./account";
import { adminRoutes } from "./admin";
import { authActionRoutes } from "./auth-actions";
import { contactRoutes } from "./contact";
import { emailListRoutes } from "./email-list";
import { apiErrors } from "./errors";
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
