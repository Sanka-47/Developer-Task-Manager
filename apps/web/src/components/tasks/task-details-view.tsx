"use client";

import {
  ArrowLeft,
  CalendarClock,
  Pencil,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import {
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  type TaskStatus,
} from "@taskapp/shared";

import { ErrorState } from "@/components/common/error-state";
import { DeleteTaskDialog } from "@/components/tasks/delete-task-dialog";
import { TaskAttachments } from "@/components/tasks/task-attachments";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import {
  TaskPriorityBadge,
  TaskStatusBadge,
} from "@/components/tasks/task-badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTask, useUpdateTaskStatus } from "@/hooks/use-tasks";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils/cn";
import { formatDateTime, formatDueDate } from "@/lib/utils/date";
import { getErrorMessage } from "@/lib/utils/errors";

export function TaskDetailsView() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();

  const query = useTask(id);
  const updateStatus = useUpdateTaskStatus();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const task = query.data;
  const notFound = query.error instanceof ApiError && query.error.status === 404;

  if (query.isLoading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading task">
        <Skeleton className="h-4 w-28" />
        <div className="space-y-3">
          <div className="flex gap-2">
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <Skeleton className="h-9 w-2/3" />
          <Skeleton className="h-4 w-56" />
        </div>
        <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (query.isError || !task) {
    return (
      <div className="space-y-5">
        <Link
          href="/tasks"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to tasks
        </Link>
        <ErrorState
          title={notFound ? "Task not found" : "Couldn’t load this task"}
          message={
            notFound
              ? "This task may have been deleted, or the link is incorrect."
              : getErrorMessage(query.error)
          }
          onRetry={notFound ? undefined : () => void query.refetch()}
        />
      </div>
    );
  }

  function changeStatus(status: TaskStatus): void {
    if (!task || task.status === status) {
      return;
    }
    updateStatus.mutate({ id: task.id, status });
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/tasks"
          className="inline-flex items-center gap-1.5 rounded text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to tasks
        </Link>
      </div>

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <TaskStatusBadge status={task.status} />
            <TaskPriorityBadge priority={task.priority} />
            {task.isOverdue ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-danger/10 px-2.5 py-0.5 text-xs font-medium text-danger ring-1 ring-inset ring-danger/20">
                <CalendarClock className="h-3 w-3" aria-hidden="true" />
                Overdue
              </span>
            ) : null}
          </div>

          <h1 className="mt-3 text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
            {task.title}
          </h1>
          <p className="mt-2 text-xs text-muted-foreground">
            Created {formatDateTime(task.createdAt)} · Updated{" "}
            {formatDateTime(task.updatedAt)}
          </p>
        </div>

        <div className="flex shrink-0 gap-2">
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4" aria-hidden="true" />
            Edit
          </Button>
          <Button variant="outline" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              {task.description ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                  {task.description}
                </p>
              ) : (
                <p className="text-sm italic text-muted-foreground">
                  No description was provided for this task.
                </p>
              )}
            </CardContent>
          </Card>

          <TaskAttachments taskId={task.id} />

          <Card>
            <CardHeader>
              <CardTitle>Update status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {TASK_STATUSES.map((status) => (
                  <Button
                    key={status}
                    variant={task.status === status ? "primary" : "outline"}
                    onClick={() => changeStatus(status)}
                    disabled={
                      updateStatus.isPending || task.status === status
                    }
                    aria-pressed={task.status === status}
                    className={cn("min-w-28")}
                  >
                    {TASK_STATUS_LABELS[status]}
                  </Button>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Completing a task records the completion time automatically.
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y divide-border text-sm">
              <div className="flex items-center justify-between gap-4 py-2.5 first:pt-0">
                <dt className="text-muted-foreground">Due date</dt>
                <dd
                  className={cn(
                    "text-right font-medium",
                    task.isOverdue && "text-danger",
                  )}
                >
                  {formatDueDate(task.dueDate, task.isOverdue)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-2.5">
                <dt className="text-muted-foreground">Status</dt>
                <dd>
                  <TaskStatusBadge status={task.status} />
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-2.5">
                <dt className="text-muted-foreground">Priority</dt>
                <dd>
                  <TaskPriorityBadge priority={task.priority} />
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-2.5">
                <dt className="text-muted-foreground">Created</dt>
                <dd className="text-right">{formatDateTime(task.createdAt)}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-2.5">
                <dt className="text-muted-foreground">Updated</dt>
                <dd className="text-right">{formatDateTime(task.updatedAt)}</dd>
              </div>
              {task.completedAt ? (
                <div className="flex items-center justify-between gap-4 py-2.5">
                  <dt className="text-muted-foreground">Completed</dt>
                  <dd className="text-right">
                    {formatDateTime(task.completedAt)}
                  </dd>
                </div>
              ) : null}
            </dl>
          </CardContent>
        </Card>
      </div>

      <TaskFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        task={task}
      />
      <DeleteTaskDialog
        task={deleteOpen ? task : null}
        onOpenChange={setDeleteOpen}
        onDeleted={() => router.replace("/tasks")}
      />
    </div>
  );
}
