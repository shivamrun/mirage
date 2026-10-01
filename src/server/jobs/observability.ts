export function logJobEvent(
  level: "error" | "info" | "warn",
  event: string,
  details: Record<string, unknown> = {},
) {
  console[level](JSON.stringify({ event, ...details }));
}
