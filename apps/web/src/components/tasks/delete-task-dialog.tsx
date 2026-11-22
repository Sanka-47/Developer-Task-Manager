"use client";

import type { TaskDto } from "@taskapp/shared";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { useDeleteTask } from "@/hooks/use-tasks";

export function DeleteTaskDialog({
  task,
  onOpenChange,
  onDeleted,
}: {
  task: TaskDto | null;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}) {
  const deleteTask = useDeleteTask();

  async function handleConfirm(): Promise<void> {
    if (!task) {
      return;
    }

    try {
      await deleteTask.mutateAsync(task.id);
      onOpenChange(false);
      onDeleted?.();
    } catch {
      // The mutation surfaces the error through a toast and keeps the dialog
      // open so the user can retry.
    }
  }

  return (
    <ConfirmDialog
      open={Boolean(task)}
      onOpenChange={onOpenChange}
      title="Delete this task?"
      description={
        task
          ? `“${task.title}” will be permanently deleted. This action cannot be undone.`
          : ""
      }
      confirmLabel="Delete task"
      isPending={deleteTask.isPending}
      onConfirm={() => void handleConfirm()}
    />
  );
}
