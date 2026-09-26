"use client";

import type { AnalyticsAttribution } from "@/adapters/analytics/events";

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

    if (!value) {
      return {};
    }

    return removeEmptyValues(JSON.parse(value) as AnalyticsAttribution);
  } catch {
    return {};
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

  const current = currentPageAttribution();
  const stored = readStoredAttribution();
  const nextAttribution = removeEmptyValues({
    ...current,
    ...stored,
    landingPath: stored.landingPath ?? current.landingPath,
    referrerDomain: stored.referrerDomain ?? current.referrerDomain,
  });

  writeStoredAttribution(nextAttribution);

  return nextAttribution;
}

export function getAnalyticsAttribution() {
  if (typeof window === "undefined") {
    return {};
  }

  const attribution = captureAnalyticsAttribution();

  return Object.keys(attribution).length > 0 ? attribution : undefined;
}
