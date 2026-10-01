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

if (!process.env.NODE_ENV)
  Object.assign(process.env, { NODE_ENV: "development" });

async function main() {
  const [{ closeJobQueues }, { syncJobSchedules }] = await Promise.all([
    import("@/adapters/jobs/queues"),
    import("@/server/jobs/schedule-manager"),
  ]);
  try {
    const result = await syncJobSchedules({
      prune: process.argv.includes("--prune"),
    });
    console.info(JSON.stringify({ event: "job_schedules_synced", ...result }));
  } finally {
    await closeJobQueues();
  }
}

void main().catch((error) => {
  console.error(
    JSON.stringify({
      errorKind: error instanceof Error ? error.name : "UnknownError",
      event: "job_schedule_sync_failed",
    }),
  );
  process.exitCode = 1;
});
