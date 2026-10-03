import { Elysia } from "elysia";

import { getMetricsSnapshot } from "@/adapters/operations/metrics";

export const adminMetricsRoutes = new Elysia().get("/metrics", () =>
  getMetricsSnapshot(),
);
