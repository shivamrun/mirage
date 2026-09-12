import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import postgres from "postgres";

const defaultTestDatabaseUrl =
  "postgres://postgres:postgres@127.0.0.1:5433/mirage_test";
const originalDatabaseUrl = process.env.DATABASE_URL;
const envFileNames = [
  ".env",
  ".env.local",
  ".env.development",
  ".env.development.local",
  ".env.test",
  ".env.test.local",
  ".env.production",
  ".env.production.local",
];

function databaseUrlsFromEnvFiles(directory: string) {
  return envFileNames.flatMap((name) => {
    const path = join(directory, name);
    if (!existsSync(path)) return [];

    const assignment = readFileSync(path, "utf8")
      .split(/\r?\n/)
      .find((line) => /^\s*(?:export\s+)?DATABASE_URL\s*=/.test(line));
    if (!assignment) return [];

    const value = assignment
      .replace(/^\s*(?:export\s+)?DATABASE_URL\s*=/, "")
      .trim();
    const quote = value[0];
    const closingQuote =
      quote === '"' || quote === "'" ? value.indexOf(quote, 1) : -1;
    const suffix = closingQuote < 0 ? "" : value.slice(closingQuote + 1).trim();
    const url =
      closingQuote >= 0
        ? value.slice(1, closingQuote)
        : quote === '"' || quote === "'"
          ? null
          : value.split(/\s+#/)[0]?.trim();

    // Unknown syntax must not make a development database look safe to truncate.
    if (!url || url.includes("$") || (suffix && !suffix.startsWith("#"))) {
      throw new Error(`Cannot verify DATABASE_URL in ${name}.`);
    }
    return [url];
  });
}

function databaseTarget(url: string) {
  const parsed = new URL(url);
  const host = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(
    parsed.hostname,
  )
    ? "loopback"
    : parsed.hostname;
  return `${host}:${parsed.port || "5432"}/${decodeURIComponent(parsed.pathname)}`;
}

export function getSafeTestDatabaseUrl(envDirectory = process.cwd()) {
  const url = process.env.TEST_DATABASE_URL ?? defaultTestDatabaseUrl;
  const parsed = new URL(url);
  const databaseName = decodeURIComponent(parsed.pathname.slice(1));
  const developmentDatabaseUrls = [
    originalDatabaseUrl,
    ...databaseUrlsFromEnvFiles(envDirectory),
  ].filter(Boolean);

  if (
    process.env.NODE_ENV !== "test" ||
    !["localhost", "127.0.0.1", "::1", "[::1]"].includes(parsed.hostname) ||
    !databaseName.endsWith("_test") ||
    (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") ||
    developmentDatabaseUrls.some(
      (value) => value && databaseTarget(value) === databaseTarget(url),
    )
  ) {
    throw new Error(
      "Refusing test database access: use a local *_test Postgres database distinct from DATABASE_URL and local env files.",
    );
  }

  return { databaseName, url };
}

export async function openTestDatabase() {
  const { databaseName, url } = getSafeTestDatabaseUrl();
  const client = postgres(url, { max: 1, prepare: false });
  try {
    const rows = await client<
      { name: string }[]
    >`select current_database() as name`;
    if (rows[0]?.name !== databaseName) {
      throw new Error("Connected database does not match TEST_DATABASE_URL.");
    }
  } catch (error) {
    await client.end();
    throw error;
  }
  return client;
}
