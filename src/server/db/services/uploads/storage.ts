import "server-only";

import { defineStorageProfiles } from "@marinedotsh/upload-sdk";
import { awsS3 } from "@marinedotsh/upload-sdk/providers";

import { getUploadEnv } from "./env";

function createStorageProfiles() {
  const uploadEnv = getUploadEnv();

  return defineStorageProfiles({
    s3: awsS3({
      bucket: uploadEnv.bucket,
      region: uploadEnv.region,
      credentials: {
        accessKeyId: uploadEnv.accessKeyId,
        secretAccessKey: uploadEnv.secretAccessKey,
        sessionToken: uploadEnv.sessionToken,
      },
    }),
  });
}

export { createStorageProfiles };
