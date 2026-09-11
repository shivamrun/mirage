import { isUploadKey } from "./keys";

function getUploadPublicUrl(key: string, baseUrl: string) {
  const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;

  return new URL(key, normalizedBaseUrl).toString();
}

function resolveUploadPublicUrl(value?: null | string, baseUrl?: string) {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    return null;
  }

  if (!baseUrl || !isUploadKey(normalizedValue)) {
    return null;
  }

  return getUploadPublicUrl(normalizedValue, baseUrl);
}

export { getUploadPublicUrl, resolveUploadPublicUrl };
