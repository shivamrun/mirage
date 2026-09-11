import { type PrepareUploadOutput, uploadFile } from "@marinedotsh/upload-sdk";

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
  const response = await fetch("/api/uploads", {
    body: JSON.stringify({
      contentType: file.type,
      filename: file.name,
      key: "avatar",
      size: file.size,
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  const data = (await response.json().catch(() => null)) as
    | { message?: string }
    | PrepareAvatarUploadResponse
    | null;

  if (!response.ok) {
    throw new Error(
      data && "message" in data && data.message
        ? data.message
        : "Could not prepare the avatar upload.",
    );
  }

  if (!data || !("upload" in data) || !("key" in data)) {
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
