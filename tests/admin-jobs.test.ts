import { randomUUID } from "node:crypto";

import { Worker } from "bullmq";
import { Elysia } from "elysia";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createJobWorkerConnection,
  jobsRedisPrefix,
} from "@/adapters/jobs/connection";
import { closeJobQueues, getJobQueue } from "@/adapters/jobs/queues";
import {
  adminJobsPageHref,
  parseAdminJobsSearchParams,
} from "@/features/admin/components/jobs/query";
import { apiErrors } from "@/server/http/errors";
import {
  AdminJobConflictError,
  getAdminJobDetail,
  listAdminJobs,
  listAdminSchedules,
  removeAdminJob,
  retryAdminJob,
  triggerAdminSchedule,
} from "@/server/jobs/admin";
import {
  enqueueJob,
  setJobEnqueueHandlerForTests,
} from "@/server/jobs/enqueue";
import { jobQueueNames } from "@/server/jobs/registry";
import { syncJobSchedules } from "@/server/jobs/schedule-manager";
import { jobSchedules } from "@/server/jobs/schedules";
import { adminRoutes } from "@/server/routes/admin";
import { createTestActor } from "./infra/admin-actor";

const origin = "http://localhost:3000";
const app = new Elysia({ prefix: "/api" }).use(apiErrors).use(adminRoutes);

beforeEach(() => {
  setJobEnqueueHandlerForTests(null);
});

afterEach(async () => {
  setJobEnqueueHandlerForTests(null);
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

describe("admin jobs operations", () => {
  it("lists retained jobs with composed filters and redacts details", async () => {
    const secretId = `sub_secret_${randomUUID()}`;
    const job = await enqueueJob(
      "billing.subscription.reconcile.v1",
      { subscriptionId: secretId },
      { jobId: `admin-list-${randomUUID()}` },
    );
    if (!job.id) throw new Error("Job did not receive an ID.");

    const page = await listAdminJobs({
      limit: 10,
      name: "billing.subscription.reconcile.v1",
      page: 1,
      queue: "billing",
      status: "waiting",
    });

    expect(page.items).toEqual([
      expect.objectContaining({
        id: job.id,
        queue: "billing",
        status: "waiting",
      }),
    ]);
    expect(page.pagination.total).toBe(1);

    const detail = await getAdminJobDetail("billing", job.id);
    const serialized = JSON.stringify(detail);
    expect(detail.payload.redacted).toBe(true);
    expect(detail.payload.fields.subscriptionId).not.toBe(secretId);
    expect(serialized).not.toContain(secretId);
    expect(serialized).not.toContain("stacktrace");
    expect(serialized).not.toContain("returnvalue");
  });

  it("removes pending jobs but rejects active jobs", async () => {
    const pending = await enqueueJob(
      "system.pending-work.recover.v1",
      {},
      { jobId: `admin-remove-${randomUUID()}` },
    );
    if (!pending.id) throw new Error("Job did not receive an ID.");
    await removeAdminJob("default", pending.id);
    expect(await getJobQueue("default").getJob(pending.id)).toBeUndefined();

    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const worker = new Worker("default", () => held, {
      connection: createJobWorkerConnection(),
      prefix: jobsRedisPrefix(),
    });
    const active = await enqueueJob(
      "system.pending-work.recover.v1",
      {},
      { jobId: `admin-active-${randomUUID()}` },
    );
    if (!active.id) throw new Error("Job did not receive an ID.");
    await new Promise<void>((resolve, reject) => {
      worker.on("active", (job) => {
        if (job.id === active.id) resolve();
      });
      worker.on("error", reject);
    });
    await expect(removeAdminJob("default", active.id)).rejects.toBeInstanceOf(
      AdminJobConflictError,
    );
    release();
    await worker.close();
  });

  it("retries only failed jobs", async () => {
    const worker = new Worker(
      "default",
      async () => {
        throw new Error("secret provider response");
      },
      {
        connection: createJobWorkerConnection(),
        prefix: jobsRedisPrefix(),
      },
    );
    const job = await getJobQueue("default").add(
      "system.pending-work.recover.v1",
      {},
      { attempts: 1 },
    );
    if (!job.id) throw new Error("Job did not receive an ID.");
    await new Promise<void>((resolve, reject) => {
      worker.on("failed", (failed) => {
        if (failed?.id === job.id) resolve();
      });
      worker.on("error", reject);
    });
    await worker.close();

    const detail = await getAdminJobDetail("default", job.id);
    expect(detail.failureReason).toBe(
      "Processing failed; details withheld. Check server logs.",
    );
    expect(JSON.stringify(detail)).not.toContain("secret provider response");

    const retried = await retryAdminJob("default", job.id);
    expect(retried.status).toBe("waiting");
    await expect(retryAdminJob("default", job.id)).rejects.toBeInstanceOf(
      AdminJobConflictError,
    );
  });

  it("reports schedules and triggers allowlisted definitions idempotently", async () => {
    await syncJobSchedules();
    const schedules = await listAdminSchedules();
    expect(schedules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          enabled: true,
          id: jobSchedules[0].id,
          manualTrigger: true,
          nextRunAt: expect.any(String),
        }),
      ]),
    );

    const requestId = randomUUID();
    const first = await triggerAdminSchedule(jobSchedules[0].id, requestId);
    const duplicate = await triggerAdminSchedule(jobSchedules[0].id, requestId);
    expect(duplicate).toBe(first);
  });
});

describe("admin jobs HTTP and query behavior", () => {
  it("parses allowlisted filters and creates canonical page links", () => {
    expect(
      parseAdminJobsSearchParams({
        name: "billing.subscription.reconcile.v1",
        page: "3",
        queue: "billing",
        status: "failed",
      }),
    ).toEqual({
      name: "billing.subscription.reconcile.v1",
      page: 3,
      queue: "billing",
      status: "failed",
    });
    expect(
      parseAdminJobsSearchParams({
        name: "unknown",
        page: "invalid",
        queue: "unknown",
        status: "unknown",
      }),
    ).toEqual({
      name: undefined,
      page: 1,
      queue: undefined,
      status: undefined,
    });
    expect(
      adminJobsPageHref({ page: 2, queue: "default", status: "waiting" }),
    ).toBe("/admin/jobs?queue=default&status=waiting&page=2");
  });

  it.each([
    { actor: "visitor", expected: 404 },
    { actor: "user", expected: 404 },
    { actor: "unverified admin", expected: 403 },
    { actor: "verified admin without 2FA", expected: 403 },
    { actor: "verified admin", expected: 404 },
  ] as const)(
    "enforces job API access for $actor",
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
        new Request(
          `${origin}/api/admin/jobs/detail?queue=default&jobId=missing`,
          { headers: current ? { cookie: current.cookie } : undefined },
        ),
      );
      expect(response.status).toBe(expected);
    },
  );

  it("requires same-origin requests for job mutations", async () => {
    const admin = await createTestActor({ role: "admin", emailVerified: true });
    const request = (includeOrigin: boolean) =>
      app.fetch(
        new Request(`${origin}/api/admin/jobs/remove`, {
          body: JSON.stringify({ jobId: "missing", queue: "default" }),
          headers: {
            cookie: admin.cookie,
            "content-type": "application/json",
            ...(includeOrigin ? { origin } : {}),
          },
          method: "POST",
        }),
      );

    expect((await request(false)).status).toBe(403);
    expect((await request(true)).status).toBe(404);
  });
});
