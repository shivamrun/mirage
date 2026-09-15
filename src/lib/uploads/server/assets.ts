import "server-only";

import { defineAssets } from "@marinedotsh/upload-sdk";

import { uploadAssetKeys } from "@/lib/uploads/asset-keys";

import type { createStorageProfiles } from "./storage";

const avatarMimeTypes = ["image/png", "image/jpeg", "image/webp"] as const;
const avatarExtensions = [".png", ".jpg", ".jpeg", ".webp"] as const;

function createUploadAssets(
  storageProfiles: ReturnType<typeof createStorageProfiles>,
) {
  return defineAssets(storageProfiles, {
    avatar: {
      accept: {
        extensions: avatarExtensions,
        mimeTypes: avatarMimeTypes,
      },
      expiresIn: {
        value: 5,
        unit: "minutes",
      },
      keyPrefix: "avatars",
      limits: {
        maxFileSize: {
          value: 2,
          unit: "MB",
        },
      },
      storageProfile: "s3",
    },
  });
}

export {
  avatarExtensions,
  avatarMimeTypes,
  createUploadAssets,
  uploadAssetKeys,
};
