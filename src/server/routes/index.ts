import { node } from "@elysia/node";
import { Elysia } from "elysia";

import { accountRoutes } from "./account";
import { adminRoutes } from "./admin";
import { creatorRoutes } from "./creator";
import { moderatorRoutes } from "./moderator";

export const app = new Elysia({ adapter: node(), prefix: "/api" })
  .get("/", () => "Hello Elysia")
  .get("/health", () => ({ ok: true }))
  .use(accountRoutes)
  .use(adminRoutes)
  .use(moderatorRoutes)
  .use(creatorRoutes);

export type App = typeof app;
