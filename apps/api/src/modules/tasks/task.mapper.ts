import type {
  CreateTaskInput,
  TaskDto,
  UpdateTaskInput,
} from "@taskapp/shared";

import type { CreateTaskDto, UpdateTaskDto } from "./task.dto";
import type { TaskRecord } from "./task.repository";

/**
 * Converts between the three shapes a task takes: request input (strings),
 * service DTOs (Date objects) and API responses (ISO strings + derived flags).
 */
export class TaskMapper {
  static toDto(task: TaskRecord, now: Date = new Date()): TaskDto {
    const isOverdue =
      task.status !== "COMPLETED" &&
      task.dueDate !== null &&
      task.dueDate.getTime() < now.getTime();

    return {
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate?.toISOString() ?? null,
      completedAt: task.completedAt?.toISOString() ?? null,
      isOverdue,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    };
  }

  static toDtoList(tasks: TaskRecord[], now: Date = new Date()): TaskDto[] {
    return tasks.map((task) => TaskMapper.toDto(task, now));
  }

  static fromCreateInput(input: CreateTaskInput): CreateTaskDto {
    return {
      title: input.title,
      description: input.description ?? null,
      status: input.status,
      priority: input.priority,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
    };
  }

  static fromUpdateInput(input: UpdateTaskInput): UpdateTaskDto {
    return {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.dueDate !== undefined
        ? { dueDate: input.dueDate ? new Date(input.dueDate) : null }
        : {}),
    };
  }
}
