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
  const [{ createWorkerId }, { logJobEvent }, { startJobWorkerRuntime }] =
    await Promise.all([
      import("@/server/jobs/health"),
      import("@/server/jobs/observability"),
      import("@/server/jobs/runtime"),
    ]);
  const workerId = createWorkerId();
  const runtime = await startJobWorkerRuntime(workerId);
  let shuttingDown = false;

  async function shutdown(signal: string) {
    if (shuttingDown) return;
    shuttingDown = true;
    const deadline = setTimeout(() => process.exit(1), 30_000);
    deadline.unref();
    try {
      await runtime.close(signal);
      clearTimeout(deadline);
      process.exit(0);
    } catch (error) {
      logJobEvent("error", "worker_shutdown_failed", {
        errorKind: error instanceof Error ? error.name : "UnknownError",
        workerId,
      });
      process.exit(1);
    }
  }

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
}

void main().catch((error) => {
  console.error(
    JSON.stringify({
      errorKind: error instanceof Error ? error.name : "UnknownError",
      event: "worker_startup_failed",
    }),
  );
  process.exit(1);
});
