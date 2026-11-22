import type {
  CreateTaskInput,
  PaginationMeta,
  TaskDto,
  TaskStatus,
  UpdateTaskInput,
} from "@taskapp/shared";

import { apiRequest } from "./client";

export interface TaskListParams {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: TaskStatus;
  priority?: "LOW" | "MEDIUM" | "HIGH";
  overdue?: boolean;
  sortBy?: "createdAt" | "updatedAt" | "dueDate" | "title" | "priority";
  sortOrder?: "asc" | "desc";
}

export interface TaskListResult {
  data: TaskDto[];
  meta: PaginationMeta;
}

export function buildTaskQuery(params: TaskListParams): string {
  const searchParams = new URLSearchParams();

  if (params.page !== undefined) {
    searchParams.set("page", String(params.page));
  }
  if (params.pageSize !== undefined) {
    searchParams.set("pageSize", String(params.pageSize));
  }
  if (params.q?.trim()) {
    searchParams.set("q", params.q.trim());
  }
  if (params.status) {
    searchParams.set("status", params.status);
  }
  if (params.priority) {
    searchParams.set("priority", params.priority);
  }
  if (params.overdue) {
    searchParams.set("overdue", "true");
  }
  if (params.sortBy) {
    searchParams.set("sortBy", params.sortBy);
  }
  if (params.sortOrder) {
    searchParams.set("sortOrder", params.sortOrder);
  }

  return searchParams.toString();
}

export const tasksApi = {
  async list(params: TaskListParams): Promise<TaskListResult> {
    const query = buildTaskQuery(params);
    const response = await apiRequest<TaskDto[]>(
      `/tasks${query ? `?${query}` : ""}`,
    );

    return {
      data: response.data,
      meta:
        response.meta ??
        ({
          page: 1,
          pageSize: response.data.length,
          total: response.data.length,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        } satisfies PaginationMeta),
    };
  },

  get(id: string): Promise<TaskDto> {
    return apiRequest<TaskDto>(`/tasks/${encodeURIComponent(id)}`).then(
      (response) => response.data,
    );
  },

  create(input: CreateTaskInput): Promise<TaskDto> {
    return apiRequest<TaskDto>("/tasks", {
      method: "POST",
      body: input,
    }).then((response) => response.data);
  },

  update(id: string, input: UpdateTaskInput): Promise<TaskDto> {
    return apiRequest<TaskDto>(`/tasks/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: input,
    }).then((response) => response.data);
  },

  updateStatus(id: string, status: TaskStatus): Promise<TaskDto> {
    return apiRequest<TaskDto>(`/tasks/${encodeURIComponent(id)}/status`, {
      method: "PATCH",
      body: { status },
    }).then((response) => response.data);
  },

  remove(id: string): Promise<void> {
    return apiRequest<void>(`/tasks/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }).then(() => undefined);
  },
};
