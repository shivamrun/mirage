import { cacheStore } from "@/adapters/cache";

export function creditBalanceGenerationParts(userId: string) {
  return ["credit-balance", userId];
}

export async function invalidateCreditBalanceCache(userId: string) {
  await cacheStore.incrementGeneration({
    parts: creditBalanceGenerationParts(userId),
    policy: "apiCreditBalance",
  });
}
