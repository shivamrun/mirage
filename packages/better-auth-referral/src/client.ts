import type { BetterAuthClientPlugin } from "better-auth/client";
import type { betterAuthReferral } from "./server";
import { betterAuthReferralPluginId } from "./types";

export const betterAuthReferralClient = () =>
  ({
    id: betterAuthReferralPluginId,
    $InferServerPlugin: {} as ReturnType<typeof betterAuthReferral>,
  }) satisfies BetterAuthClientPlugin;
