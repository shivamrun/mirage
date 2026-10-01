import "server-only";

import { createUploader } from "@marinedotsh/upload-sdk";

import { createUploadAssets } from "./assets";
import { createStorageProfiles } from "./storage";

function createUploadSigner(userId?: string) {
  const storageProfiles = createStorageProfiles();
  const assets = createUploadAssets(storageProfiles, userId);

  return createUploader({
    assets,
    defaultStorageProfile: "s3",
    storageProfiles,
  });
}

export { createUploadSigner };
