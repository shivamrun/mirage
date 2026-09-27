import { Elysia } from "elysia";
import {
  cancelPendingEmailChange,
  changeAccountEmail,
  getAccountEmailState,
  resendAccountVerification,
  resendPendingEmailChangeVerification,
  resolveEmailChangeApprovalRedirectURL,
  resolveEmailChangeConfirmationRedirectURL,
} from "@/server/db/services/account/email-change";
import { getConnectedGoogleAccount } from "@/server/db/services/account/google-account";
import {
  disableAccountTwoFactor,
  sendAccountTwoFactorEmailCode,
  startAccountTwoFactorSetup,
  verifyAccountTwoFactorSetup,
} from "@/server/db/services/account/two-factor";
import { completeAdminTotpStepUp } from "@/server/db/services/auth/admin-step-up";
import {
  getUnreadNotificationCount,
  listNotificationsView,
  markUserNotificationRead,
  markUserNotificationsRead,
  markUserNotificationUnread,
} from "@/server/db/services/notifications/service";
import { elysiaAuth } from "@/server/http/auth";
import { requestPolicy } from "@/server/http/request-policy";
import { accountErrorResponse } from "@/server/http/result-response";
import { env } from "@/shared/env";
import { DEFAULT_PAGE_SIZE } from "@/shared/pagination";
import {
  accountEmailMutationResponseSchema,
  accountEmailStateResponseSchema,
  accountRedirectResponseSchema,
  changeAccountEmailBodySchema,
  emailChangeApprovalRecoveryResponseSchema,
  emailChangeRedirectQuerySchema,
  emailChangeTokenSchema,
  messageResponseSchema,
  notificationIdParamsSchema,
  notificationMutationResponseSchema,
  notificationsListResponseSchema,
  statusSuccessResponseSchema,
  twoFactorCodeSchema,
  twoFactorDeliveryRecoveryResponseSchema,
  twoFactorEmailCodeActionSchema,
  twoFactorEmailCodeResponseSchema,
  twoFactorEnabledResponseSchema,
  twoFactorStartSetupResponseSchema,
  unreadNotificationCountResponseSchema,
} from "@/shared/schemas";
import { paginationQuerySchema } from "@/shared/schemas/pagination";

function emailChangePageURL({
  action,
  token,
}: {
  action: "approve" | "confirm";
  token: string;
}) {
  const url = new URL("/email-change", env.NEXT_PUBLIC_BASE_URL);
  url.searchParams.set("action", action);
  url.searchParams.set("token", token);
  return url;
}

function invalidEmailChangePageURL() {
  const url = new URL("/email-change", env.NEXT_PUBLIC_BASE_URL);
  url.searchParams.set("status", "invalid");
  return url;
}

export const accountRoutes = new Elysia({ prefix: "/account" })
  .use(elysiaAuth)
  .use(requestPolicy)
  .get(
    "/notifications",
    async ({ query, user }) => {
      const { limit, page } = paginationQuerySchema.parse(query);
      const result = await listNotificationsView({
        limit,
        page,
        recipientId: user.id,
      });

      return {
        items: result.notifications,
        pagination: {
          firstItem: result.firstItem,
          hasNextPage: result.hasNextPage,
          hasPreviousPage: result.hasPreviousPage,
          lastItem: result.lastItem,
          limit: result.limit,
          offset: result.offset,
          page: result.page,
          total: result.total,
          totalPages: result.totalPages,
        },
      };
    },
    {
      auth: true,
      query: paginationQuerySchema.default({
        limit: DEFAULT_PAGE_SIZE,
        page: 1,
      }),
      response: {
        200: notificationsListResponseSchema,
        401: messageResponseSchema,
      },
    },
  )
  .get(
    "/notifications/unread-count",
    async ({ user }) => {
      const unreadCount = await getUnreadNotificationCount({
        recipientId: user.id,
      });

      return { unreadCount };
    },
    {
      auth: true,
      response: {
        200: unreadNotificationCountResponseSchema,
        401: messageResponseSchema,
      },
    },
  )
  .post(
    "/notifications/:id/read",
    async ({ params, user }) => {
      const notification = await markUserNotificationRead({
        id: params.id,
        recipientId: user.id,
      });

      return { notification };
    },
    {
      auth: true,
      params: notificationIdParamsSchema,
      sameOrigin: true,
      response: {
        200: notificationMutationResponseSchema,
        401: messageResponseSchema,
      },
    },
  )
  .post(
    "/notifications/:id/unread",
    async ({ params, user }) => {
      const notification = await markUserNotificationUnread({
        id: params.id,
        recipientId: user.id,
      });

      return { notification };
    },
    {
      auth: true,
      params: notificationIdParamsSchema,
      sameOrigin: true,
      response: {
        200: notificationMutationResponseSchema,
        401: messageResponseSchema,
      },
    },
  )
  .post(
    "/notifications/read-all",
    async ({ user }) => {
      await markUserNotificationsRead({ recipientId: user.id });

      return { status: true as const };
    },
    {
      auth: true,
      sameOrigin: true,
      response: {
        200: statusSuccessResponseSchema,
        401: messageResponseSchema,
      },
    },
  )
  .get(
    "/",
    async ({ authSession }) => {
      const result = await getAccountEmailState({
        authSession,
      });

      return result.value;
    },
    {
      auth: true,
      response: {
        200: accountEmailStateResponseSchema,
        401: messageResponseSchema,
        500: messageResponseSchema,
      },
    },
  )
  .get(
    "/google-account",
    async ({ authSession }) => {
      const connectedAccount = await getConnectedGoogleAccount({
        authSession,
      });

      return {
        account: connectedAccount,
      };
    },
    {
      auth: true,
    },
  )
  .post(
    "/admin-step-up/totp",
    async ({ authSession, body, set, status }) => {
      const result = await completeAdminTotpStepUp({
        authSession,
        code: body.code,
      });

      if (result.kind === "error") {
        return accountErrorResponse({ error: result, set, status });
      }

      return { status: true as const };
    },
    {
      auth: true,
      sameOrigin: true,
      body: twoFactorCodeSchema,
      routeLimit: "account-two-factor-mutation",
      response: {
        200: twoFactorEmailCodeResponseSchema,
        400: messageResponseSchema,
        401: messageResponseSchema,
        403: messageResponseSchema,
        429: messageResponseSchema,
        500: messageResponseSchema,
      },
    },
  )
  .post(
    "/two-factor/send-code",
    async ({ authSession, body, set, status }) => {
      const result = await sendAccountTwoFactorEmailCode({
        action: body.action,
        authSession,
      });
      if (result.kind === "error" && result.recovery) {
        return status(503, {
          message: result.message,
          recovery: result.recovery,
        });
      }
      if (result.kind === "error") {
        return accountErrorResponse({ error: result, set, status });
      }

      return { status: true as const };
    },
    {
      auth: true,
      sameOrigin: true,
      body: twoFactorEmailCodeActionSchema,
      routeLimit: "account-two-factor-mutation",
      response: {
        200: twoFactorEmailCodeResponseSchema,
        400: messageResponseSchema,
        401: messageResponseSchema,
        403: messageResponseSchema,
        409: messageResponseSchema,
        429: messageResponseSchema,
        500: messageResponseSchema,
        503: twoFactorDeliveryRecoveryResponseSchema,
      },
    },
  )
  .post(
    "/two-factor/start-setup",
    async ({ authSession, body, set, status }) => {
      const result = await startAccountTwoFactorSetup({
        authSession,
        code: body.code,
      });

      if (result.kind === "error") {
        return accountErrorResponse({ error: result, set, status });
      }

      return {
        status: true as const,
        totpURI: result.totpURI,
      };
    },
    {
      auth: true,
      sameOrigin: true,
      body: twoFactorCodeSchema,
      routeLimit: "account-two-factor-mutation",
      response: {
        200: twoFactorStartSetupResponseSchema,
        400: messageResponseSchema,
        401: messageResponseSchema,
        403: messageResponseSchema,
        409: messageResponseSchema,
        429: messageResponseSchema,
        500: messageResponseSchema,
      },
    },
  )
  .post(
    "/two-factor/verify-setup",
    async ({ authSession, body, set, status }) => {
      const result = await verifyAccountTwoFactorSetup({
        authSession,
        code: body.code,
      });

      if (result.kind === "error") {
        return accountErrorResponse({ error: result, set, status });
      }

      return {
        status: true as const,
        twoFactorEnabled: result.twoFactorEnabled,
      };
    },
    {
      auth: true,
      sameOrigin: true,
      body: twoFactorCodeSchema,
      routeLimit: "account-two-factor-mutation",
      response: {
        200: twoFactorEnabledResponseSchema,
        400: messageResponseSchema,
        401: messageResponseSchema,
        403: messageResponseSchema,
        409: messageResponseSchema,
        429: messageResponseSchema,
        500: messageResponseSchema,
      },
    },
  )
  .post(
    "/two-factor/disable",
    async ({ authSession, body, set, status }) => {
      const result = await disableAccountTwoFactor({
        authSession,
        code: body.code,
      });

      if (result.kind === "error") {
        return accountErrorResponse({ error: result, set, status });
      }

      return {
        status: true as const,
        twoFactorEnabled: result.twoFactorEnabled,
      };
    },
    {
      auth: true,
      sameOrigin: true,
      body: twoFactorCodeSchema,
      routeLimit: "account-two-factor-mutation",
      response: {
        200: twoFactorEnabledResponseSchema,
        400: messageResponseSchema,
        401: messageResponseSchema,
        403: messageResponseSchema,
        409: messageResponseSchema,
        429: messageResponseSchema,
        500: messageResponseSchema,
      },
    },
  )
  .get(
    "/confirm-email-change",
    async ({ query }) => {
      const token = query.token ?? "";

      if (!token) {
        return Response.redirect(invalidEmailChangePageURL());
      }

      return Response.redirect(
        emailChangePageURL({ action: "confirm", token }),
      );
    },
    {
      query: emailChangeRedirectQuerySchema,
    },
  )
  .post(
    "/confirm-email-change",
    async ({ body }) => {
      const result = await resolveEmailChangeConfirmationRedirectURL({
        token: body.token,
      });

      return {
        status: true as const,
        redirectURL: result.redirectURL,
      };
    },
    {
      sameOrigin: true,
      body: emailChangeTokenSchema,
      response: {
        200: accountRedirectResponseSchema,
        400: messageResponseSchema,
        403: messageResponseSchema,
        500: messageResponseSchema,
      },
    },
  )
  .get(
    "/approve-email-change",
    async ({ query }) => {
      const token = query.token ?? "";

      if (!token) {
        return Response.redirect(invalidEmailChangePageURL());
      }

      return Response.redirect(
        emailChangePageURL({ action: "approve", token }),
      );
    },
    {
      query: emailChangeRedirectQuerySchema,
    },
  )
  .post(
    "/approve-email-change",
    async ({ body, set, status }) => {
      const result = await resolveEmailChangeApprovalRedirectURL({
        token: body.token,
      });

      if (result.retryAfterSeconds) {
        set.headers["Retry-After"] = String(result.retryAfterSeconds);
        return status(429, {
          message:
            "Please wait before requesting another email change message.",
        });
      }

      if (result.deliveryFailed) {
        return status(503, {
          message:
            "Your approval was saved, but we could not confirm delivery to the new address. Sign in and resend verification from your account after a minute if the message does not arrive.",
          recovery: "resend-from-account",
        });
      }

      return {
        status: true as const,
        redirectURL: result.redirectURL,
      };
    },
    {
      sameOrigin: true,
      body: emailChangeTokenSchema,
      response: {
        200: accountRedirectResponseSchema,
        400: messageResponseSchema,
        403: messageResponseSchema,
        429: messageResponseSchema,
        500: messageResponseSchema,
        503: emailChangeApprovalRecoveryResponseSchema,
      },
    },
  )
  .post(
    "/change-email",
    async ({ authSession, body, set, status }) => {
      const result = await changeAccountEmail({
        authSession,
        body: {
          ...body,
          callbackURL: "/email-verification?status=success",
        },
      });

      if (result.kind === "error") {
        return accountErrorResponse({ error: result, set, status });
      }

      return {
        status: true as const,
        ...result.value,
      };
    },
    {
      auth: true,
      sameOrigin: true,
      body: changeAccountEmailBodySchema,
      routeLimit: "account-email-mutation",
      response: {
        200: accountEmailMutationResponseSchema,
        400: messageResponseSchema,
        401: messageResponseSchema,
        403: messageResponseSchema,
        409: messageResponseSchema,
        429: messageResponseSchema,
        500: messageResponseSchema,
        503: messageResponseSchema,
      },
    },
  )
  .post(
    "/cancel-email-change",
    async ({ authSession, set, status }) => {
      const result = await cancelPendingEmailChange({
        authSession,
      });

      if (result.kind === "error") {
        return accountErrorResponse({ error: result, set, status });
      }

      return {
        status: true as const,
        ...result.value,
      };
    },
    {
      auth: true,
      sameOrigin: true,
      routeLimit: "account-email-mutation",
      response: {
        200: accountEmailMutationResponseSchema,
        400: messageResponseSchema,
        401: messageResponseSchema,
        403: messageResponseSchema,
        409: messageResponseSchema,
        429: messageResponseSchema,
        500: messageResponseSchema,
      },
    },
  )
  .post(
    "/resend-verification",
    async ({ authSession, request, set, status }) => {
      const result = await resendAccountVerification({
        authSession,
        headers: request.headers,
      });

      if (result.kind === "error") {
        return accountErrorResponse({ error: result, set, status });
      }

      return {
        status: true as const,
        ...result.value,
      };
    },
    {
      auth: true,
      sameOrigin: true,
      routeLimit: "account-email-mutation",
      response: {
        200: accountEmailMutationResponseSchema,
        400: messageResponseSchema,
        401: messageResponseSchema,
        403: messageResponseSchema,
        409: messageResponseSchema,
        429: messageResponseSchema,
        500: messageResponseSchema,
      },
    },
  )
  .post(
    "/resend-email-change-verification",
    async ({ authSession, set, status }) => {
      const result = await resendPendingEmailChangeVerification({
        authSession,
      });

      if (result.kind === "error") {
        return accountErrorResponse({ error: result, set, status });
      }

      return {
        status: true as const,
        ...result.value,
      };
    },
    {
      auth: true,
      sameOrigin: true,
      routeLimit: "account-email-mutation",
      response: {
        200: accountEmailMutationResponseSchema,
        400: messageResponseSchema,
        401: messageResponseSchema,
        403: messageResponseSchema,
        409: messageResponseSchema,
        429: messageResponseSchema,
        500: messageResponseSchema,
        503: messageResponseSchema,
      },
    },
  );
