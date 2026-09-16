import { EMAIL_LIST_METADATA_VALUE_MAX_LENGTH } from "@/shared/schemas";

export type BrowserAttribution = {
  landingPath: string | null;
  referrer: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmMedium: string | null;
  utmSource: string | null;
  utmTerm: string | null;
};

function truncateAttributionValue(value: string | null | undefined) {
  const normalized = value?.trim();

  return normalized
    ? normalized.slice(0, EMAIL_LIST_METADATA_VALUE_MAX_LENGTH)
    : null;
}

function readSearchParam(params: URLSearchParams, key: string) {
  return truncateAttributionValue(params.get(key));
}

export function captureBrowserAttribution(): BrowserAttribution {
  if (typeof window === "undefined") {
    return {
      landingPath: null,
      referrer: null,
      utmCampaign: null,
      utmContent: null,
      utmMedium: null,
      utmSource: null,
      utmTerm: null,
    };
  }

  const params = new URLSearchParams(window.location.search);

  return {
    landingPath: truncateAttributionValue(window.location.pathname),
    referrer: truncateAttributionValue(document.referrer),
    utmCampaign: readSearchParam(params, "utm_campaign"),
    utmContent: readSearchParam(params, "utm_content"),
    utmMedium: readSearchParam(params, "utm_medium"),
    utmSource: readSearchParam(params, "utm_source"),
    utmTerm: readSearchParam(params, "utm_term"),
  };
}

export function hasAttribution(values: BrowserAttribution) {
  return Object.values(values).some(Boolean);
}
