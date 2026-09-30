import { Elysia } from "elysia";

import {
  listAdminInvitationsView,
  toAdminCreateInvitationResponse,
} from "@/server/db/services/admin/invitations";
import type { CurrentUser } from "@/server/db/services/auth/current-user";
import { createInvitationAndSendEmail } from "@/server/db/services/invitations/service";
import { requestPolicy } from "@/server/http/request-policy";
import {
  adminCreateInvitationResponseSchema,
  adminCreateInvitationSchema,
  adminInvitationsListResponseSchema,
  messageResponseSchema,
  paginationQuerySchema,
} from "@/shared/schemas";

function getAdminRouteUser(context: unknown) {
  return (context as { authUser: CurrentUser }).authUser;
}

function stringBodyValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function invitationRoleBodyValue(value: unknown) {
  if (value === undefined) {
    return undefined;
  }

  return typeof value === "string" ? value : "__invalid__";
}

export const adminInvitationRoutes = new Elysia()
  .use(requestPolicy)
  .get(
    "/invitations",
    async ({ query }) =>
      listAdminInvitationsView({
        limit: query.limit,
        page: query.page,
      }),
    {
      query: paginationQuerySchema,
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
        email: stringBodyValue(body.email),
        invitedByUserId: getAdminRouteUser(context).id,
        role: invitationRoleBodyValue(body.role),
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
  );
