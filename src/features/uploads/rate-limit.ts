import {
  buildUploadPrepareRateLimitBuckets,
  getUploadPrepareRateLimitMessage,
} from "@/adapters/rate-limit/policies";
import { rateLimitStore } from "@/adapters/rate-limit/store";

import type { UploadAssetKey } from "./asset-keys";

export type UploadPrepareRateLimitResult =
  | { allowed: true }
  | { allowed: false; message: string; retryAfterSeconds: number };

function uploadPreparePolicyForKey(key: UploadAssetKey) {
  return key;
}

export async function consumeUploadPrepareLimit({
  headers,
  key,
  userId,
}: {
  headers: Headers;
  key: UploadAssetKey;
  userId: string;
}): Promise<UploadPrepareRateLimitResult> {
  const policy = uploadPreparePolicyForKey(key);
  const result = await rateLimitStore.consumePolicy(
    buildUploadPrepareRateLimitBuckets({
      headers,
      policy,
      userId,
    }),
  );

  if (result.allowed) {
    return result;
  }

  return {
    ...result,
    message: getUploadPrepareRateLimitMessage(policy),
  };
}
