import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { defineConfig } from "drizzle-kit";

function unquoteDrizzleEnvValue(value: string) {
  const trimmed = value.trim();

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function getDrizzleDatabaseUrlFromEnvFile() {
  const envPath = join(process.cwd(), ".env");

  if (!existsSync(envPath)) {
    return null;
  }

  const line = readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .find((entry) => entry.trim().startsWith("DATABASE_URL="));

  if (!line) {
    return null;
  }

  return unquoteDrizzleEnvValue(line.slice("DATABASE_URL=".length));
}

const databaseUrl =
  getDrizzleDatabaseUrlFromEnvFile() ?? process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("Missing environment variable: DATABASE_URL");
}

export default defineConfig({
  schema: "./src/server/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
