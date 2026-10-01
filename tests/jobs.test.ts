import { randomUUID } from "node:crypto";
import { Worker } from "bullmq";
import { afterEach, describe, expect, it } from "vitest";

import {
  createJobWorkerConnection,
  jobsRedisPrefix,
  resolveJobsRedisUrl,
} from "@/adapters/jobs/connection";
import { closeJobQueues, getJobQueue } from "@/adapters/jobs/queues";
import db from "@/server/db";
import {
  creditPeriodGrants,
  emailDeliveries,
  subscription,
  user,
} from "@/server/db/schema";
import { setBillingStripeClientForTests } from "@/server/db/services/billing/stripe-client";
import { notify } from "@/server/db/services/notifications/service";
import {
  enqueueJob,
  scheduleJob,
  setJobEnqueueHandlerForTests,
} from "@/server/jobs/enqueue";
import { jobHandlers } from "@/server/jobs/handlers";
import { checkWorkerHealth, startWorkerHeartbeat } from "@/server/jobs/health";
import { processJob } from "@/server/jobs/processor";
import { jobDefinitions, jobQueueNames } from "@/server/jobs/registry";
import { startJobWorkerRuntime } from "@/server/jobs/runtime";
import { syncJobSchedules } from "@/server/jobs/schedule-manager";
import { JOB_SCHEDULER_ID_PREFIX, jobSchedules } from "@/server/jobs/schedules";
import { testEmailOutbox } from "./infra/email-fake";

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

describe("durable jobs", () => {
  it("allows shared Redis fallback outside production only", () => {
    expect(
      resolveJobsRedisUrl({
        nodeEnv: "development",
        redisUrl: "redis://shared",
      }),
    ).toBe("redis://shared");
    expect(
      resolveJobsRedisUrl({
        nodeEnv: "production",
        redisUrl: "redis://shared",
      }),
    ).toBeUndefined();
    expect(
      resolveJobsRedisUrl({
        jobsRedisUrl: "redis://jobs",
        nodeEnv: "production",
        redisUrl: "redis://shared",
      }),
    ).toBe("redis://jobs");
  });

  it("keeps enqueued work pending until a worker is running", async () => {
    setJobEnqueueHandlerForTests(null);

    const job = await enqueueJob(
      "billing.stripe-event.process.v1",
      {
        eventId: "evt_jobs_pending_test",
        eventType: "checkout.session.completed",
        objectId: "cs_jobs_pending_test",
      },
      { jobId: "stripe-evt_jobs_pending_test" },
    );

    if (!job.id) throw new Error("Enqueued job did not receive an ID.");
    const queuedJob = await getJobQueue(jobQueueNames.billing).getJob(job.id);
    if (!queuedJob) throw new Error("Enqueued job was not found.");
    expect(await queuedJob.getState()).toBe("prioritized");
  });

  it("validates, enqueues, and processes a typed job with a deterministic id", async () => {
    setJobEnqueueHandlerForTests(null);
    const processed = new Promise<string | undefined>((resolve, reject) => {
      const worker = new Worker(jobQueueNames.billing, async (job) => job.id, {
        connection: createJobWorkerConnection(),
        prefix: jobsRedisPrefix(),
      });
      worker.once("completed", async (job) => {
        resolve(job.id);
        await worker.close();
      });
      worker.once("error", reject);
    });

    const first = await enqueueJob(
      "billing.stripe-event.process.v1",
      {
        eventId: "evt_jobs_test",
        eventType: "checkout.session.completed",
        objectId: "cs_jobs_test",
      },
      { jobId: "stripe-evt_jobs_test" },
    );
    const duplicate = await enqueueJob(
      "billing.stripe-event.process.v1",
      {
        eventId: "evt_jobs_test",
        eventType: "checkout.session.completed",
        objectId: "cs_jobs_test",
      },
      { jobId: "stripe-evt_jobs_test" },
    );

    expect(first.id).toBe("stripe-evt_jobs_test");
    expect(duplicate.id).toBe("stripe-evt_jobs_test");
    await expect(processed).resolves.toBe("stripe-evt_jobs_test");
  });

  it("rejects invalid payloads before reaching Redis", async () => {
    setJobEnqueueHandlerForTests(null);
    await expect(
      enqueueJob("billing.stripe-event.process.v1", {
        eventId: "",
        eventType: "checkout.session.completed",
        objectId: "cs_jobs_test",
      }),
    ).rejects.toThrow();
  });

  it("has a typed handler for every registered job", () => {
    expect(Object.keys(jobHandlers).sort()).toEqual(
      Object.keys(jobDefinitions).sort(),
    );
  });

  it("treats unknown jobs and invalid worker payloads as unrecoverable", async () => {
    await expect(processJob("unknown.v1", {})).rejects.toMatchObject({
      name: "UnrecoverableError",
    });
    await expect(
      processJob("billing.subscription.reconcile.v1", {
        subscriptionId: "",
      }),
    ).rejects.toMatchObject({ name: "UnrecoverableError" });
  });

  it("schedules future work and immediately queues past work", async () => {
    setJobEnqueueHandlerForTests(null);
    const future = await scheduleJob(
      "system.pending-work.recover.v1",
      {},
      {
        jobId: "future-recovery",
        runAt: new Date(Date.now() + 60_000),
      },
    );
    const past = await scheduleJob(
      "system.pending-work.recover.v1",
      {},
      { jobId: "past-recovery", runAt: new Date(Date.now() - 1_000) },
    );
    const duplicate = await scheduleJob(
      "system.pending-work.recover.v1",
      {},
      {
        jobId: "future-recovery",
        runAt: new Date(Date.now() + 120_000),
      },
    );

    const queue = getJobQueue(jobQueueNames.default);
    const futureJob = await queue.getJob(future.id ?? "");
    const pastJob = await queue.getJob(past.id ?? "");
    expect(await futureJob?.getState()).toBe("delayed");
    expect(["prioritized", "waiting"]).toContain(await pastJob?.getState());
    expect(duplicate.id).toBe(future.id);
  });

  it("idempotently registers schedules across concurrent instances", async () => {
    await Promise.all([syncJobSchedules(), syncJobSchedules()]);

    const registered = (
      await Promise.all(
        Object.values(jobQueueNames).map((queueName) =>
          getJobQueue(queueName).getJobSchedulers(0, -1, true),
        ),
      )
    ).flat();
    expect(registered.map((scheduler) => scheduler.key).sort()).toEqual(
      jobSchedules.map((schedule) => schedule.id).sort(),
    );
  });

  it("prunes only obsolete Mirage-owned schedules", async () => {
    const queue = getJobQueue(jobQueueNames.default);
    await queue.upsertJobScheduler(`${JOB_SCHEDULER_ID_PREFIX}obsolete:v1`, {
      every: 60_000,
    });
    await queue.upsertJobScheduler("external:keep", { every: 60_000 });

    const result = await syncJobSchedules({ prune: true });
    expect(result.removed).toContain("mirage:obsolete:v1");
    expect(await queue.getJobScheduler("mirage:obsolete:v1")).toBeUndefined();
    expect(await queue.getJobScheduler("external:keep")).toBeDefined();
  });

  it("removes a desired scheduler from the wrong queue", async () => {
    const scheduler = jobSchedules.find(
      ({ name }) => name === "billing.subscription-reconciliation.scan.v1",
    );
    if (!scheduler) throw new Error("Billing schedule was not found.");
    const wrongQueue = getJobQueue(jobQueueNames.default);
    await wrongQueue.upsertJobScheduler(scheduler.id, scheduler.repeat, {
      data: scheduler.payload,
      name: scheduler.name,
    });

    await syncJobSchedules({ prune: true });

    expect(await wrongQueue.getJobScheduler(scheduler.id)).toBeUndefined();
    expect(
      await getJobQueue(jobQueueNames.billing).getJobScheduler(scheduler.id),
    ).toBeDefined();
  });

  it("publishes and removes a worker heartbeat", async () => {
    const workerId = `test-worker-${randomUUID()}`;
    const heartbeat = await startWorkerHeartbeat(workerId);
    expect((await checkWorkerHealth()).heartbeats).toEqual(
      expect.arrayContaining([expect.objectContaining({ workerId })]),
    );

    await heartbeat.stop();
    expect((await checkWorkerHealth()).heartbeats).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ workerId })]),
    );
  });

  it("removes its heartbeat during graceful runtime shutdown", async () => {
    const workerId = `runtime-worker-${randomUUID()}`;
    const runtime = await startJobWorkerRuntime(workerId);
    expect((await checkWorkerHealth()).heartbeats).toEqual(
      expect.arrayContaining([expect.objectContaining({ workerId })]),
    );

    await runtime.close("TEST");

    expect((await checkWorkerHealth()).heartbeats).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ workerId })]),
    );
  });

  it("fans billing reconciliation out in bounded pages", async () => {
    await db.insert(subscription).values(
      Array.from({ length: 101 }, (_, index) => ({
        id: `subscription-${index.toString().padStart(3, "0")}`,
        plan: "pro",
        referenceId: `user-${index}`,
        stripeSubscriptionId: `sub_${index}`,
      })),
    );
    const enqueued: Array<{ name: string; payload: unknown }> = [];
    setJobEnqueueHandlerForTests(async (name, payload, options) => {
      enqueued.push({ name, payload });
      return { id: options.jobId };
    });

    await processJob("billing.subscription-reconciliation.scan.v1", {});

    expect(
      enqueued.filter(
        ({ name }) => name === "billing.subscription.reconcile.v1",
      ),
    ).toHaveLength(100);
    expect(enqueued.at(-1)).toMatchObject({
      name: "billing.subscription-reconciliation.scan.v1",
      payload: {
        cursor: "subscription-099",
        runId: new Date().toISOString().slice(0, 10),
      },
    });
  });

  it("syncs but does not grant credits to an ineligible subscription", async () => {
    const userId = `user-${randomUUID()}`;
    const subscriptionId = `subscription-${randomUUID()}`;
    const periodStart = Math.floor(Date.now() / 1_000) - 60;
    const periodEnd = periodStart + 30 * 24 * 60 * 60;
    await db.insert(user).values({
      email: `${userId}@example.com`,
      id: userId,
      name: "Ineligible Subscriber",
    });
    await db.insert(subscription).values({
      id: subscriptionId,
      plan: "pro",
      referenceId: userId,
      status: "incomplete",
      stripeSubscriptionId: `sub_${subscriptionId}`,
    });
    setBillingStripeClientForTests({
      subscriptions: {
        retrieve: async () => ({
          cancel_at: null,
          cancel_at_period_end: false,
          canceled_at: null,
          ended_at: null,
          id: `sub_${subscriptionId}`,
          items: {
            data: [
              {
                current_period_end: periodEnd,
                current_period_start: periodStart,
                price: {
                  lookup_key: "mirage_pro_2_monthly",
                  recurring: { interval: "month" },
                },
                quantity: 1,
              },
            ],
          },
          schedule: null,
          status: "incomplete",
        }),
      },
    } as never);

    await processJob("billing.subscription.reconcile.v1", { subscriptionId });

    expect(await db.select().from(creditPeriodGrants)).toHaveLength(0);
  });

  it("persists and idempotently processes durable email delivery", async () => {
    const input = {
      data: { email: "durable-email@example.com", name: null },
      idempotencyKey: "auth:welcome:durable-email",
      type: "auth.welcome" as const,
    };

    await notify(input);
    await notify(input);

    const deliveries = await db.select().from(emailDeliveries);
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0]).toMatchObject({
      attemptCount: 1,
      idempotencyKey: input.idempotencyKey,
      status: "sent",
    });
    expect(testEmailOutbox).toHaveLength(1);
  });
});
