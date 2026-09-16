import { treaty } from "@elysia/eden";

import type { App } from "@/server/routes";

export const api = treaty<App>("", {
  keepDomain: true,
});
