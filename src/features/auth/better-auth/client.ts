import { stripeClient } from "@better-auth/stripe/client";
import { betterAuthReferralClient } from "@marinedotsh/better-auth-referral";
import { adminClient, twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import { authAccessControl, authRolePermissions } from "@/features/auth/roles";

export const authClient = createAuthClient({
  plugins: [
    adminClient({
      ac: authAccessControl,
      roles: authRolePermissions,
    }),
    twoFactorClient(),
    stripeClient({
      subscription: true,
    }),
    betterAuthReferralClient(),
  ],
});
