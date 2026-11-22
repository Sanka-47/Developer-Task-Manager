"use client";

import { CalendarClock } from "lucide-react";
import Link from "next/link";
import type { TaskDto } from "@taskapp/shared";

import { Card } from "@/components/ui/card";
import { TaskActions } from "./task-actions";
import { TaskPriorityBadge, TaskStatusBadge } from "./task-badges";
import { cn } from "@/lib/utils/cn";
import { formatDueDate } from "@/lib/utils/date";

export function TaskCard({
  task,
  onEdit,
  onDelete,
}: {
  task: TaskDto;
  onEdit: (task: TaskDto) => void;
  onDelete: (task: TaskDto) => void;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link
            href={`/tasks/${task.id}`}
            className="line-clamp-2 font-medium text-foreground underline-offset-4 hover:text-primary hover:underline"
          >
            {task.title}
          </Link>
          {task.description ? (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              {task.description}
            </p>
          ) : null}
        </div>
        <TaskActions task={task} onEdit={onEdit} onDelete={onDelete} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <TaskStatusBadge status={task.status} />
        <TaskPriorityBadge priority={task.priority} />
      </div>

      <div
        className={cn(
          "mt-3 flex items-center gap-1.5 text-xs",
          task.isOverdue ? "font-medium text-danger" : "text-muted-foreground",
        )}
      >
        <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
        {formatDueDate(task.dueDate, task.isOverdue)}
      </div>
    </Card>
  );
}
