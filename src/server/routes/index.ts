import { node } from "@elysia/node";
import { Elysia } from "elysia";

import { accountRoutes } from "./account";

export const app = new Elysia({ adapter: node(), prefix: "/api" })
  .get("/", () => "Hello Elysia")
  .get("/health", () => ({ ok: true }))
  .use(accountRoutes);

export type App = typeof app;
