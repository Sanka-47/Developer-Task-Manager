import { z } from "zod";
import {
  taskPrioritySchema,
  taskStatusSchema,
  type CreateTaskInput,
  type TaskDto,
} from "@taskapp/shared";

import { fromDateTimeLocalValue, toDateTimeLocalValue } from "@/lib/utils/date";

/**
 * UI-level form schema. It mirrors the shared API contract but keeps the due
 * date as a `datetime-local` string, which is what the input element produces.
 */
export const taskFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(120, "Title must be at most 120 characters"),
  description: z
    .string()
    .trim()
    .max(2000, "Description must be at most 2000 characters"),
  status: taskStatusSchema,
  priority: taskPrioritySchema,
  dueDate: z
    .string()
    .optional()
    .refine(
      (value) => !value || !Number.isNaN(new Date(value).getTime()),
      "Enter a valid due date",
    ),
});

export type TaskFormValues = z.infer<typeof taskFormSchema>;

export const EMPTY_TASK_FORM_VALUES: TaskFormValues = {
  title: "",
  description: "",
  status: "TODO",
  priority: "MEDIUM",
  dueDate: "",
};

export function toTaskFormValues(task?: TaskDto | null): TaskFormValues {
  if (!task) {
    return { ...EMPTY_TASK_FORM_VALUES };
  }

  return {
    title: task.title,
    description: task.description ?? "",
    status: task.status,
    priority: task.priority,
    dueDate: toDateTimeLocalValue(task.dueDate),
  };
}

export function toCreateTaskInput(values: TaskFormValues): CreateTaskInput {
  return {
    title: values.title.trim(),
    description: values.description.trim() ? values.description.trim() : null,
    status: values.status,
    priority: values.priority,
    dueDate: values.dueDate ? fromDateTimeLocalValue(values.dueDate) : null,
  };
}
