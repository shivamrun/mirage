const avatarAcceptedMimeTypes = ["image/jpeg", "image/png", "image/webp"];
const avatarServerMimeTypes = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;
const avatarExtensions = [".png", ".jpg", ".jpeg", ".webp"] as const;

const avatarCropMaxFileSize = 2 * 1024 * 1024;
const avatarSourceMaxFileSize = 10 * 1024 * 1024;
const avatarCropOutputType = "image/jpeg";
const avatarServerMaxFileSize = {
  value: 2,
  unit: "MB",
} as const;

export {
  avatarAcceptedMimeTypes,
  avatarCropMaxFileSize,
  avatarCropOutputType,
  avatarExtensions,
  avatarServerMaxFileSize,
  avatarServerMimeTypes,
  avatarSourceMaxFileSize,
};
