import { Elysia } from "elysia";

import type { CurrentUser } from "@/server/db/services/auth/current-user";
import { requestPolicy } from "@/server/http/request-policy";
import {
  AdminJobConflictError,
  AdminJobNotFoundError,
  AdminJobsUnavailableError,
  getAdminJobDetail,
  removeAdminJob,
  retryAdminJob,
  triggerAdminSchedule,
} from "@/server/jobs/admin";
import {
  adminJobActionSchema,
  adminJobDetailQuerySchema,
  adminJobDetailResponseSchema,
  adminJobMutationResponseSchema,
  adminScheduleTriggerResponseSchema,
  adminScheduleTriggerSchema,
  messageResponseSchema,
} from "@/shared/schemas";

function actor(context: unknown) {
  return (context as { authUser: CurrentUser }).authUser;
}

function logAction(details: Record<string, unknown>) {
  console.info(JSON.stringify({ event: "admin_job_action", ...details }));
}

function operationError(error: unknown) {
  if (error instanceof AdminJobNotFoundError) {
    return { code: 404 as const, message: error.message };
  }
  if (error instanceof AdminJobConflictError) {
    return { code: 409 as const, message: error.message };
  }
  const message =
    error instanceof AdminJobsUnavailableError
      ? "Jobs service is temporarily unavailable."
      : "Jobs service is temporarily unavailable.";
  return { code: 503 as const, message };
}

export const adminJobRoutes = new Elysia()
  .use(requestPolicy)
  .get(
    "/jobs/detail",
    async ({ query, status }) => {
      try {
        return { job: await getAdminJobDetail(query.queue, query.jobId) };
      } catch (error) {
        const failure = operationError(error);
        return status(failure.code, { message: failure.message });
      }
    },
    {
      query: adminJobDetailQuerySchema,
      response: {
        200: adminJobDetailResponseSchema,
        403: messageResponseSchema,
        404: messageResponseSchema,
        409: messageResponseSchema,
        503: messageResponseSchema,
      },
    },
  )
  .post(
    "/jobs/retry",
    async (context) => {
      const { body, status } = context;
      try {
        const job = await retryAdminJob(body.queue, body.jobId);
        logAction({
          action: "retry",
          actorUserId: actor(context).id,
          jobId: body.jobId,
          outcome: "success",
          queue: body.queue,
        });
        return { job, status: true as const };
      } catch (error) {
        logAction({
          action: "retry",
          actorUserId: actor(context).id,
          jobId: body.jobId,
          outcome: "rejected",
          queue: body.queue,
        });
        const failure = operationError(error);
        return status(failure.code, { message: failure.message });
      }
    },
    {
      body: adminJobActionSchema,
      routeLimit: "admin-jobs-mutation",
      sameOrigin: true,
      response: {
        200: adminJobMutationResponseSchema,
        403: messageResponseSchema,
        404: messageResponseSchema,
        409: messageResponseSchema,
        429: messageResponseSchema,
        503: messageResponseSchema,
      },
    },
  )
  .post(
    "/jobs/remove",
    async (context) => {
      const { body, status } = context;
      try {
        const job = await removeAdminJob(body.queue, body.jobId);
        logAction({
          action: "remove",
          actorUserId: actor(context).id,
          jobId: body.jobId,
          outcome: "success",
          queue: body.queue,
        });
        return { job, status: true as const };
      } catch (error) {
        logAction({
          action: "remove",
          actorUserId: actor(context).id,
          jobId: body.jobId,
          outcome: "rejected",
          queue: body.queue,
        });
        const failure = operationError(error);
        return status(failure.code, { message: failure.message });
      }
    },
    {
      body: adminJobActionSchema,
      routeLimit: "admin-jobs-mutation",
      sameOrigin: true,
      response: {
        200: adminJobMutationResponseSchema,
        403: messageResponseSchema,
        404: messageResponseSchema,
        409: messageResponseSchema,
        429: messageResponseSchema,
        503: messageResponseSchema,
      },
    },
  )
  .post(
    "/jobs/schedules/trigger",
    async (context) => {
      const { body, status } = context;
      try {
        const jobId = await triggerAdminSchedule(
          body.scheduleId,
          body.requestId,
        );
        logAction({
          action: "trigger-schedule",
          actorUserId: actor(context).id,
          jobId,
          outcome: "success",
          scheduleId: body.scheduleId,
        });
        return { jobId, status: true as const };
      } catch (error) {
        logAction({
          action: "trigger-schedule",
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
      routeLimit: "admin-jobs-mutation",
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
