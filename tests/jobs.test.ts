import { Worker } from "bullmq";
import { afterEach, describe, expect, it } from "vitest";

import {
  createJobWorkerConnection,
  jobsRedisPrefix,
} from "@/adapters/jobs/connection";
import { closeJobQueues, getJobQueue } from "@/adapters/jobs/queues";
import db from "@/server/db";
import { emailDeliveries } from "@/server/db/schema";
import { notify } from "@/server/db/services/notifications/service";
import {
  enqueueJob,
  setJobEnqueueHandlerForTests,
} from "@/server/jobs/enqueue";
import { jobQueueNames } from "@/server/jobs/registry";
import { testEmailOutbox } from "./infra/email-fake";

afterEach(async () => {
  setJobEnqueueHandlerForTests(null);
  const queue = getJobQueue(jobQueueNames.billing);
  await queue.obliterate({ force: true });
  await closeJobQueues();
});

describe("durable jobs", () => {
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
