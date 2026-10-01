import {
  Activity,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Timer,
  XCircle,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/features/admin/components/user-detail/primitives";
import type { AdminQueueSnapshot } from "@/server/jobs/admin";
import { jobDefinitions, jobQueueNames } from "@/server/jobs/registry";
import type {
  AdminJob,
  AdminJobName,
  AdminJobQueue,
  AdminJobStatus,
  AdminSchedule,
} from "@/shared/schemas";
import { formatDate } from "../shared/formatters";
import { JobActions } from "./job-actions";
import { adminJobStatuses, adminJobsPageHref } from "./query";
import { ScheduleTrigger } from "./schedule-trigger";

const allFilterValue = "__all__";

function duration(milliseconds: number | null) {
  if (milliseconds === null) return "-";
  const seconds = Math.floor(milliseconds / 1_000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return hours < 24
    ? `${hours}h ${minutes % 60}m`
    : `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

function JobStatus({ status }: { status: AdminJobStatus }) {
  const config = {
    active: { icon: Activity, tone: "good" as const },
    completed: { icon: CheckCircle2, tone: "good" as const },
    delayed: { icon: Timer, tone: "warning" as const },
    failed: { icon: XCircle, tone: "danger" as const },
    waiting: { icon: Clock3, tone: "neutral" as const },
  }[status];
  return (
    <StatusBadge icon={config.icon} tone={config.tone}>
      {status}
    </StatusBadge>
  );
}

export function JobsOverview({ snapshot }: { snapshot: AdminQueueSnapshot }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border bg-card px-4 py-3 sm:grid-cols-5">
      {adminJobStatuses.map((status) => (
        <div key={status}>
          <dt className="text-muted-foreground text-xs capitalize">{status}</dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums">
            {snapshot.counts[status].toLocaleString()}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function QueueAndWorkerTables({
  snapshot,
}: {
  snapshot: AdminQueueSnapshot;
}) {
  return (
    <div className="space-y-5">
      <section>
        <h2 className="mb-2 font-semibold">Queue health</h2>
        <div className="overflow-auto rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Queue</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Waiting</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Oldest waiting</TableHead>
                <TableHead>Workers</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {snapshot.queues.map((queue) => (
                <TableRow key={queue.queue}>
                  <TableCell className="font-medium">
                    <Link
                      className="link-text"
                      href={adminJobsPageHref({ queue: queue.queue })}
                    >
                      {queue.queue}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      icon={
                        queue.status === "unavailable" ? CircleAlert : undefined
                      }
                      tone={
                        queue.status === "healthy"
                          ? "good"
                          : queue.status === "no-worker"
                            ? "warning"
                            : "danger"
                      }
                    >
                      {queue.status === "no-worker"
                        ? "No worker"
                        : queue.status}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>{queue.counts.waiting}</TableCell>
                  <TableCell>{queue.counts.active}</TableCell>
                  <TableCell>{duration(queue.oldestWaitingAgeMs)}</TableCell>
                  <TableCell>{queue.workerCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
      <section>
        <h2 className="mb-2 font-semibold">Workers</h2>
        <div className="overflow-auto rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Worker</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Queues / concurrency</TableHead>
                <TableHead>Last seen</TableHead>
                <TableHead>Uptime</TableHead>
                <TableHead>Release</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {snapshot.workers.length ? (
                snapshot.workers.map((worker) => (
                  <TableRow key={worker.workerId}>
                    <TableCell
                      className="max-w-40 truncate font-mono text-xs"
                      title={worker.workerId}
                    >
                      {worker.workerId}
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone="good">online</StatusBadge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {worker.queues
                        .map(
                          (queue) =>
                            `${queue}${worker.concurrencyByQueue[queue] ? ` (${worker.concurrencyByQueue[queue]})` : ""}`,
                        )
                        .join(", ")}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(worker.lastSeenAt)}
                    </TableCell>
                    <TableCell>
                      {duration(
                        Date.parse(snapshot.snapshotAt) -
                          Date.parse(worker.startedAt),
                      )}
                    </TableCell>
                    <TableCell className="max-w-32 truncate">
                      {worker.release ?? "-"}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    className="h-28 text-center text-muted-foreground"
                    colSpan={6}
                  >
                    No fresh worker heartbeats.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}

export function JobsFilter({
  name,
  queue,
  status,
}: {
  name?: AdminJobName;
  queue?: AdminJobQueue;
  status?: AdminJobStatus;
}) {
  return (
    <form className="flex flex-wrap items-end gap-2" method="get">
      <label
        className="space-y-1 text-xs text-muted-foreground"
        htmlFor="jobs-queue"
      >
        Queue
        <Select defaultValue={queue ?? allFilterValue} name="queue">
          <SelectTrigger
            className="mt-1 min-w-36 bg-background"
            id="jobs-queue"
          >
            <SelectValue placeholder="All queues" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={allFilterValue}>All queues</SelectItem>
            {Object.values(jobQueueNames).map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
      <label
        className="space-y-1 text-xs text-muted-foreground"
        htmlFor="jobs-name"
      >
        Job name
        <Select defaultValue={name ?? allFilterValue} name="name">
          <SelectTrigger
            className="mt-1 max-w-80 min-w-72 bg-background"
            id="jobs-name"
          >
            <SelectValue placeholder="All jobs" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={allFilterValue}>All jobs</SelectItem>
            {Object.keys(jobDefinitions).map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
      <label
        className="space-y-1 text-xs text-muted-foreground"
        htmlFor="jobs-status"
      >
        Status
        <Select defaultValue={status ?? allFilterValue} name="status">
          <SelectTrigger
            className="mt-1 min-w-36 bg-background"
            id="jobs-status"
          >
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={allFilterValue}>All statuses</SelectItem>
            {adminJobStatuses.map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
      <Button size="sm" type="submit">
        Apply
      </Button>
      {name || queue || status ? (
        <Button asChild size="sm" variant="ghost">
          <Link href="/admin/jobs">Clear</Link>
        </Button>
      ) : null}
    </form>
  );
}

export function JobsTable({
  jobs,
  unavailableQueues,
}: {
  jobs: AdminJob[];
  unavailableQueues: AdminJobQueue[];
}) {
  return (
    <section className="min-h-0">
      {unavailableQueues.length ? (
        <p className="mb-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-destructive text-sm">
          Could not inspect: {unavailableQueues.join(", ")}.
        </p>
      ) : null}
      <ScrollArea className="h-[28rem] rounded-lg border bg-card">
        <Table className="min-w-[1000px]">
          <TableHeader className="sticky top-0 z-20 bg-muted/80 backdrop-blur">
            <TableRow>
              <TableHead>Job</TableHead>
              <TableHead>Queue</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Processed</TableHead>
              <TableHead>Finished</TableHead>
              <TableHead>Attempts</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.length ? (
              jobs.map((job) => (
                <TableRow key={`${job.queue}:${job.id}`}>
                  <TableCell>
                    <p
                      className="max-w-72 truncate font-medium"
                      title={job.name}
                    >
                      {job.name}
                    </p>
                    <p
                      className="max-w-72 truncate font-mono text-muted-foreground text-xs"
                      title={job.id}
                    >
                      {job.id}
                    </p>
                  </TableCell>
                  <TableCell>{job.queue}</TableCell>
                  <TableCell>
                    <JobStatus status={job.status} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatDate(job.createdAt)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatDate(job.processedAt, "-")}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatDate(job.finishedAt, "-")}
                  </TableCell>
                  <TableCell>
                    {job.attemptsMade} / {job.maxAttempts}
                  </TableCell>
                  <TableCell className="text-right">
                    <JobActions job={job} />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell className="h-40 text-center" colSpan={8}>
                  <p className="font-medium">No jobs found</p>
                  <p className="mt-1 text-muted-foreground text-sm">
                    Adjust filters or wait for work to be enqueued.
                  </p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </ScrollArea>
    </section>
  );
}

export function SchedulesTable({
  schedules,
}: {
  schedules: AdminSchedule[] | null;
}) {
  return (
    <section>
      <div className="overflow-auto rounded-lg border bg-card">
        <Table className="min-w-[920px]">
          <TableHeader>
            <TableRow>
              <TableHead>Job</TableHead>
              <TableHead>Queue</TableHead>
              <TableHead>Cadence</TableHead>
              <TableHead>Next run</TableHead>
              <TableHead>Last run</TableHead>
              <TableHead>State</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {schedules?.length ? (
              schedules.map((schedule) => (
                <TableRow key={schedule.id}>
                  <TableCell>
                    <Link
                      className="link-text font-medium"
                      href={adminJobsPageHref({
                        name: schedule.name,
                        queue: schedule.queue,
                      })}
                    >
                      {schedule.name}
                    </Link>
                    <p className="font-mono text-muted-foreground text-xs">
                      {schedule.id}
                    </p>
                  </TableCell>
                  <TableCell>{schedule.queue}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {schedule.pattern
                      ? `${schedule.pattern} (${schedule.timezone ?? "UTC"})`
                      : schedule.everyMs
                        ? `every ${duration(schedule.everyMs)}`
                        : "-"}
                  </TableCell>
                  <TableCell>{formatDate(schedule.nextRunAt, "-")}</TableCell>
                  <TableCell>{formatDate(schedule.lastRunAt, "-")}</TableCell>
                  <TableCell>
                    <StatusBadge tone={schedule.enabled ? "good" : "warning"}>
                      {schedule.enabled ? "enabled" : "not registered"}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="text-right">
                    {schedule.manualTrigger ? (
                      <ScheduleTrigger schedule={schedule} />
                    ) : null}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  className="h-28 text-center text-muted-foreground"
                  colSpan={7}
                >
                  {schedules
                    ? "No schedules configured."
                    : "Schedules unavailable."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
