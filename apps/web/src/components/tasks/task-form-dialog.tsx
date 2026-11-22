"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  type TaskDto,
} from "@taskapp/shared";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useCreateTask, useUpdateTask } from "@/hooks/use-tasks";
import {
  EMPTY_TASK_FORM_VALUES,
  taskFormSchema,
  toCreateTaskInput,
  toTaskFormValues,
  type TaskFormValues,
} from "@/lib/validation/task-form";
import { getErrorMessage, toErrorDetails } from "@/lib/utils/errors";

export interface TaskFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: TaskDto | null;
}

export function TaskFormDialog({
  open,
  onOpenChange,
  task,
}: TaskFormDialogProps) {
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const [formError, setFormError] = useState<string | null>(null);
  const isEditing = Boolean(task);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: EMPTY_TASK_FORM_VALUES,
    mode: "onBlur",
  });

  useEffect(() => {
    if (open) {
      reset(toTaskFormValues(task));
      setFormError(null);
    }
  }, [open, task, reset]);

  const isPending = createTask.isPending || updateTask.isPending;
  const isBusy = isPending || isSubmitting;

  async function onSubmit(values: TaskFormValues): Promise<void> {
    if (isBusy) {
      return;
    }

    setFormError(null);

    const payload = toCreateTaskInput(values);

    try {
      if (task) {
        await updateTask.mutateAsync({ id: task.id, input: payload });
        toast.success("Task updated");
      } else {
        await createTask.mutateAsync(payload);
        toast.success("Task created");
      }
      onOpenChange(false);
    } catch (error) {
      const details = toErrorDetails(error);
      details?.forEach((detail) => {
        if (
          detail.path === "title" ||
          detail.path === "description" ||
          detail.path === "status" ||
          detail.path === "priority" ||
          detail.path === "dueDate"
        ) {
          setError(detail.path, { type: "server", message: detail.message });
        }
      });
      setFormError(getErrorMessage(error));
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!isBusy) {
          onOpenChange(next);
        }
      }}
    >
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit task" : "Create a task"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the details and save your changes."
              : "Add the essentials now — you can refine them later."}
          </DialogDescription>
        </DialogHeader>

        {formError ? (
          <div
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-lg border border-danger/20 bg-danger/5 px-3 py-2.5 text-sm text-danger"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{formError}</span>
          </div>
        ) : null}

        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="mt-5 space-y-4"
        >
          <Field
            label="Title"
            htmlFor="task-title"
            error={errors.title?.message}
            required
          >
            <Input
              id="task-title"
              placeholder="e.g. Prepare the quarterly review"
              maxLength={120}
              aria-invalid={Boolean(errors.title)}
              aria-describedby={errors.title ? "task-title-error" : undefined}
              autoFocus
              {...register("title")}
            />
          </Field>

          <Field
            label="Description"
            htmlFor="task-description"
            error={errors.description?.message}
            hint="Optional context, acceptance criteria or links."
          >
            <Textarea
              id="task-description"
              placeholder="What needs to happen?"
              maxLength={2000}
              aria-invalid={Boolean(errors.description)}
              aria-describedby={
                errors.description
                  ? "task-description-error"
                  : "task-description-hint"
              }
              {...register("description")}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Status"
              htmlFor="task-status"
              error={errors.status?.message}
            >
              <Select
                id="task-status"
                aria-invalid={Boolean(errors.status)}
                {...register("status")}
              >
                {TASK_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {TASK_STATUS_LABELS[status]}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Priority"
              htmlFor="task-priority"
              error={errors.priority?.message}
            >
              <Select
                id="task-priority"
                aria-invalid={Boolean(errors.priority)}
                {...register("priority")}
              >
                {TASK_PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {TASK_PRIORITY_LABELS[priority]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field
            label="Due date"
            htmlFor="task-due-date"
            error={errors.dueDate?.message}
            hint="Leave empty if the task has no deadline."
          >
            <Input
              id="task-due-date"
              type="datetime-local"
              aria-invalid={Boolean(errors.dueDate)}
              aria-describedby={
                errors.dueDate ? "task-due-date-error" : "task-due-date-hint"
              }
              {...register("dueDate")}
            />
          </Field>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isBusy}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isBusy}>
              {isPending ? <Spinner label="Saving task" /> : null}
              {isPending
                ? "Saving…"
                : isEditing
                  ? "Save changes"
                  : "Create task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
