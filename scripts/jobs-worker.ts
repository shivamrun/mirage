try {
  process.loadEnvFile?.();
} catch (error) {
  if (
    !error ||
    typeof error !== "object" ||
    !("code" in error) ||
    error.code !== "ENOENT"
  ) {
    throw error;
  }
}

export {};

if (!process.env.NODE_ENV) {
  Object.assign(process.env, { NODE_ENV: "development" });
}

async function main() {
  const [
    { closeJobQueues },
    { closeDbConnection },
    { recoverPendingStripeWebhookJobs },
    { recoverPendingEmailDeliveries },
    { createJobWorkers },
  ] = await Promise.all([
    import("@/adapters/jobs/queues"),
    import("@/server/db"),
    import("@/server/db/services/billing/stripe-webhook-jobs"),
    import("@/server/db/services/notifications/email-delivery"),
    import("@/server/jobs/worker"),
  ]);

  const workers = createJobWorkers();
  let shuttingDown = false;
  const recoveryIntervalMs = 60_000;

  async function recoverPendingJobs() {
    const results = await Promise.allSettled([
      recoverPendingStripeWebhookJobs(),
      recoverPendingEmailDeliveries(),
    ]);
    for (const result of results) {
      if (result.status === "rejected") {
        console.error(
          JSON.stringify({
            error:
              result.reason instanceof Error
                ? result.reason.name
                : "UnknownError",
            event: "job_recovery_error",
          }),
        );
      }
    }
  }

  void recoverPendingJobs();
  const recoveryTimer = setInterval(
    () => void recoverPendingJobs(),
    recoveryIntervalMs,
  );
  recoveryTimer.unref();

  console.info(
    JSON.stringify({ event: "worker_ready", workers: workers.length }),
  );

  async function shutdown(signal: string) {
    if (shuttingDown) return;
    shuttingDown = true;
    clearInterval(recoveryTimer);
    console.info(JSON.stringify({ event: "worker_shutdown", signal }));

    const deadline = setTimeout(() => process.exit(1), 30_000);
    deadline.unref();
    await Promise.allSettled(workers.map((worker) => worker.close()));
    await closeJobQueues();
    await closeDbConnection();
    clearTimeout(deadline);
    process.exit(0);
  }

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

void main().catch((error) => {
  console.error(
    JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
      event: "worker_startup_failed",
    }),
  );
  process.exit(1);
});
