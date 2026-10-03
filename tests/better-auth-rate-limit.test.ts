import { describe, expect, it } from "vitest";

import { app } from "@/server/routes";
import { createTestActor } from "./infra/admin-actor";

const origin = "http://localhost:3000";
const password = "TestPassword123!";

function signIn(email: string) {
  return app.fetch(
    new Request(`${origin}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin },
      body: JSON.stringify({ email, password }),
    }),
  );
}

describe("Better Auth rate limiting", () => {
  it("uses the database-backed endpoint budget", async () => {
    const actor = await createTestActor();

    const second = await signIn(actor.email);
    const third = await signIn(actor.email);
    const limited = await signIn(actor.email);

    expect(second.status).toBe(200);
    expect(third.status).toBe(200);
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("x-retry-after"))).toBeGreaterThan(0);
  });
});
