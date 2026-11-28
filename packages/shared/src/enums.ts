/**
 * Domain constants shared by the API and the web client.
 * These tuples are the single source of truth for the database enums,
 * validation schemas, filters and UI labels.
 */

export const TASK_STATUSES = ["TODO", "IN_PROGRESS", "COMPLETED"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
};

export const TASK_SORT_FIELDS = [
  "createdAt",
  "updatedAt",
  "dueDate",
  "title",
  "priority",
] as const;
export type TaskSortField = (typeof TASK_SORT_FIELDS)[number];

export const SORT_ORDERS = ["asc", "desc"] as const;
export type SortOrder = (typeof SORT_ORDERS)[number];

export const ATTACHMENT_STATUSES = ["PENDING", "UPLOADED", "FAILED"] as const;
export type AttachmentStatus = (typeof ATTACHMENT_STATUSES)[number];

export const ATTACHMENT_STATUS_LABELS: Record<AttachmentStatus, string> = {
  PENDING: "Uploading",
  UPLOADED: "Ready",
  FAILED: "Failed",
};

/**
 * Allow-list of file types accepted by the attachment flow. Keep this list
 * intentionally small: the API signs uploads with the exact content type, so
 * accepting arbitrary browser-provided types would widen the attack surface.
 */
export const ATTACHMENT_CONTENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/zip",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;
export type AttachmentContentType = (typeof ATTACHMENT_CONTENT_TYPES)[number];

export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 100;
export const MAX_PAGE_SIZE_BOARD = MAX_PAGE_SIZE;
