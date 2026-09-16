export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

export type RateLimitBucket = {
  identifierHash: string;
  limit: number;
  scope: string;
  windowMs: number;
};

export type RateLimitStore = {
  consumePolicy(buckets: RateLimitBucket[]): Promise<RateLimitResult>;
  pruneExpired(limit?: number): Promise<number>;
};
