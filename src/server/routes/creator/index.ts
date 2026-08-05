import { Elysia } from "elysia";

import { elysiaAuth } from "../auth";

export const creatorRoutes = new Elysia({ prefix: "/creator" })
  .use(elysiaAuth)
  .get(
    "/",
    ({ authUser }) => ({
      area: "creator",
      user: {
        id: authUser.id,
        email: authUser.email,
        roles: authUser.roles,
      },
    }),
    {
      creator: true,
    },
  );
