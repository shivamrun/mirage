const baseUrl = process.env.SMOKE_TEST_BASE_URL ?? "http://localhost:3000";

async function check(path: string) {
  const response = await fetch(new URL(path, baseUrl));

  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}`);
  }

  return response;
}

async function main() {
  const health = await check("/api/health");
  const healthBody = await health.json();

  if (healthBody.ok !== true || healthBody.checks?.database !== "ok") {
    throw new Error("/api/health did not report a healthy database");
  }

  console.info(
    JSON.stringify({
      baseUrl,
      event: "deployment_smoke_test",
      ok: true,
    }),
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      baseUrl,
      event: "deployment_smoke_test",
      error: error instanceof Error ? error.message : String(error),
      ok: false,
    }),
  );
  process.exitCode = 1;
});

export {};
