export type DateValue = Date | string | null | undefined;

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

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

export function formatValue(value: string | null | undefined, fallback = "-") {
  return value?.trim() ? value : fallback;
}
