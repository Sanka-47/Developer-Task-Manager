import { z } from "zod";

import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  SORT_ORDERS,
  TASK_PRIORITIES,
  TASK_SORT_FIELDS,
  TASK_STATUSES,
} from "./enums";

/* -------------------------------------------------------------------------- */
/*                                  Primitives                                */
/* -------------------------------------------------------------------------- */

export const taskStatusSchema = z.enum(TASK_STATUSES, {
  error: "Status must be one of TODO, IN_PROGRESS or COMPLETED",
});

export const taskPrioritySchema = z.enum(TASK_PRIORITIES, {
  error: "Priority must be one of LOW, MEDIUM or HIGH",
});

export const taskSortFieldSchema = z.enum(TASK_SORT_FIELDS, {
  error: "Unsupported sort field",
});

export const sortOrderSchema = z.enum(SORT_ORDERS, {
  error: "Sort order must be asc or desc",
});

const titleSchema = z
  .string({ error: "Title is required" })
  .trim()
  .min(1, "Title is required")
  .max(120, "Title must be at most 120 characters");

const descriptionSchema = z
  .string()
  .trim()
  .max(2000, "Description must be at most 2000 characters");

/**
 * Accepts an ISO-8601 datetime (with offset or `Z`). Empty strings are
 * normalised to `null` so HTML date inputs can clear the field.
 */
const isoDateSchema = z
  .string({ error: "Due date must be a valid date" })
  .pipe(z.iso.datetime({ offset: true, error: "Due date must be a valid date" }));

const createDueDateSchema = z.preprocess(
  (value) => (value === "" || value === undefined ? null : value),
  isoDateSchema.nullable(),
);

const updateDueDateSchema = z.preprocess(
  (value) => (value === "" ? null : value),
  isoDateSchema.nullable(),
);

/* -------------------------------------------------------------------------- */
/*                                    Tasks                                   */
/* -------------------------------------------------------------------------- */

export const createTaskSchema = z.object({
  title: titleSchema,
  description: z.preprocess(
    (value) => (value === "" ? null : value),
    descriptionSchema.nullable(),
  ).optional(),
  status: taskStatusSchema.default("TODO"),
  priority: taskPrioritySchema.default("MEDIUM"),
  dueDate: createDueDateSchema,
});

export const updateTaskSchema = z
  .object({
    title: titleSchema.optional(),
    description: z.preprocess(
      (value) => (value === "" ? null : value),
      descriptionSchema.nullable(),
    ).optional(),
    status: taskStatusSchema.optional(),
    priority: taskPrioritySchema.optional(),
    dueDate: updateDueDateSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    error: "Provide at least one field to update",
  });

export const updateTaskStatusSchema = z.object({
  status: taskStatusSchema,
});

export const taskIdParamSchema = z.object({
  id: z.string().trim().min(1, "Task id is required"),
});

export const taskQuerySchema = z.object({
  page: z.coerce
    .number({ error: "Page must be a number" })
    .int("Page must be an integer")
    .min(1, "Page must be at least 1")
    .default(1),
  pageSize: z.coerce
    .number({ error: "Page size must be a number" })
    .int("Page size must be an integer")
    .min(1, "Page size must be at least 1")
    .max(MAX_PAGE_SIZE, `Page size must be at most ${MAX_PAGE_SIZE}`)
    .default(DEFAULT_PAGE_SIZE),
  q: z.string().trim().max(120, "Search term is too long").optional(),
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
  overdue: z
    .enum(["true", "false"], { error: "Overdue must be true or false" })
    .optional()
    .transform((value) => value === "true"),
  sortBy: taskSortFieldSchema.default("createdAt"),
  sortOrder: sortOrderSchema.default("desc"),
});

/* -------------------------------------------------------------------------- */
/*                                    Auth                                    */
/* -------------------------------------------------------------------------- */

const emailSchema = z
  .string({ error: "Email is required" })
  .trim()
  .toLowerCase()
  .max(254, "Email must be at most 254 characters")
  .pipe(z.email({ error: "Enter a valid email address" }));

const passwordSchema = z
  .string({ error: "Password is required" })
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be at most 72 characters")
  .regex(/[A-Za-z]/, "Password must contain at least one letter")
  .regex(/\d/, "Password must contain at least one number");

export const registerSchema = z.object({
  name: z
    .string({ error: "Name is required" })
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(80, "Name must be at most 80 characters"),
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z
    .string({ error: "Password is required" })
    .min(1, "Password is required")
    .max(72, "Password must be at most 72 characters"),
});

/* -------------------------------------------------------------------------- */
/*                                  Inferred                                  */
/* -------------------------------------------------------------------------- */

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type UpdateTaskStatusInput = z.infer<typeof updateTaskStatusSchema>;
export type TaskQuery = z.infer<typeof taskQuerySchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
