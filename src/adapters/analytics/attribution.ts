"use client";

import {
  type AnalyticsAttribution,
  signupAttributionCookie,
} from "@/adapters/analytics/events";
import { analyticsAttributionSchema } from "@/shared/schemas/analytics";

const attributionStorageKey = "mirage.analytics.attribution";
const attributionValueMaxLength = 120;
const allowedCreatorPattern = /^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$/;

function truncateValue(value: string | null | undefined) {
  const normalizedValue = value?.trim();

  return normalizedValue
    ? normalizedValue.slice(0, attributionValueMaxLength)
    : undefined;
}

function readSearchParam(params: URLSearchParams, key: string) {
  return truncateValue(params.get(key));
}

function safeReferrerDomain(value: string) {
  try {
    return truncateValue(new URL(value).hostname.toLowerCase());
  } catch {
    return undefined;
  }
}

function safeCreator(value: string | undefined) {
  if (!value || !allowedCreatorPattern.test(value)) {
    return undefined;
  }

  return truncateValue(value);
}

function removeEmptyValues(attribution: AnalyticsAttribution) {
  return Object.fromEntries(
    Object.entries(attribution).filter(([, value]) => Boolean(value)),
  ) as AnalyticsAttribution;
}

function readStoredAttribution() {
  try {
    const value = window.sessionStorage.getItem(attributionStorageKey);

    if (!value) return undefined;
    const parsed = analyticsAttributionSchema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

function writeStoredAttribution(attribution: AnalyticsAttribution) {
  try {
    window.sessionStorage.setItem(
      attributionStorageKey,
      JSON.stringify(removeEmptyValues(attribution)),
    );
  } catch {
    // Storage can be blocked. Attribution should never break the app.
  }
}

function currentPageAttribution() {
  if (typeof window === "undefined") {
    return {};
  }

  const params = new URLSearchParams(window.location.search);
  const creator = safeCreator(readSearchParam(params, "creator"));
  const utmContent = readSearchParam(params, "utm_content");

  return removeEmptyValues({
    creator,
    landingPath: truncateValue(window.location.pathname),
    referrerDomain: document.referrer
      ? safeReferrerDomain(document.referrer)
      : undefined,
    utmCampaign: readSearchParam(params, "utm_campaign"),
    utmContent,
    utmMedium: readSearchParam(params, "utm_medium"),
    utmSource: readSearchParam(params, "utm_source"),
    utmTerm: readSearchParam(params, "utm_term"),
  });
}

export function captureAnalyticsAttribution() {
  if (typeof window === "undefined") {
    return {};
  }

  const stored = readStoredAttribution();
  if (stored && Object.keys(stored).length > 0) return stored;

  const attribution = currentPageAttribution();
  writeStoredAttribution(attribution);
  return attribution;
}

export function getAnalyticsAttribution() {
  if (typeof window === "undefined") {
    return {};
  }

  const attribution = captureAnalyticsAttribution();

  return Object.keys(attribution).length > 0 ? attribution : undefined;
}

export function saveSignupAttribution() {
  try {
    const attribution = getAnalyticsAttribution();
    if (!attribution) return;

    const value = encodeURIComponent(JSON.stringify(attribution));
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    // biome-ignore lint/suspicious/noDocumentCookie: The auth request needs the cookie to be available synchronously across browsers.
    document.cookie = `${signupAttributionCookie}=${value}; Path=/api/auth; Max-Age=600; SameSite=Lax${secure}`;
  } catch {
    // Continue with signup when browser storage is unavailable.
  }
}
