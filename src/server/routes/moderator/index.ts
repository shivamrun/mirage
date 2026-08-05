import { Elysia } from "elysia";

import { elysiaAuth } from "../auth";

export const moderatorRoutes = new Elysia({ prefix: "/moderator" })
  .use(elysiaAuth)
  .get(
    "/",
    ({ authUser }) => ({
      area: "moderator",
      user: {
        id: authUser.id,
        email: authUser.email,
        roles: authUser.roles,
      },
    }),
    {
      moderator: true,
    },
  );
