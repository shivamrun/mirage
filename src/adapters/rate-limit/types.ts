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

export type RateLimitPolicyName =
  | "account-deletion"
  | "account-data-export"
  | "account-email-mutation"
  | "account-two-factor-mutation"
  | "admin-invitation-mutation"
  | "admin-schedules-mutation"
  | "admin-security-mutation"
  | "billing-checkout"
  | "contact-submit"
  | "credits-sample-create"
  | "email-list-signup"
  | "invitation-accept"
  | "invitation-validate"
  | "uploads-prepare";

export type UploadPrepareRateLimitPolicyName = "avatar";
