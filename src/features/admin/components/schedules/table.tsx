import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/features/admin/components/user-detail/primitives";
import type { AdminSchedule } from "@/shared/schemas";
import { formatDate } from "../shared/formatters";
import { ScheduleTrigger } from "./schedule-trigger";

function duration(milliseconds: number) {
  const seconds = Math.floor(milliseconds / 1_000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return hours < 24
    ? `${hours}h ${minutes % 60}m`
    : `${Math.floor(hours / 24)}d ${hours % 24}h`;
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
                    <p
                      className="max-w-72 truncate font-medium"
                      title={schedule.name}
                    >
                      {schedule.name}
                    </p>
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
