import { databaseRateLimitStore } from "@/adapters/rate-limit/stores/database";
import type { RateLimitStore } from "@/adapters/rate-limit/types";

// Keep the active store behind one module so Redis/Valkey can replace the
// database store without changing callers or policy code.
export const rateLimitStore: RateLimitStore = databaseRateLimitStore;
