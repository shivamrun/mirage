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
  const { checkWorkerHealth } = await import("@/server/jobs/health");
  const health = await checkWorkerHealth();
  console.info(JSON.stringify(health));
  if (!health.ok) process.exitCode = 1;
}

void main().catch((error) => {
  console.error(
    JSON.stringify({
      errorKind: error instanceof Error ? error.name : "UnknownError",
      heartbeats: [],
      ok: false,
    }),
  );
  process.exitCode = 1;
});
