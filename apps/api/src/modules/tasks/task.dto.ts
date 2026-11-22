import type {
  CreateTaskInput,
  TaskPriority,
  TaskStatus,
  UpdateTaskInput,
} from "@taskapp/shared";

export interface CreateTaskDto {
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: Date | null;
}

export interface UpdateTaskDto {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: Date | null;
}

export interface UpdateTaskStatusDto {
  status: TaskStatus;
}
