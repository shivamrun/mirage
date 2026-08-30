import { node } from "@elysia/node";
import { Elysia } from "elysia";

import { accountRoutes } from "./account";
import { adminRoutes } from "./admin";

export const app = new Elysia({ adapter: node(), prefix: "/api" })
  .get("/", () => "Hello Elysia")
  .get("/health", () => ({ ok: true }))
  .use(accountRoutes)
  .use(adminRoutes);

export type App = typeof app;
