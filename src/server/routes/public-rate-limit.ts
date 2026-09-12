import { createHmac } from "node:crypto";

import { env } from "@/lib/env";

export function getPublicRateLimitKey(email: string) {
  return createHmac("sha256", env.BETTER_AUTH_SECRET)
    .update(email.trim().toLowerCase())
    .digest("hex");
}
