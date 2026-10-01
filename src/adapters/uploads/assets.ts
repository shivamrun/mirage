import "server-only";

import { defineAssets } from "@marinedotsh/upload-sdk";

import {
  avatarExtensions,
  avatarServerMaxFileSize,
  avatarServerMimeTypes,
} from "@/features/uploads/policies/avatar";

import type { createStorageProfiles } from "./storage";

function createUploadAssets(
  storageProfiles: ReturnType<typeof createStorageProfiles>,
  userId?: string,
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
      keyPrefix: userId ? `avatars/${userId}` : "avatars",
      limits: {
        maxFileSize: avatarServerMaxFileSize,
      },
      storageProfile: "s3",
    },
  });
}

export { createUploadAssets };
