const uploadAssetKeys = ["avatar"] as const;

type UploadAssetKey = (typeof uploadAssetKeys)[number];

export { type UploadAssetKey, uploadAssetKeys };
