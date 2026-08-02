import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { env } from "@/lib/env";
import db from "@/server/db";

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.NEXT_PUBLIC_BASE_URL],
  emailAndPassword: { enabled: true },
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
});
