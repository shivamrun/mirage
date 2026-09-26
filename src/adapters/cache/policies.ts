export type CachePolicy = {
  privacy: "admin" | "private" | "public";
  staleDataNotes: string;
  ttlSeconds: number;
  version: number;
};

export const cachePolicies = {
  activeEmailLists: {
    privacy: "public",
    staleDataNotes:
      "List visibility changes should invalidate this helper before relying on cache freshness.",
    ttlSeconds: 60,
    version: 1,
  },
  adminEmailListSummary: {
    privacy: "admin",
    staleDataNotes:
      "Admin summaries may lag briefly and must be invalidated after email-list mutations.",
    ttlSeconds: 30,
    version: 1,
  },
  apiCreditBalance: {
    privacy: "private",
    staleDataNotes:
      "Credit mutations increment the per-user generation so API balance reads miss stale entries.",
    ttlSeconds: 15,
    version: 1,
  },
  creditBalance: {
    privacy: "private",
    staleDataNotes:
      "Credit mutations must invalidate or bypass this policy before showing updated balances.",
    ttlSeconds: 15,
    version: 1,
  },
  userPostsPage: {
    privacy: "private",
    staleDataNotes:
      "Paginated collections should include a generation value and expire naturally after invalidation.",
    ttlSeconds: 60,
    version: 1,
  },
} as const satisfies Record<string, CachePolicy>;

export type CachePolicyName = keyof typeof cachePolicies;
