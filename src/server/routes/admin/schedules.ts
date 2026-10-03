import { Elysia } from "elysia";

import type { CurrentUser } from "@/server/db/services/auth/current-user";
import { requestPolicy } from "@/server/http/request-policy";
import {
  AdminScheduleConflictError,
  AdminScheduleNotFoundError,
  triggerAdminSchedule,
} from "@/server/jobs/admin-schedules";
import {
  adminScheduleTriggerResponseSchema,
  adminScheduleTriggerSchema,
  messageResponseSchema,
} from "@/shared/schemas";

function actor(context: unknown) {
  return (context as { authUser: CurrentUser }).authUser;
}

function logAction(details: Record<string, unknown>) {
  console.info(JSON.stringify({ event: "admin_schedule_action", ...details }));
}

function operationError(error: unknown) {
  if (error instanceof AdminScheduleNotFoundError) {
    return { code: 404 as const, message: error.message };
  }
  if (error instanceof AdminScheduleConflictError) {
    return { code: 409 as const, message: error.message };
  }
  return {
    code: 503 as const,
    message: "Schedules service is temporarily unavailable.",
  };
}

export const adminScheduleRoutes = new Elysia().use(requestPolicy).post(
  "/schedules/trigger",
  async (context) => {
    const { body, status } = context;
    try {
      const jobId = await triggerAdminSchedule(body.scheduleId, body.requestId);
      logAction({
        action: "trigger",
        actorUserId: actor(context).id,
        jobId,
        outcome: "success",
        scheduleId: body.scheduleId,
      });
      return { jobId, status: true as const };
    } catch (error) {
      logAction({
        action: "trigger",
        actorUserId: actor(context).id,
        outcome: "rejected",
        scheduleId: body.scheduleId,
      });
      const failure = operationError(error);
      return status(failure.code, { message: failure.message });
    }
  },
  {
    body: adminScheduleTriggerSchema,
    routeLimit: "admin-schedules-mutation",
    sameOrigin: true,
    response: {
      200: adminScheduleTriggerResponseSchema,
      403: messageResponseSchema,
      404: messageResponseSchema,
      409: messageResponseSchema,
      429: messageResponseSchema,
      503: messageResponseSchema,
    },
  },
);
