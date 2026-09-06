export type DateValue = Date | string | null | undefined;

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

const EMAIL_CHANGE_PREFIX = "account-email-change";
const EMAIL_CHANGE_APPROVAL_PREFIX = "account-email-change-approval";

export function toDate(value: DateValue) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value: DateValue, fallback = "Not set") {
  const date = toDate(value);

  return date ? dateTimeFormatter.format(date) : fallback;
}

export function isFutureDate(value: DateValue, now: Date) {
  const date = toDate(value);

  return Boolean(date && date > now);
}

export function formatProviderName(providerId: string) {
  if (providerId === "credential") {
    return "Email and password";
  }

  return providerId
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function formatValue(value: string | null | undefined, fallback = "-") {
  return value?.trim() ? value : fallback;
}

export function getVerificationLabel(
  identifier: string,
  userId: string,
  email: string,
) {
  if (identifier === email) {
    return "Email verification";
  }

  if (identifier.startsWith(`${EMAIL_CHANGE_PREFIX}:${userId}:`)) {
    return "Email change confirmation";
  }

  if (identifier.startsWith(`${EMAIL_CHANGE_APPROVAL_PREFIX}:${userId}:`)) {
    return "Email change approval";
  }

  return "Verification";
}

export function maskVerificationIdentifier(
  identifier: string,
  userId: string,
  email: string,
) {
  if (identifier === email) {
    return email;
  }

  const prefixes = [
    `${EMAIL_CHANGE_PREFIX}:${userId}:`,
    `${EMAIL_CHANGE_APPROVAL_PREFIX}:${userId}:`,
  ];

  const prefix = prefixes.find((value) => identifier.startsWith(value));

  if (prefix) {
    return `${prefix}[token]`;
  }

  return identifier.length > 72
    ? `${identifier.slice(0, 48)}...${identifier.slice(-12)}`
    : identifier;
}
