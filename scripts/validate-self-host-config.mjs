import process from "node:process";

const envFile = process.env.MIRAGE_ENV_FILE ?? ".env.self-host";

try {
  process.loadEnvFile(envFile);
} catch (error) {
  console.error(`Unable to load self-host environment file: ${envFile}`);
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
