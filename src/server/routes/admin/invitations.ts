import { Elysia } from "elysia";

import {
  listAdminInvitationsView,
  toAdminCreateInvitationResponse,
  toAdminInvitationResponse,
} from "@/server/db/services/admin/invitations";
import type { CurrentUser } from "@/server/db/services/auth/current-user";
import {
  createInvitationAndSendEmail,
  resendInvitationEmail,
  revokeInvitation,
} from "@/server/db/services/invitations/service";
import { requestPolicy } from "@/server/http/request-policy";
import {
  adminCreateInvitationResponseSchema,
  adminCreateInvitationSchema,
  adminInvitationsListQuerySchema,
  adminInvitationsListResponseSchema,
  messageResponseSchema,
} from "@/shared/schemas";

function getAdminRouteUser(context: unknown) {
  return (context as { authUser: CurrentUser }).authUser;
}

export const adminInvitationRoutes = new Elysia()
  .use(requestPolicy)
  .get(
    "/invitations",
    async ({ query }) =>
      listAdminInvitationsView({
        effectiveStatus: query.effectiveStatus,
        limit: query.limit,
        page: query.page,
      }),
    {
      query: adminInvitationsListQuerySchema,
      response: {
        200: adminInvitationsListResponseSchema,
        403: messageResponseSchema,
        500: messageResponseSchema,
      },
    },
  )
  .post(
    "/invitations",
    async (context) => {
      const { body, status } = context;
      const result = await createInvitationAndSendEmail({
        email: body.email,
        invitedByUserId: getAdminRouteUser(context).id,
        role: body.role,
      });

      switch (result.status) {
        case "success":
          return toAdminCreateInvitationResponse(result);
        case "invalid-email":
        case "invalid-role":
          return status(400, { message: "Invalid invitation request." });
        case "duplicate-active-invitation":
          return status(409, {
            message: "An active invitation already exists for this email.",
          });
        case "existing-user":
          return status(409, {
            message: "A user with this email already exists.",
          });
        case "email-delivery-failed":
          return status(503, {
            message: "Invitation email could not be delivered.",
          });
      }
    },
    {
      sameOrigin: true,
      body: adminCreateInvitationSchema,
      routeLimit: "admin-invitation-mutation",
      response: {
        200: adminCreateInvitationResponseSchema,
        400: messageResponseSchema,
        403: messageResponseSchema,
        409: messageResponseSchema,
        429: messageResponseSchema,
        503: messageResponseSchema,
        500: messageResponseSchema,
      },
    },
  )
  .post(
    "/invitations/:id/resend",
    async ({ params, status }) => {
      const result = await resendInvitationEmail({ id: params.id });

      switch (result.status) {
        case "success":
          return {
            invitation: toAdminInvitationResponse(result.invitation),
            status: true as const,
          };
        case "email-delivery-failed":
          return status(503, {
            message: "Invitation email could not be delivered.",
          });
        case "not-found":
          return status(404, { message: "Invitation not found." });
        case "existing-user":
          return status(409, {
            message: "A user with this email already exists.",
          });
        case "not-pending":
          return status(409, {
            message: "Invitation is no longer pending.",
          });
      }
    },
    {
      sameOrigin: true,
      routeLimit: "admin-invitation-mutation",
      response: {
        200: adminCreateInvitationResponseSchema,
        403: messageResponseSchema,
        404: messageResponseSchema,
        409: messageResponseSchema,
        429: messageResponseSchema,
        503: messageResponseSchema,
        500: messageResponseSchema,
      },
    },
  )
  .post(
    "/invitations/:id/revoke",
    async ({ params, status }) => {
      const result = await revokeInvitation({ id: params.id });

      switch (result.status) {
        case "success":
          return {
            invitation: toAdminInvitationResponse(result.invitation),
            status: true as const,
          };
        case "not-found":
          return status(404, { message: "Invitation not found." });
        case "not-pending":
          return status(409, {
            message: "Invitation is no longer pending.",
          });
      }
    },
    {
      sameOrigin: true,
      routeLimit: "admin-invitation-mutation",
      response: {
        200: adminCreateInvitationResponseSchema,
        403: messageResponseSchema,
        404: messageResponseSchema,
        409: messageResponseSchema,
        429: messageResponseSchema,
        500: messageResponseSchema,
      },
    },
  );
