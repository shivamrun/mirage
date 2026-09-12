import { type PrepareUploadOutput, uploadFile } from "@marinedotsh/upload-sdk";

import { api } from "@/lib/api/client";

type PrepareAvatarUploadResponse = {
  key: string;
  publicUrl: string;
  upload: PrepareUploadOutput;
};

type UploadAvatarFileOptions = {
  onProgress?: (progress: { percent?: number }) => void;
};

const avatarCropMaxFileSize = 2 * 1024 * 1024;
const avatarSourceMaxFileSize = 10 * 1024 * 1024;
const avatarCropOutputType = "image/jpeg";
const avatarAcceptedMimeTypes = ["image/jpeg", "image/png", "image/webp"];

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
