import type { TaskListParams } from "@/lib/api/tasks.api";

export const queryKeys = {
  dashboard: ["dashboard"] as const,
  tasks: {
    all: ["tasks"] as const,
    lists: ["tasks", "list"] as const,
    list: (params: TaskListParams) => ["tasks", "list", params] as const,
    detail: (id: string) => ["tasks", "detail", id] as const,
  },
};
