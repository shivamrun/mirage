import { jobDefinitions, jobQueueNames } from "@/server/jobs/registry";
import { parsePageParam, type SearchParamValue } from "@/shared/pagination";
import type {
  AdminJobName,
  AdminJobQueue,
  AdminJobStatus,
} from "@/shared/schemas";

export const ADMIN_JOBS_PAGE_PATH = "/admin/jobs";
export const adminJobStatuses = [
  "waiting",
  "active",
  "delayed",
  "completed",
  "failed",
] as const satisfies readonly AdminJobStatus[];

export type AdminJobsPageSearchParams = {
  name?: SearchParamValue;
  page?: SearchParamValue;
  queue?: SearchParamValue;
  status?: SearchParamValue;
};

const queues = new Set<string>(Object.values(jobQueueNames));
const names = new Set<string>(Object.keys(jobDefinitions));
const statuses = new Set<string>(adminJobStatuses);

function first(value?: SearchParamValue) {
  return Array.isArray(value) ? value[0] : value;
}

export function parseAdminJobsSearchParams(params: AdminJobsPageSearchParams) {
  const queue = first(params.queue);
  const name = first(params.name);
  const status = first(params.status);
  return {
    name: names.has(name ?? "") ? (name as AdminJobName) : undefined,
    page: parsePageParam(params.page),
    queue: queues.has(queue ?? "") ? (queue as AdminJobQueue) : undefined,
    status: statuses.has(status ?? "") ? (status as AdminJobStatus) : undefined,
  };
}

export function adminJobsPageHref({
  name,
  page,
  queue,
  status,
}: {
  name?: AdminJobName;
  page?: number;
  queue?: AdminJobQueue;
  status?: AdminJobStatus;
}) {
  const params = new URLSearchParams();
  if (queue) params.set("queue", queue);
  if (name) params.set("name", name);
  if (status) params.set("status", status);
  if (page && page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `${ADMIN_JOBS_PAGE_PATH}?${query}` : ADMIN_JOBS_PAGE_PATH;
}
