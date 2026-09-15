import { uploadFile } from "@marinedotsh/upload-sdk";

import { api } from "@/lib/api/client";
import {
  avatarAcceptedMimeTypes,
  avatarCropMaxFileSize,
  avatarCropOutputType,
  avatarSourceMaxFileSize,
} from "@/lib/uploads/policies/avatar";
import type { PrepareUploadResponse } from "@/zod/uploads";

type PrepareAvatarUploadResponse = PrepareUploadResponse;

type UploadAvatarFileOptions = {
  onProgress?: (progress: { percent?: number }) => void;
};

async function prepareAvatarUpload(file: File) {
  const { data, error } = await api.api.uploads.post({
    contentType: file.type,
    filename: file.name,
    key: "avatar",
    size: file.size,
  });

  if (error) {
    throw new Error(
      error.value.message || "Could not prepare the avatar upload.",
    );
  }

  if (!data) {
    throw new Error("Could not prepare the avatar upload.");
  }

  return data;
}

async function uploadAvatarFile(
  file: File,
  { onProgress }: UploadAvatarFileOptions = {},
) {
  const prepared = await prepareAvatarUpload(file);

  await uploadFile(prepared.upload, file, {
    onProgress,
  });

  return prepared;
}

function getCroppedAvatarFilename(filename: string) {
  const basename = filename.replace(/\.[^.]+$/, "");

  return `${basename || "avatar"}-cropped.jpg`;
}

export {
  avatarAcceptedMimeTypes,
  avatarCropMaxFileSize,
  avatarCropOutputType,
  avatarSourceMaxFileSize,
  getCroppedAvatarFilename,
  prepareAvatarUpload,
  type PrepareAvatarUploadResponse,
  uploadAvatarFile,
};
