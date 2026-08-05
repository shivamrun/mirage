import type { GenericEndpointContext } from "better-auth";
import {
  APIError,
  createAuthEndpoint,
  sessionMiddleware,
} from "better-auth/api";
import type { UserWithRole } from "better-auth/plugins";
import * as z from "zod";
import { getInviteAdapter, type InviteAdapter } from "../adapter";
import { ERROR_CODES, Tokens } from "../constants";
import type { InviteTypeWithId, NewInviteOptions } from "../types";
import {
  checkPermissions,
  createRedirectURL,
  normalizeInviteEmail,
  normalizeInviteEmails,
  resolveInvitePayload,
  userHasRole,
} from "../utils";

export const createInvite = (options: NewInviteOptions) => {
  return createAuthEndpoint(
    "/invite/create",
    {
      method: "POST",
      body: createInviteBodySchema,
      use: [sessionMiddleware],
      metadata: {
        openapi: {
          operationId: "createInvitation",
          description: "Create an invitation",
          responses: {
            "200": {
              description: "Success",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      status: {
                        type: "boolean",
                      },
                      message: {
                        type: "string",
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (ctx) => {
      const inviterUser = ctx.context.session.user as UserWithRole;

      const { email, role } = ctx.body;
      const {
        redirectToSignUp,
        redirectToSignIn,
        senderResponse,
        senderResponseRedirect,
        customInviteUrl,
      } = resolveInvitePayload(ctx.body, options);

      const emails = Array.from(new Set(normalizeInviteEmails(email)));
      const isPrivate = emails.length > 0;

      // If the invite is public we use [undefined] so the loop runs once and knows it's as a public invite
      const targets = isPrivate ? emails : [undefined];

      const invitations: InviteTypeWithId[] = [];

      if (isPrivate && !options.sendUserInvitation) {
        ctx.context.logger.warn(
          "Invitation email is not enabled. Pass `sendUserInvitation` to the plugin options to enable it.",
        );
        throw APIError.from(
          "INTERNAL_SERVER_ERROR",
          ERROR_CODES.INVITATION_EMAIL_NOT_ENABLED,
        );
      }

      const basicInvitedUser = {
        email: Array.isArray(email) ? emails : emails[0],
        role,
      };

      const canCreateInviteOption =
        typeof options.canCreateInvite === "function"
          ? await options.canCreateInvite({
              invitedUser: basicInvitedUser,
              inviterUser,
              ctx,
            })
          : options.canCreateInvite;
      const canCreateInvite =
        typeof canCreateInviteOption === "object"
          ? await checkPermissions(ctx, canCreateInviteOption)
          : canCreateInviteOption;

      if (!canCreateInvite) {
        throw APIError.from(
          "BAD_REQUEST",
          ERROR_CODES.INSUFFICIENT_PERMISSIONS,
        );
      }

      const adapter = getInviteAdapter(ctx.context, options);
      const privateTargets = isPrivate
        ? await preparePrivateInviteTargets({
            adapter,
            ctx,
            emails,
            inviterUser,
            now: options.getDate(),
            redirectToSignIn,
            redirectToSignUp,
            role,
          })
        : [];

      await options.inviteHooks?.beforeCreateInvite?.({ ctx });

      // Loop for creating and sending invites
      for (const email of targets) {
        // If the invite is public (this is where we use the undefined inside targets) we create the invite, but we don't send any email
        if (!email) {
          const invitation = await adapter.createInvite(
            ctx.body,
            inviterUser,
            undefined,
          );

          invitations.push(invitation);
          continue;
        }

        const target = privateTargets.find((target) => target.email === email);
        if (!target) {
          throw APIError.from("BAD_REQUEST", ERROR_CODES.INVALID_EMAIL);
        }

        const invitation = await createPrivateInviteOrThrowPending({
          adapter,
          body: { ...ctx.body, email },
          email,
          inviterUser,
          newAccount: target.newAccount,
          now: options.getDate(),
          role,
        });

        invitations.push(invitation);

        // If the invite is private, send the user an email
        if (isPrivate) {
          const redirectURL = createRedirectURL({
            ctx,
            invitation,
            callbackURL: target.callbackURL,
            customInviteUrl,
          });

          // This should never happen because we check it at the beginning of the function, but we check it again to make TypeScript happy
          if (!options.sendUserInvitation) {
            throw APIError.from(
              "INTERNAL_SERVER_ERROR",
              ERROR_CODES.INVITATION_EMAIL_NOT_ENABLED,
            );
          }

          try {
            await options.sendUserInvitation(
              {
                email,
                name: target.invitedUser?.user.name,
                role,
                url: redirectURL.toString(),
                token: invitation.token,
                newAccount: target.newAccount,
              },
              ctx.request,
            );
          } catch (e) {
            ctx.context.logger.error("Error sending the invitation email: ", e);
            throw APIError.from(
              "INTERNAL_SERVER_ERROR",
              ERROR_CODES.ERROR_SENDING_THE_INVITATION_EMAIL,
            );
          }
        }
      }

      await options.inviteHooks?.afterCreateInvite?.({
        ctx,
        invitations,
      });

      // If the invitation is private, we return
      if (isPrivate)
        return ctx.json({
          status: true,
          message:
            emails.length === 1
              ? "The invitation was sent"
              : "The invitations were sent",
        });

      // If the invite is public, we return the token
      const invitation = invitations[0];

      if (!invitation) {
        throw APIError.from(
          "INTERNAL_SERVER_ERROR",
          ERROR_CODES.INVITATION_NOT_CREATED,
        );
      }

      const redirectTo =
        senderResponseRedirect === "signUp"
          ? redirectToSignUp
          : redirectToSignIn;

      const redirectURL = createRedirectURL({
        ctx,
        invitation,
        callbackURL: redirectTo,
        customInviteUrl,
      });

      const returnToken =
        senderResponse === "token" ? invitation.token : redirectURL.toString();

      return ctx.json({
        status: true,
        message: returnToken,
      });
    },
  );
};

export const createInviteBodySchema = z.object({
  /**
   * The role to give the invited user.
   */
  role: z.string().describe("The role to give the invited user"),
  /**
   * The email (or emails) address of the user to send a invitation email to.
   */
  email: z
    .union([z.email(), z.array(z.email())])
    .optional()
    .describe(
      "The email (or emails) address of the user to send a invitation email to",
    ),
  /**
   * Type of token tu use, 24 character token,
   * 6 digit code or custom options.generateToken.
   * @default options.defaultTokenType
   */
  tokenType: z
    .enum(Tokens)
    .describe(
      "Type of token tu use, 24 character token, 6 digit code or custom options.generateToken",
    )
    .optional(),
  /**
   * The URL to redirect the user to create their account.
   * If the token isn't valid or expired, it'll be redirected with a query parameter `?
   * error=INVALID_TOKEN`. If the token is valid, it'll be redirected with a query parameter `?
   * token=VALID_TOKEN
   *
   * @default options.defaultRedirectTo
   */
  redirectToSignUp: z
    .string()
    .describe(
      "The URL to redirect the user to create their account. If the token isn't valid or expired, it'll be redirected with a query parameter `?error=INVALID_TOKEN`. If the token is valid, it'll be redirected with a query parameter `?token=VALID_TOKEN",
    )
    .optional(),
  /**
   * The URL to redirect the user to upgrade their role.
   * @default options.defaultRedirectToSignIn
   */
  redirectToSignIn: z
    .string()
    .describe("The URL to redirect the user to upgrade their role.")
    .optional(),
  /**
   * The number of times an invitation can be used.
   * @default options.defaultMaxUses
   */
  maxUses: z
    .number()
    .describe("The number of times an invitation can be used")
    .optional(),
  /**
   * Number of seconds the invitation token is
   * valid for.
   * @default options.invitationTokenExpiresIn
   */
  expiresIn: z
    .number()
    .describe("Number of seconds the invitation token is valid for.")
    .optional(),
  /**
   * The URL to redirect the user to after upgrade their role (if the user is already logged in).
   * {token} will be replaced with the user's actual token.
   *
   * @default options.defaultRedirectAfterUpgrade
   */
  redirectToAfterUpgrade: z
    .string()
    .describe(
      "The URL to redirect the user to after upgrade their role (if the user is already logged in)",
    )
    .optional(),
  /**
   * Whether the inviter's name should be shared with the invitee.
   *
   * When enabled, the person receiving the invitation will see
   * the name of the user who created the invitation.
   *
   * @default options.defaultShareInviterName
   */
  shareInviterName: z
    .boolean()
    .describe("Whether the inviter's name should be shared with the invitee")
    .optional(),
  /**
   * How should the sender receive the token.
   * (sender only receives a token if no email is provided)
   *
   * @default options.defaultSenderResponse
   */
  senderResponse: z
    .enum(["token", "url"])
    .describe(
      "How should the sender receive the token (sender only receives a token if no email is provided)",
    )
    .optional(),
  /**
   * Where should we redirect the user?
   * (only if no email is provided)
   *
   * @default options.defaultSenderResponseRedirect
   */
  senderResponseRedirect: z
    .enum(["signUp", "signIn"])
    .describe(
      "Where should we redirect the user? (only if no email is provided)",
    )
    .optional(),
  /**
   * The user will be redirected here to activate their invite
   * Use {token} and {callbackUrl}, this will be replaced with their values
   */
  customInviteUrl: z
    .string()
    .describe("The user will be redirected here to activate their invite")
    .optional(),
});

export type CreateInvite = z.infer<typeof createInviteBodySchema>;

type UserWithStoredRole = {
  role?: string | string[] | null;
};

type InvitedUserLookup = {
  user: UserWithRole & UserWithStoredRole;
} | null;

type PreparedPrivateInviteTarget = {
  email: string;
  invitedUser: InvitedUserLookup;
  callbackURL: string;
  newAccount: boolean;
};

async function preparePrivateInviteTargets({
  adapter,
  ctx,
  emails,
  inviterUser,
  now,
  redirectToSignIn,
  redirectToSignUp,
  role,
}: {
  adapter: InviteAdapter;
  ctx: GenericEndpointContext;
  emails: string[];
  inviterUser: UserWithRole;
  now: Date;
  redirectToSignIn: string;
  redirectToSignUp: string;
  role: string;
}) {
  const normalizedInviterEmail = normalizeInviteEmail(inviterUser.email);
  const targets: PreparedPrivateInviteTarget[] = [];

  for (const email of emails) {
    if (normalizedInviterEmail === email) {
      throw APIError.from("BAD_REQUEST", ERROR_CODES.SELF_INVITE_NOT_ALLOWED);
    }

    const existingPendingInvite = await findPendingInviteForEmailAndRole({
      adapter,
      email,
      now,
      role,
    });

    if (existingPendingInvite) {
      throw APIError.from(
        "BAD_REQUEST",
        ERROR_CODES.INVITATION_ALREADY_PENDING,
      );
    }

    const invitedUser = (await ctx.context.internalAdapter.findUserByEmail(
      email,
      { includeAccounts: true },
    )) as InvitedUserLookup;

    if (
      invitedUser &&
      userHasRole((invitedUser.user as UserWithStoredRole).role, role)
    ) {
      throw APIError.from("BAD_REQUEST", ERROR_CODES.USER_ALREADY_HAS_ROLE);
    }

    targets.push({
      email,
      invitedUser,
      callbackURL: invitedUser ? redirectToSignIn : redirectToSignUp,
      newAccount: !invitedUser,
    });
  }

  return targets;
}

async function createPrivateInviteOrThrowPending({
  adapter,
  body,
  email,
  inviterUser,
  newAccount,
  now,
  role,
}: {
  adapter: InviteAdapter;
  body: CreateInvite;
  email: string;
  inviterUser: UserWithRole;
  newAccount: boolean;
  now: Date;
  role: string;
}) {
  try {
    return await adapter.createInvite(body, inviterUser, newAccount);
  } catch (error) {
    const existingPendingInvite = await findPendingInviteForEmailAndRole({
      adapter,
      email,
      now,
      role,
    });

    if (existingPendingInvite) {
      throw APIError.from(
        "BAD_REQUEST",
        ERROR_CODES.INVITATION_ALREADY_PENDING,
      );
    }

    throw error;
  }
}

async function findPendingInviteForEmailAndRole({
  adapter,
  email,
  now,
  role,
}: {
  adapter: InviteAdapter;
  email: string;
  now: Date;
  role: string;
}) {
  const pendingInvites = await adapter.listInvitations({
    where: [
      {
        field: "role",
        value: role,
      },
      {
        field: "status",
        value: "pending",
      },
    ],
  });
  const normalizedEmail = normalizeInviteEmail(email);

  for (const invitation of pendingInvites) {
    const matchesEmail = normalizeInviteEmails(
      invitation.emails ?? invitation.email,
    ).includes(normalizedEmail);

    if (!matchesEmail) {
      continue;
    }

    if (invitation.expiresAt <= now) {
      await adapter.updateInvitation(invitation.id, "expired");
      continue;
    }

    return invitation;
  }

  return null;
}
