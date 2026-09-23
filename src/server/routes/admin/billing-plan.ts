import { Elysia } from "elysia";
import {
  createAdminBillingPlan,
  listAdminBillingPlans,
  updateAdminBillingPlan,
} from "@/server/db/services/admin/billing-plan";
import { requestPolicy } from "@/server/http/request-policy";
import {
  adminBillingPlanMutationSchema,
  adminStatusResponseSchema,
  adminUpdateBillingPlanSchema,
  billingPlanParamsSchema,
  messageResponseSchema,
} from "@/shared/schemas";

export const adminBillingPlanRoutes = new Elysia()
  .use(requestPolicy)
  .get("/billing-plans", async () => ({
    plans: await listAdminBillingPlans(),
    status: true as const,
  }))
  .post(
    "/billing-plans",
    async ({ body, status }) => {
      const result = await createAdminBillingPlan(body);

      if (result.status === "failed") {
        return status(500, { message: "Billing plan could not be created." });
      }

      if (result.status === "conflict") {
        return status(409, { message: result.conflict.message });
      }

      return {
        plan: result.plan,
        status: true as const,
      };
    },
    {
      sameOrigin: true,
      body: adminBillingPlanMutationSchema,
      response: {
        200: adminStatusResponseSchema,
        400: messageResponseSchema,
        403: messageResponseSchema,
        409: messageResponseSchema,
        500: messageResponseSchema,
      },
    },
  )
  .patch(
    "/billing-plans/:planId",
    async ({ body, params, status }) => {
      const result = await updateAdminBillingPlan({
        id: params.planId,
        values: body,
      });

      if (result.status === "not-found") {
        return status(404, { message: "Billing plan not found." });
      }

      if (result.status === "conflict") {
        return status(409, { message: result.conflict.message });
      }

      return {
        plan: result.plan,
        status: true as const,
      };
    },
    {
      sameOrigin: true,
      body: adminUpdateBillingPlanSchema,
      params: billingPlanParamsSchema,
      response: {
        200: adminStatusResponseSchema,
        400: messageResponseSchema,
        403: messageResponseSchema,
        404: messageResponseSchema,
        409: messageResponseSchema,
        500: messageResponseSchema,
      },
    },
  );
