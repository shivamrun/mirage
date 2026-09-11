import "server-only";

import {
  getUploadPublicUrl as getUploadPublicUrlFromBase,
  resolveUploadPublicUrl as resolveUploadPublicUrlFromBase,
} from "@/lib/uploads/public-url";

import { getUploadEnv } from "./env";

function getUploadPublicUrl(key: string) {
  return getUploadPublicUrlFromBase(key, getUploadEnv().publicBaseUrl);
}

function resolveUploadPublicUrl(value?: null | string) {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    return null;
  }

  return resolveUploadPublicUrlFromBase(value, getUploadEnv().publicBaseUrl);
}

export { getUploadPublicUrl, resolveUploadPublicUrl };
