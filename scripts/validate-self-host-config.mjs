import process from "node:process";

const envFile = process.env.MIRAGE_ENV_FILE ?? ".env.self-host";

try {
  process.loadEnvFile(envFile);
} catch (error) {
  console.error(`Unable to load self-host environment file: ${envFile}`);
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

const enabledValues = new Set(["1", "true", "yes", "on"]);
const analyticsEnabled = enabledValues.has(
  process.env.NEXT_PUBLIC_UMAMI_ENABLED?.trim().toLowerCase() ?? "",
);

if (analyticsEnabled) {
  const scriptUrl = process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL;
  let validScriptUrl = false;

  if (scriptUrl) {
    try {
      const parsedUrl = new URL(scriptUrl);
      validScriptUrl =
        ["http:", "https:"].includes(parsedUrl.protocol) &&
        !parsedUrl.hostname.endsWith(".invalid");
    } catch {
      validScriptUrl = false;
    }
  }

  if (!validScriptUrl) {
    console.error(
      "NEXT_PUBLIC_UMAMI_SCRIPT_URL must be set to a real HTTP(S) URL when analytics is enabled",
    );
    process.exit(1);
  }
}
