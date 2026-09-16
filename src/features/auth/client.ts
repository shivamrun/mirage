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
  ],
});
