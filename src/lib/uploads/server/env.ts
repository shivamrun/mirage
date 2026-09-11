import "server-only";

import { env } from "@/lib/env";

function getUploadEnv() {
  const missing = [
    ["AWS_UPLOAD_ACCESS_KEY_ID", env.AWS_UPLOAD_ACCESS_KEY_ID],
    ["AWS_UPLOAD_BUCKET", env.AWS_UPLOAD_BUCKET],
    ["AWS_UPLOAD_REGION", env.AWS_UPLOAD_REGION],
    ["AWS_UPLOAD_SECRET_ACCESS_KEY", env.AWS_UPLOAD_SECRET_ACCESS_KEY],
    ["NEXT_PUBLIC_UPLOAD_BASE_URL", env.NEXT_PUBLIC_UPLOAD_BASE_URL],
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`Missing upload env: ${missing.join(", ")}`);
  }

  return {
    accessKeyId: env.AWS_UPLOAD_ACCESS_KEY_ID as string,
    bucket: env.AWS_UPLOAD_BUCKET as string,
    publicBaseUrl: env.NEXT_PUBLIC_UPLOAD_BASE_URL as string,
    region: env.AWS_UPLOAD_REGION as string,
    secretAccessKey: env.AWS_UPLOAD_SECRET_ACCESS_KEY as string,
    sessionToken: env.AWS_UPLOAD_SESSION_TOKEN,
  };
}

export { getUploadEnv };
