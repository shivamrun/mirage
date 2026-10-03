import { randomUUID } from "node:crypto";

import { Elysia } from "elysia";
import { afterEach, describe, expect, it } from "vitest";

import { closeJobQueues, getJobQueue } from "@/adapters/jobs/queues";
import { apiErrors } from "@/server/http/errors";
import {
  AdminScheduleConflictError,
  AdminScheduleNotFoundError,
  listAdminSchedules,
  triggerAdminSchedule,
} from "@/server/jobs/admin-schedules";
import { jobQueueNames } from "@/server/jobs/registry";
import { syncJobSchedules } from "@/server/jobs/schedule-manager";
import { jobSchedules } from "@/server/jobs/schedules";
import { adminRoutes } from "@/server/routes/admin";
import { createTestActor } from "./infra/admin-actor";

const origin = "http://localhost:3000";
const app = new Elysia({ prefix: "/api" }).use(apiErrors).use(adminRoutes);

afterEach(async () => {
  for (const queueName of Object.values(jobQueueNames)) {
    const queue = getJobQueue(queueName);
    const schedulers = await queue.getJobSchedulers(0, -1, true);
    await Promise.all(
      schedulers.map((scheduler) => queue.removeJobScheduler(scheduler.key)),
    );
    await queue.obliterate({ force: true });
  }
  await closeJobQueues();
});

describe("admin schedules", () => {
  it("lists registered schedules with execution data", async () => {
    await syncJobSchedules();

    const schedules = await listAdminSchedules();
    expect(schedules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          enabled: true,
          id: jobSchedules[0].id,
          lastRunAt: null,
          manualTrigger: true,
          nextRunAt: expect.any(String),
        }),
      ]),
    );
  });

  it("triggers allowlisted schedules idempotently", async () => {
    const requestId = randomUUID();

    const first = await triggerAdminSchedule(jobSchedules[0].id, requestId);
    const duplicate = await triggerAdminSchedule(jobSchedules[0].id, requestId);

    expect(duplicate).toBe(first);
  });

  it("rejects missing and disabled schedules", async () => {
    await expect(
      triggerAdminSchedule("mirage:missing", randomUUID()),
    ).rejects.toBeInstanceOf(AdminScheduleNotFoundError);

    const schedule = jobSchedules[0] as unknown as {
      id: string;
      manualTrigger: boolean;
    };
    const previous = schedule.manualTrigger;
    schedule.manualTrigger = false;
    try {
      await expect(
        triggerAdminSchedule(schedule.id, randomUUID()),
      ).rejects.toBeInstanceOf(AdminScheduleConflictError);
    } finally {
      schedule.manualTrigger = previous;
    }
  });
});

describe("admin schedules HTTP", () => {
  it.each([
    { actor: "visitor", expected: 404 },
    { actor: "user", expected: 404 },
    { actor: "unverified admin", expected: 403 },
    { actor: "verified admin without 2FA", expected: 403 },
    { actor: "verified admin", expected: 200 },
  ] as const)(
    "enforces schedule API access for $actor",
    async ({ actor, expected }) => {
      const current =
        actor === "visitor"
          ? null
          : await createTestActor({
              role: actor === "user" ? "user" : "admin",
              emailVerified: actor !== "user" && actor !== "unverified admin",
              twoFactorEnabled: actor !== "verified admin without 2FA",
            });
      const response = await app.fetch(
        new Request(`${origin}/api/admin/schedules/trigger`, {
          body: JSON.stringify({
            requestId: randomUUID(),
            scheduleId: jobSchedules[0].id,
          }),
          headers: {
            "content-type": "application/json",
            origin,
            ...(current ? { cookie: current.cookie } : {}),
          },
          method: "POST",
        }),
      );
      expect(response.status).toBe(expected);
    },
  );

  it("requires same-origin requests and validates the trigger body", async () => {
    const admin = await createTestActor({ role: "admin", emailVerified: true });
    const request = (body: unknown, includeOrigin: boolean) =>
      app.fetch(
        new Request(`${origin}/api/admin/schedules/trigger`, {
          body: JSON.stringify(body),
          headers: {
            cookie: admin.cookie,
            "content-type": "application/json",
            ...(includeOrigin ? { origin } : {}),
          },
          method: "POST",
        }),
      );

    expect(
      (
        await request(
          { requestId: randomUUID(), scheduleId: jobSchedules[0].id },
          false,
        )
      ).status,
    ).toBe(403);
    expect(
      (await request({ scheduleId: jobSchedules[0].id }, true)).status,
    ).toBe(400);
  });

  it("returns success and schedule errors with the existing response contract", async () => {
    const admin = await createTestActor({ role: "admin", emailVerified: true });
    const request = (scheduleId: string) =>
      app.fetch(
        new Request(`${origin}/api/admin/schedules/trigger`, {
          body: JSON.stringify({ requestId: randomUUID(), scheduleId }),
          headers: {
            cookie: admin.cookie,
            "content-type": "application/json",
            origin,
          },
          method: "POST",
        }),
      );

    const success = await request(jobSchedules[0].id);
    expect(success.status).toBe(200);
    await expect(success.json()).resolves.toMatchObject({
      jobId: expect.any(String),
      status: true,
    });
    expect((await request("mirage:missing")).status).toBe(404);

    const schedule = jobSchedules[0] as unknown as {
      manualTrigger: boolean;
    };
    const previous = schedule.manualTrigger;
    schedule.manualTrigger = false;
    try {
      expect((await request(jobSchedules[0].id)).status).toBe(409);
    } finally {
      schedule.manualTrigger = previous;
    }
  });

  it.each([
    ["detail", "GET"],
    ["retry", "POST"],
    ["remove", "POST"],
    ["schedules/trigger", "POST"],
  ] as const)(
    "does not register the old %s job endpoint",
    async (operation, method) => {
      const admin = await createTestActor({
        role: "admin",
        emailVerified: true,
      });
      const response = await app.fetch(
        new Request(`${origin}/api/admin/jobs/${operation}`, {
          headers: { cookie: admin.cookie },
          method,
        }),
      );
      expect(response.status).toBe(404);
    },
  );
});
