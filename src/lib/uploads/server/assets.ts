import "server-only";

import { defineAssets } from "@marinedotsh/upload-sdk";

import { uploadAssetKeys } from "@/lib/uploads/asset-keys";
import {
  avatarExtensions,
  avatarServerMaxFileSize,
  avatarServerMimeTypes,
} from "@/lib/uploads/policies/avatar";

import type { createStorageProfiles } from "./storage";

function createUploadAssets(
  storageProfiles: ReturnType<typeof createStorageProfiles>,
) {
  return defineAssets(storageProfiles, {
    avatar: {
      accept: {
        extensions: avatarExtensions,
        mimeTypes: avatarServerMimeTypes,
      },
      expiresIn: {
        value: 5,
        unit: "minutes",
      },
      keyPrefix: "avatars",
      limits: {
        maxFileSize: avatarServerMaxFileSize,
      },
      storageProfile: "s3",
    },
  });
}

export {
  avatarExtensions,
  avatarServerMimeTypes as avatarMimeTypes,
  createUploadAssets,
  uploadAssetKeys,
};
