import { Elysia } from "elysia";

import { handleBetterAuthRequest } from "@/server/http/better-auth-handler";

export const authRoutes = new Elysia({
  name: "better-auth-routes",
  prefix: "/auth",
}).mount(handleBetterAuthRequest);
