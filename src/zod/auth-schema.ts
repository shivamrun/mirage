import { z } from "zod";

import {
  auditTimestamps,
  emailColumn,
  eventTimestamp,
  requiredTimestamp,
} from "./helpers/base-column";

const authId = z.string().min(1);
const nullableText = z.string().nullable();

// Better Auth expects these default table names unless table mapping is
// configured explicitly, so auth schemas intentionally mirror those names.
export const user = z.object({
  id: authId,

  name: z.string().min(1),
  ...emailColumn(),

  emailVerified: z.boolean().default(false),

  image: nullableText,

  ...auditTimestamps(),
});

export const session = z.object({
  id: authId,

  expiresAt: requiredTimestamp("expires_at"),

  token: z.string().min(1),

  ...auditTimestamps(),

  ipAddress: nullableText,
  userAgent: nullableText,

  userId: authId,
});

export const account = z.object({
  id: authId,

  accountId: z.string().min(1),
  providerId: z.string().min(1),

  userId: authId,

  accessToken: nullableText,
  refreshToken: nullableText,
  idToken: nullableText,

  accessTokenExpiresAt: eventTimestamp("access_token_expires_at"),

  refreshTokenExpiresAt: eventTimestamp("refresh_token_expires_at"),

  scope: nullableText,
  password: nullableText,

  ...auditTimestamps(),
});

export const verification = z.object({
  id: authId,

  identifier: z.string().min(1),
  value: z.string().min(1),

  expiresAt: requiredTimestamp("expires_at"),

  ...auditTimestamps(),
});

// RELATIONS

export const userWithRelations = user.extend({
  sessions: z.array(session),
  accounts: z.array(account),
});

export const sessionWithRelations = session.extend({
  user,
});

export const accountWithRelations = account.extend({
  user,
});

export type User = z.infer<typeof user>;
export type Session = z.infer<typeof session>;
export type Account = z.infer<typeof account>;
export type Verification = z.infer<typeof verification>;
