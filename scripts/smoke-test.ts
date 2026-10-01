import { treaty } from "@elysia/eden";
import type { App } from "@/server/routes";

const baseUrl = process.env.SMOKE_TEST_BASE_URL ?? "http://localhost:3000";
const api = treaty<App>(baseUrl);

async function main() {
  const { data: healthBody, error, response } = await api.api.health.get();

  if (error) {
    throw new Error(`/api/health returned ${response.status}`);
  }

  if (healthBody?.ok !== true || healthBody.checks?.database !== "ok") {
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
