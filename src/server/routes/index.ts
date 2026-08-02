import { node } from "@elysia/node";
import { Elysia } from "elysia";

export const app = new Elysia({ adapter: node(), prefix: "/api" })
  .get("/", () => "Hello Elysia")
  .get("/health", () => ({ ok: true }));

export type App = typeof app;
