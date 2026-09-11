import "server-only";

import { defineAssets } from "@marinedotsh/upload-sdk";

import type { createStorageProfiles } from "./storage";

const uploadAssetKeys = ["avatar"] as const;

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

type UploadAssetKey = (typeof uploadAssetKeys)[number];

export {
  avatarExtensions,
  avatarMimeTypes,
  createUploadAssets,
  type UploadAssetKey,
  uploadAssetKeys,
};
