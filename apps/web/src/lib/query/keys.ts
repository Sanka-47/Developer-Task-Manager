import type { TaskListParams } from "@/lib/api/tasks.api";

export const queryKeys = {
  dashboard: ["dashboard"] as const,
  tasks: {
    all: ["tasks"] as const,
    lists: ["tasks", "list"] as const,
    list: (params: TaskListParams) => ["tasks", "list", params] as const,
    detail: (id: string) => ["tasks", "detail", id] as const,
  },
  attachments: {
    all: ["attachments"] as const,
    lists: ["attachments", "list"] as const,
    list: (taskId: string) => ["attachments", "list", taskId] as const,
  },
};
