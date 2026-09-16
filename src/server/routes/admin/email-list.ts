import { Elysia } from "elysia";
import {
  createAdminEmailList,
  deleteAdminEmailList,
  updateAdminEmailList,
  updateAdminEmailListStatus,
} from "@/server/db/services/admin/email-list";
import { requestPolicy } from "@/server/http/request-policy";
import {
  adminCreateEmailListSchema,
  adminStatusResponseSchema,
  adminUpdateEmailListSchema,
  emailListKeyParamsSchema,
  emailListStatusUpdateBodySchema,
  messageResponseSchema,
} from "@/shared/schemas";

export const adminEmailListRoutes = new Elysia()
  .use(requestPolicy)
  .post(
    "/email-list",
    async ({ body, status }) => {
      const result = await createAdminEmailList(body);

      if (result.status === "failed") {
        return status(500, { message: "Email list could not be created." });
      }

      return {
        list: result.list,
        status: true as const,
      };
    },
    {
      sameOrigin: true,
      body: adminCreateEmailListSchema,
      response: {
        200: adminStatusResponseSchema,
        400: messageResponseSchema,
        403: messageResponseSchema,
        500: messageResponseSchema,
      },
    },
  )
  .patch(
    "/email-list/:key",
    async ({ body, params, status }) => {
      const result = await updateAdminEmailList({
        ...body,
        key: params.key,
      });

      if (result.status === "not-found") {
        return status(404, { message: "Email list not found." });
      }

      return {
        list: result.list,
        status: true as const,
      };
    },
    {
      sameOrigin: true,
      body: adminUpdateEmailListSchema,
      params: emailListKeyParamsSchema,
      response: {
        200: adminStatusResponseSchema,
        400: messageResponseSchema,
        403: messageResponseSchema,
        404: messageResponseSchema,
        500: messageResponseSchema,
      },
    },
  )
  .patch(
    "/email-list/:key/status",
    async ({ body, params, status }) => {
      const result = await updateAdminEmailListStatus({
        key: params.key,
        status: body.status,
      });

      if (result.status === "not-found") {
        return status(404, { message: "Email list not found." });
      }

      return {
        status: true as const,
      };
    },
    {
      sameOrigin: true,
      body: emailListStatusUpdateBodySchema,
      params: emailListKeyParamsSchema,
      response: {
        200: adminStatusResponseSchema,
        400: messageResponseSchema,
        403: messageResponseSchema,
        404: messageResponseSchema,
        500: messageResponseSchema,
      },
    },
  )
  .delete(
    "/email-list/:key",
    async ({ params, status }) => {
      const result = await deleteAdminEmailList(params.key);

      if (result.status === "protected") {
        return status(400, {
          message: "Built-in email lists cannot be deleted.",
        });
      }

      if (result.status === "not-found") {
        return status(404, { message: "Email list not found." });
      }

      return {
        status: true as const,
      };
    },
    {
      sameOrigin: true,
      params: emailListKeyParamsSchema,
      response: {
        200: adminStatusResponseSchema,
        400: messageResponseSchema,
        403: messageResponseSchema,
        404: messageResponseSchema,
        500: messageResponseSchema,
      },
    },
  );
