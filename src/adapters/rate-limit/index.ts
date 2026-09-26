import {
  buildAccountEmailSendBuckets,
  buildPublicWriteBuckets,
  getPublicClientIdentifier,
} from "@/adapters/rate-limit/policies";
import { rateLimitStore } from "@/adapters/rate-limit/store";
import type { RateLimitResult } from "@/adapters/rate-limit/types";

export { getPublicClientIdentifier };
export type { RateLimitPolicyName } from "@/adapters/rate-limit/types";

export async function consumePublicWriteLimit({
  clientIdentifier,
  destination,
  flow,
}: Parameters<typeof buildPublicWriteBuckets>[0]): Promise<RateLimitResult> {
  await rateLimitStore.pruneExpired();

  return rateLimitStore.consumePolicy(
    buildPublicWriteBuckets({
      clientIdentifier,
      destination,
      flow,
    }),
  );
}

export async function consumeAccountEmailSendLimit({
  accountId,
  destination,
  flow,
  variant,
}: Parameters<
  typeof buildAccountEmailSendBuckets
>[0]): Promise<RateLimitResult> {
  await rateLimitStore.pruneExpired();

  return rateLimitStore.consumePolicy(
    buildAccountEmailSendBuckets({
      accountId,
      destination,
      flow,
      variant,
    }),
  );
}
