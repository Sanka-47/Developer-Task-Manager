import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from "@taskapp/shared";
import type { TaskPriority, TaskStatus } from "@taskapp/shared";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";

const statusConfig: Record<
  TaskStatus,
  {
    variant: "neutral" | "info" | "success";
    dot: string;
  }
> = {
  TODO: { variant: "neutral", dot: "bg-slate-400" },
  IN_PROGRESS: { variant: "info", dot: "bg-sky-500" },
  COMPLETED: { variant: "success", dot: "bg-emerald-500" },
};

export function TaskStatusBadge({
  status,
  className,
}: {
  status: TaskStatus;
  className?: string;
}) {
  const config = statusConfig[status];

  return (
    <Badge variant={config.variant} className={className}>
      <span
        className={cn("h-1.5 w-1.5 rounded-full", config.dot)}
        aria-hidden="true"
      />
      {TASK_STATUS_LABELS[status]}
    </Badge>
  );
}

const priorityConfig: Record<
  TaskPriority,
  { variant: "neutral" | "warning" | "danger"; dot: string }
> = {
  LOW: { variant: "neutral", dot: "bg-slate-400" },
  MEDIUM: { variant: "warning", dot: "bg-amber-500" },
  HIGH: { variant: "danger", dot: "bg-rose-500" },
};

export function TaskPriorityBadge({
  priority,
  className,
}: {
  priority: TaskPriority;
  className?: string;
}) {
  const config = priorityConfig[priority];

  return (
    <Badge variant={config.variant} className={className}>
      <span
        className={cn("h-1.5 w-1.5 rounded-full", config.dot)}
        aria-hidden="true"
      />
      {TASK_PRIORITY_LABELS[priority]}
    </Badge>
  );
}
