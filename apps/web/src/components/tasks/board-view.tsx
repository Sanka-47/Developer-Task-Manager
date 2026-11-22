"use client";

import { Plus, SquareKanban } from "lucide-react";
import { useState } from "react";
import { MAX_PAGE_SIZE_BOARD, type TaskDto, type TaskStatus } from "@taskapp/shared";

import { ErrorState } from "@/components/common/error-state";
import { PageHeader } from "@/components/common/page-header";
import { DeleteTaskDialog } from "@/components/tasks/delete-task-dialog";
import { KanbanBoard } from "@/components/tasks/kanban-board";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useTasks, useUpdateTaskStatus } from "@/hooks/use-tasks";
import { getErrorMessage } from "@/lib/utils/errors";

export function BoardView() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskDto | null>(null);
  const [deletingTask, setDeletingTask] = useState<TaskDto | null>(null);

  const query = useTasks({
    pageSize: MAX_PAGE_SIZE_BOARD,
    sortBy: "createdAt",
    sortOrder: "desc",
  });
  const updateStatus = useUpdateTaskStatus();

  function handleStatusChange(task: TaskDto, status: TaskStatus): void {
    updateStatus.mutate({ id: task.id, status });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Board"
        description="A visual view of your work. Drag cards between columns, or use the drag handle with a keyboard."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            New task
          </Button>
        }
      />

      {query.isLoading ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div
              key={index}
              className="space-y-3 rounded-xl border border-border bg-muted/30 p-3"
            >
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState
          message={getErrorMessage(query.error)}
          onRetry={() => void query.refetch()}
        />
      ) : query.data && query.data.data.length === 0 ? (
        <EmptyState
          icon={SquareKanban}
          title="Your board is empty"
          description="Create your first task to see it appear in the To do column."
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Create a task
            </Button>
          }
        />
      ) : (
        <>
          <KanbanBoard
            tasks={query.data?.data ?? []}
            onStatusChange={handleStatusChange}
            onEdit={setEditingTask}
            onDelete={setDeletingTask}
            onCreate={() => setCreateOpen(true)}
          />
          {query.data && query.data.meta.total > query.data.data.length ? (
            <p className="text-center text-xs text-muted-foreground">
              Showing the first {query.data.data.length} of{" "}
              {query.data.meta.total} tasks. Use the list view to page through
              everything.
            </p>
          ) : null}
        </>
      )}

      <TaskFormDialog open={createOpen} onOpenChange={setCreateOpen} />
      <TaskFormDialog
        open={Boolean(editingTask)}
        onOpenChange={(open) => !open && setEditingTask(null)}
        task={editingTask}
      />
      <DeleteTaskDialog
        task={deletingTask}
        onOpenChange={(open) => !open && setDeletingTask(null)}
      />
    </div>
  );
}
