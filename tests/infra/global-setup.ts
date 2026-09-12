import { join } from "node:path";

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

import { openTestDatabase } from "./test-database";

export default async function globalSetup() {
  const client = await openTestDatabase();
  try {
    await migrate(drizzle(client), {
      migrationsFolder: join(process.cwd(), "drizzle"),
    });
  } finally {
    await client.end();
  }
}
