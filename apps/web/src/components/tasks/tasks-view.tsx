"use client";

import { ListTodo, Plus, SearchX } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { TaskDto, TaskSortField } from "@taskapp/shared";

import { ErrorState } from "@/components/common/error-state";
import { PageHeader } from "@/components/common/page-header";
import { DeleteTaskDialog } from "@/components/tasks/delete-task-dialog";
import { TaskCard } from "@/components/tasks/task-card";
import { TaskFilters } from "@/components/tasks/task-filters";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import { TaskListSkeleton } from "@/components/tasks/task-list-skeleton";
import { TaskTable } from "@/components/tasks/task-table";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { Spinner } from "@/components/ui/spinner";
import {
  toTaskListParams,
  useTaskFilters,
} from "@/hooks/use-task-filters";
import { useTasks } from "@/hooks/use-tasks";
import { getErrorMessage } from "@/lib/utils/errors";

export function TasksView() {
  const { filters, setFilters, clearFilters, hasActiveFilters } =
    useTaskFilters();
  const query = useTasks(toTaskListParams(filters));
  const [createOpen, setCreateOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskDto | null>(null);
  const [deletingTask, setDeletingTask] = useState<TaskDto | null>(null);

  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  // The top bar links to /tasks?new=1. Open the dialog once, then remove the
  // flag so refreshing or sharing the URL does not reopen it.
  useEffect(() => {
    if (searchParams.get("new") !== "1") {
      return;
    }

    setCreateOpen(true);
    const next = new URLSearchParams(searchParams.toString());
    next.delete("new");
    const queryString = next.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
      scroll: false,
    });
  }, [searchParams, pathname, router]);

  function handleSort(field: TaskSortField): void {
    const isActive = filters.sortBy === field;
    const sortOrder = isActive
      ? filters.sortOrder === "asc"
        ? "desc"
        : "asc"
      : field === "title" || field === "dueDate"
        ? "asc"
        : "desc";

    setFilters({ sortBy: field, sortOrder });
  }

  const tasks = query.data?.data ?? [];
  const meta = query.data?.meta;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Tasks"
        description="Search, filter and prioritise everything on your plate."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            New task
          </Button>
        }
      />

      <TaskFilters
        filters={filters}
        onChange={setFilters}
        onClear={clearFilters}
        hasActiveFilters={hasActiveFilters}
      />

      {query.isLoading ? (
        <TaskListSkeleton />
      ) : query.isError ? (
        <ErrorState
          message={getErrorMessage(query.error)}
          onRetry={() => void query.refetch()}
        />
      ) : tasks.length === 0 ? (
        hasActiveFilters ? (
          <EmptyState
            icon={SearchX}
            title="No tasks match your filters"
            description="Try a different search term, or clear the filters to see everything again."
            action={
              <Button variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={ListTodo}
            title="No tasks yet"
            description="Capture your first task and it will show up here, on the dashboard and on the board."
            action={
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Create your first task
              </Button>
            }
          />
        )
      ) : (
        <div
          className="space-y-4"
          aria-busy={query.isFetching}
        >
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {query.isFetching ? (
              <>
                <Spinner className="h-3 w-3" label="Updating tasks" />
                Updating…
              </>
            ) : (
              <span>
                {meta?.total ?? tasks.length}{" "}
                {(meta?.total ?? tasks.length) === 1 ? "task" : "tasks"}
              </span>
            )}
          </div>

          <div className="space-y-3 md:hidden">
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onEdit={setEditingTask}
                onDelete={setDeletingTask}
              />
            ))}
          </div>

          <TaskTable
            tasks={tasks}
            sortBy={filters.sortBy}
            sortOrder={filters.sortOrder}
            onSortChange={handleSort}
            onEdit={setEditingTask}
            onDelete={setDeletingTask}
          />

          {meta ? (
            <Pagination
              meta={meta}
              onPageChange={(page) => setFilters({ page })}
              onPageSizeChange={(pageSize) => setFilters({ pageSize })}
              disabled={query.isFetching}
            />
          ) : null}
        </div>
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
