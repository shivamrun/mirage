import {
  APIError,
  type AuthContext,
  type BetterAuthPlugin,
  type GenericEndpointContext,
  generateId,
  type Session,
} from "better-auth";
import { getSessionFromCtx } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { generateRandomString } from "better-auth/crypto";
import type { admin, UserWithRole } from "better-auth/plugins";
import type { InviteAdapter } from "./adapter";
import { ERROR_CODES } from "./constants";
import type { CreateInvite } from "./routes/create-invite";
import type {
  InviteOptions,
  InviteTypeWithId,
  NewInviteOptions,
  Permissions,
  TokensType,
} from "./types";

type ConsumeInviteParams = {
  ctx: GenericEndpointContext;
  invitation: InviteTypeWithId;
  invitedUser: UserWithRole;
  session: Session;
  options: NewInviteOptions;
  adapter: InviteAdapter;
  meta: {
    userId: string;
    token: string;
    timesUsed: number;
    newAccount: boolean;
  };
};

/**
 * Handles the full invite acceptance flow.
 *
 * Validates the invite, updates the user's role,
 * refreshes the session, and manages invite usage.
 * Also runs optional hooks if provided.
 *
 * Throws if the invite is invalid, expired,
 * doesn't match the user, or can't be accepted.
 */
export const consumeInvite = async ({
  ctx,
  invitation,
  invitedUser,
  session,
  options,
  adapter,
  meta,
}: ConsumeInviteParams) => {
  const { userId, token, timesUsed, newAccount } = meta;

  const emails = normalizeInviteEmails(invitation.emails ?? invitation.email);
  const isPrivate = emails.length > 0;

  // Validate email for private invites
  if (isPrivate && !emails.includes(normalizeInviteEmail(invitedUser.email))) {
    throw APIError.from("BAD_REQUEST", ERROR_CODES.INVALID_EMAIL);
  }

  // Validate invitation status
  if (invitation.status && invitation.status !== "pending") {
    throw APIError.from("BAD_REQUEST", ERROR_CODES.INVALID_TOKEN);
  }

  // Check permissions
  const canAcceptRaw =
    typeof options.canAcceptInvite === "function"
      ? await options.canAcceptInvite({ invitedUser, newAccount })
      : options.canAcceptInvite;

  const canAccept =
    typeof canAcceptRaw === "object"
      ? await exports.checkPermissions(ctx, canAcceptRaw) // fix vitest errors with vi.spyOn (https://github.com/vitest-dev/vitest/issues/6551)
      : canAcceptRaw;

  if (!canAccept) {
    throw APIError.from("BAD_REQUEST", ERROR_CODES.CANT_ACCEPT_INVITE);
  }

  const maxUses = getMaxUses(invitation);
  const usedAt = options.getDate();
  const isLastUse = timesUsed === maxUses - 1;
  const shouldCleanup = isLastUse && options.cleanupInvitesAfterMaxUses;
  const shouldCreateInviteUse = !shouldCleanup;

  if (isLastUse) {
    const claimedInvitation = await adapter.claimInvitationUse(invitation.id);

    if (!claimedInvitation) {
      throw APIError.from(
        "BAD_REQUEST",
        ERROR_CODES.INVITE_TOKEN_HAS_ALREADY_BEEN_USED,
      );
    }
  }

  const updatedRole = mergeRoles(invitedUser.role, invitation.role);

  // Update user role
  await ctx.context.adapter.update({
    model: "user",
    where: [{ field: "id", value: userId }],
    update: { role: updatedRole },
  });

  const updatedUser = { ...invitedUser, role: updatedRole };

  // Update session with new role
  await setSessionCookie(ctx, {
    session,
    user: updatedUser,
  });

  // Handle invite lifecycle
  if (shouldCleanup) {
    await adapter.deleteInviteUses(invitation.id);
    await adapter.deleteInvitation(token);
  }

  // Track usage only if invite still active
  if (shouldCreateInviteUse) {
    await adapter.createInviteUse({
      inviteId: invitation.id,
      usedByUserId: userId,
      usedAt,
    });
  }

  // Fire optional hook
  if (options.onInvitationUsed) {
    try {
      await options.onInvitationUsed({
        invitedUser,
        newUser: updatedUser,
        newAccount,
      });
    } catch (e) {
      ctx.context.logger.error("Error in onInvitationUsed hook", e);
    }
  }
};

export function getMaxUses(invitation: InviteTypeWithId) {
  return invitation.infinityMaxUses ? Infinity : invitation.maxUses;
}

export function normalizeInviteEmail(email: string) {
  return email.trim().normalize("NFKC").toLowerCase();
}

export function normalizeInviteEmails(
  email: string | string[] | undefined = undefined,
) {
  return normalizeEmails<string[]>(email, []).map(normalizeInviteEmail);
}

export function normalizeRoleValues(
  roleValue: string | string[] | null | undefined,
) {
  const roles = Array.isArray(roleValue)
    ? roleValue
    : (roleValue ?? "").split(",");

  return roles.map((value) => value.trim()).filter(Boolean);
}

export function userHasRole(
  roleValue: string | string[] | null | undefined,
  role: string,
) {
  return normalizeRoleValues(roleValue).includes(role);
}

export function inviteMatchesUserEmail({
  invitation,
  userEmail,
}: {
  invitation: InviteTypeWithId;
  userEmail: string;
}) {
  const emails = normalizeInviteEmails(invitation.emails ?? invitation.email);

  return (
    emails.length === 0 || emails.includes(normalizeInviteEmail(userEmail))
  );
}

export function canReuseAcceptedInvite({
  invitation,
  user,
}: {
  invitation: InviteTypeWithId;
  user: UserWithRole;
}) {
  return (
    invitation.status === "used" &&
    inviteMatchesUserEmail({ invitation, userEmail: user.email }) &&
    userHasRole(user.role, invitation.role)
  );
}

export function createInviteCompletionRedirect({
  invitation,
  newAccount,
  token,
}: {
  invitation: InviteTypeWithId;
  newAccount: boolean;
  token: string;
}) {
  const redirectTo =
    invitation.redirectToAfterUpgrade?.replace("{token}", token) ?? "/welcome";
  const url = new URL(redirectTo, "http://localhost");

  url.searchParams.set("upgraded", invitation.role);
  url.searchParams.set("newUser", String(newAccount));

  return `${url.pathname}${url.search}${url.hash}`;
}

function mergeRoles(
  currentRole: string | null | undefined,
  invitedRole: string,
) {
  const roles = [currentRole, invitedRole]
    .flatMap((role) => role?.split(",") ?? [])
    .map((role) => role.trim())
    .filter(Boolean);

  return Array.from(new Set(["user", ...roles])).join(",");
}

/**
 * Converts a single email string or an array of emails into a normalized array format.
 *
 * @returns An array of email strings or a default value if the input is undefined.
 *
 * @example
 * normalizeEmails("test@example.com")
 * // => ["test@example.com"]
 *
 * @example
 * normalizeEmails(["a@test.com", "b@test.com"])
 * // => ["a@test.com", "b@test.com"]
 *
 * @example
 * normalizeEmails(undefined, [])
 * // => []
 */
export function normalizeEmails<T = string[] | undefined>(
  email: string | string[] | undefined = undefined,
  undefinedVal: T = undefined as T,
): string[] | T {
  return email ? (Array.isArray(email) ? email : [email]) : undefinedVal;
}

export const getDate = (span: number, unit: "sec" | "ms" = "ms") => {
  return new Date(Date.now() + (unit === "sec" ? span * 1000 : span));
};

export function redirectError(
  ctx: AuthContext,
  callbackURL: string | undefined,
  query?: Record<string, string> | undefined,
): string {
  const url = callbackURL
    ? new URL(callbackURL, ctx.baseURL)
    : new URL(`${ctx.baseURL}/error`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      url.searchParams.set(k, v);
    }
  }

  return url.href;
}

export function redirectCallback(
  ctx: AuthContext,
  callbackURL: string,
  query?: Record<string, string> | undefined,
): string {
  const url = new URL(callbackURL, ctx.baseURL);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      url.searchParams.set(k, v);
    }
  }

  return url.href;
}

export const checkPermissions = async (
  ctx: GenericEndpointContext,
  permissions: Permissions,
) => {
  const session = await getSessionFromCtx(ctx);

  if (!session?.session) {
    throw APIError.from("UNAUTHORIZED", {
      message: "Unauthorized",
      code: "UNAUTHORIZED",
    });
  }

  const adminPlugin = getPlugin<AdminPlugin>(
    "admin" satisfies AdminPlugin["id"],
    ctx.context,
  );

  if (!adminPlugin) {
    ctx.context.logger.error("Admin plugin is not set-up.");
    throw APIError.from(
      "FAILED_DEPENDENCY",
      ERROR_CODES.ADMIN_PLUGIN_IS_NOT_SET_UP,
    );
  }

  try {
    return await adminPlugin.endpoints.userHasPermission({
      ...ctx,
      body: {
        userId: session.user.id,
        permissions: { [permissions.statement]: permissions.permissions },
      },
      returnHeaders: true,
    });
  } catch {
    return false;
  }
};

type AdminPlugin = ReturnType<typeof admin>;

const getPlugin = <P extends BetterAuthPlugin = BetterAuthPlugin>(
  id: string,
  context: AuthContext,
) => {
  return context.options.plugins?.find((p) => p.id === id) as P | undefined;
};

export const createRedirectURL = ({
  ctx,
  invitation,
  callbackURL,
  customInviteUrl,
}: {
  ctx: GenericEndpointContext;
  invitation: InviteTypeWithId;
  callbackURL: string;
  customInviteUrl?: string;
}) => {
  const realBaseURL = new URL(ctx.context.baseURL);
  const pathname = realBaseURL.pathname === "/" ? "" : realBaseURL.pathname;
  const basePath = pathname ? "" : ctx.context.options.basePath || "";
  let redirectUrl = `/invite/${invitation.token}?callbackURL=${encodeURIComponent(callbackURL)}`;

  if (customInviteUrl)
    redirectUrl = customInviteUrl
      .replace("{token}", invitation.token)
      .replace("{callbackURL}", encodeURIComponent(callbackURL));

  return new URL(
    `${pathname}${basePath}/${redirectUrl.startsWith("/") ? redirectUrl.slice(1) : redirectUrl}`,
    realBaseURL.origin,
  );
};

export const resolveInviteOptions = (
  opts: InviteOptions,
): NewInviteOptions => ({
  getDate: opts.getDate ?? (() => new Date()),
  invitationTokenExpiresIn: opts.invitationTokenExpiresIn ?? 60 * 60,
  defaultShareInviterName: opts.defaultShareInviterName ?? true,
  defaultSenderResponse: opts.defaultSenderResponse ?? "token",
  defaultSenderResponseRedirect: opts.defaultSenderResponseRedirect ?? "signUp",
  defaultTokenType: opts.defaultTokenType ?? "token",
  defaultRedirectToSignIn: opts.defaultRedirectToSignIn ?? "/auth/sign-in",
  defaultRedirectToSignUp: opts.defaultRedirectToSignUp ?? "/auth/sign-up",
  canCreateInvite: opts.canCreateInvite ?? true,
  canAcceptInvite: opts.canAcceptInvite ?? true,
  canCancelInvite: opts.canCancelInvite ?? true,
  canRejectInvite: opts.canRejectInvite ?? true,
  cleanupInvitesAfterMaxUses: opts.cleanupInvitesAfterMaxUses ?? false,
  cleanupInvitesOnDecision: opts.cleanupInvitesOnDecision ?? false,
  ...opts,
});

export const resolveInvitePayload = (
  body: CreateInvite,
  options: NewInviteOptions,
) => ({
  tokenType: body.tokenType ?? options.defaultTokenType,
  redirectToSignUp: body.redirectToSignUp ?? options.defaultRedirectToSignUp,
  redirectToSignIn: body.redirectToSignIn ?? options.defaultRedirectToSignIn,
  maxUses: body.maxUses ?? options.defaultMaxUses,
  expiresIn: body.expiresIn ?? options.invitationTokenExpiresIn,
  redirectToAfterUpgrade:
    body.redirectToAfterUpgrade ?? options.defaultRedirectAfterUpgrade,
  shareInviterName: body.shareInviterName ?? options.defaultShareInviterName,
  senderResponse: body.senderResponse ?? options.defaultSenderResponse,
  senderResponseRedirect:
    body.senderResponseRedirect ?? options.defaultSenderResponseRedirect,
  customInviteUrl: body.customInviteUrl ?? options.defaultCustomInviteUrl,
});

export const resolveTokenGenerator = (
  tokenType: TokensType,
  options: NewInviteOptions,
): (() => string) => {
  if (tokenType === "custom" && options.generateToken) {
    return options.generateToken;
  }

  const tokenGenerators: Record<TokensType, () => string> = {
    code: () => generateRandomString(6, "0-9", "A-Z"),
    token: () => generateId(24),
    custom: () => generateId(24), // secure fallback
  };

  return tokenGenerators[tokenType];
};
