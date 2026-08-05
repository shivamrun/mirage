import { Elysia } from "elysia";

import { elysiaAuth } from "../auth";

export const adminRoutes = new Elysia({ prefix: "/admin" }).use(elysiaAuth).get(
  "/",
  ({ authUser }) => ({
    area: "admin",
    user: {
      id: authUser.id,
      email: authUser.email,
      roles: authUser.roles,
    },
  }),
  {
    admin: true,
  },
);
