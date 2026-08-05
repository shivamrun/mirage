import { adminClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import { authAccessControl, authRolePermissions } from "@/lib/auth/roles";

export const authClient = createAuthClient({
  plugins: [
    adminClient({
      ac: authAccessControl,
      roles: authRolePermissions,
    }),
  ],
});
