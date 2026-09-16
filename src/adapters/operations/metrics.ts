export type RequestMetric = {
  count: number;
  errorCount: number;
  totalDurationMs: number;
  maxDurationMs: number;
};

export type MetricsSnapshot = {
  generatedAt: string;
  process: {
    uptimeSeconds: number;
  };
  requests: {
    total: number;
    byRoute: Record<string, RequestMetric>;
  };
};

type RecordRequestOptions = {
  durationMs: number;
  method: string;
  pathname: string;
  status: number;
};

const requestMetrics = new Map<string, RequestMetric>();
let totalRequests = 0;

function normalizePathname(pathname: string) {
  return pathname
    .replace(
      /\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(?=\/|$)/gi,
      "/:uuid",
    )
    .replace(/\/[A-Za-z0-9_-]{24,}(?=\/|$)/g, "/:id");
}

export function recordRequestMetric({
  durationMs,
  method,
  pathname,
  status,
}: RecordRequestOptions) {
  const key = `${method} ${normalizePathname(pathname)}`;
  const metric =
    requestMetrics.get(key) ??
    ({
      count: 0,
      errorCount: 0,
      maxDurationMs: 0,
      totalDurationMs: 0,
    } satisfies RequestMetric);

  metric.count += 1;
  metric.totalDurationMs += durationMs;
  metric.maxDurationMs = Math.max(metric.maxDurationMs, durationMs);
  if (status >= 500) {
    metric.errorCount += 1;
  }

  totalRequests += 1;
  requestMetrics.set(key, metric);
}

export function getMetricsSnapshot(): MetricsSnapshot {
  return {
    generatedAt: new Date().toISOString(),
    process: {
      uptimeSeconds: Math.round(process.uptime()),
    },
    requests: {
      byRoute: Object.fromEntries(
        [...requestMetrics.entries()].map(([key, metric]) => [
          key,
          {
            ...metric,
            maxDurationMs: Math.round(metric.maxDurationMs),
            totalDurationMs: Math.round(metric.totalDurationMs),
          },
        ]),
      ),
      total: totalRequests,
    },
  };
}
