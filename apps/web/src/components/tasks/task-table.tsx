"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, CalendarClock } from "lucide-react";
import Link from "next/link";
import type { TaskDto, TaskSortField } from "@taskapp/shared";

import { TaskActions } from "./task-actions";
import { TaskPriorityBadge, TaskStatusBadge } from "./task-badges";
import { cn } from "@/lib/utils/cn";
import { formatDate, formatDueDate } from "@/lib/utils/date";

export interface TaskTableProps {
  tasks: TaskDto[];
  sortBy: TaskSortField;
  sortOrder: "asc" | "desc";
  onSortChange: (field: TaskSortField) => void;
  onEdit: (task: TaskDto) => void;
  onDelete: (task: TaskDto) => void;
}

function SortableHeader({
  field,
  label,
  sortBy,
  sortOrder,
  onSortChange,
  className,
}: {
  field: TaskSortField;
  label: string;
  sortBy: TaskSortField;
  sortOrder: "asc" | "desc";
  onSortChange: (field: TaskSortField) => void;
  className?: string;
}) {
  const active = sortBy === field;
  const Icon = active
    ? sortOrder === "asc"
      ? ArrowUp
      : ArrowDown
    : ArrowUpDown;

  return (
    <th scope="col" className={cn("px-4 py-3", className)}>
      <button
        type="button"
        onClick={() => onSortChange(field)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded text-xs font-semibold uppercase tracking-wide transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          active ? "text-foreground" : "text-muted-foreground",
        )}
        aria-label={`Sort by ${label}${active ? `, currently ${sortOrder}ending` : ""}`}
      >
        {label}
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </th>
  );
}

export function TaskTable({
  tasks,
  sortBy,
  sortOrder,
  onSortChange,
  onEdit,
  onDelete,
}: TaskTableProps) {
  return (
    <div className="hidden overflow-x-auto rounded-xl border border-border bg-card shadow-sm md:block">
      <table className="w-full min-w-[760px] border-collapse text-left text-sm">
        <thead className="border-b border-border bg-muted/40">
          <tr>
            <SortableHeader
              field="title"
              label="Task"
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSortChange={onSortChange}
            />
            <th
              scope="col"
              className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Status
            </th>
            <SortableHeader
              field="priority"
              label="Priority"
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSortChange={onSortChange}
            />
            <SortableHeader
              field="dueDate"
              label="Due date"
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSortChange={onSortChange}
            />
            <SortableHeader
              field="createdAt"
              label="Created"
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSortChange={onSortChange}
            />
            <th scope="col" className="w-12 px-2 py-3">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {tasks.map((task) => (
            <tr
              key={task.id}
              className="group transition-colors hover:bg-muted/35"
            >
              <td className="max-w-[22rem] px-4 py-3.5">
                <Link
                  href={`/tasks/${task.id}`}
                  className="block truncate font-medium text-foreground underline-offset-4 hover:text-primary hover:underline"
                >
                  {task.title}
                </Link>
                {task.description ? (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {task.description}
                  </p>
                ) : null}
              </td>
              <td className="px-4 py-3.5">
                <TaskStatusBadge status={task.status} />
              </td>
              <td className="px-4 py-3.5">
                <TaskPriorityBadge priority={task.priority} />
              </td>
              <td className="px-4 py-3.5">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 whitespace-nowrap text-sm",
                    task.isOverdue
                      ? "font-medium text-danger"
                      : task.dueDate
                        ? "text-foreground"
                        : "text-muted-foreground",
                  )}
                >
                  <CalendarClock
                    className="h-3.5 w-3.5 shrink-0 opacity-70"
                    aria-hidden="true"
                  />
                  {formatDueDate(task.dueDate, task.isOverdue)}
                </span>
              </td>
              <td className="whitespace-nowrap px-4 py-3.5 text-sm text-muted-foreground">
                {formatDate(task.createdAt)}
              </td>
              <td className="px-2 py-3.5">
                <TaskActions
                  task={task}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
