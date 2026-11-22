import type {
  PaginatedTasks,
  TaskDto,
  TaskQuery,
} from "@taskapp/shared";

import { NotFoundError } from "../../common/errors/app-error";
import { buildPaginationMeta } from "../../common/utils/pagination";
import type {
  CreateTaskDto,
  UpdateTaskDto,
  UpdateTaskStatusDto,
} from "./task.dto";
import { TaskMapper } from "./task.mapper";
import type {
  CreateTaskData,
  ITaskRepository,
  UpdateTaskData,
} from "./task.repository";

export interface TaskServiceDependencies {
  repository: ITaskRepository;
  now?: () => Date;
}

export class TaskService {
  private readonly repository: ITaskRepository;
  private readonly now: () => Date;

  constructor(dependencies: TaskServiceDependencies) {
    this.repository = dependencies.repository;
    this.now = dependencies.now ?? (() => new Date());
  }

  async list(userId: string, query: TaskQuery): Promise<PaginatedTasks> {
    const { items, total } = await this.repository.findMany(userId, query);
    const now = this.now();

    return {
      data: TaskMapper.toDtoList(items, now),
      meta: buildPaginationMeta(query.page, query.pageSize, total),
    };
  }

  async getById(userId: string, id: string): Promise<TaskDto> {
    const task = await this.repository.findById(userId, id);
    if (!task) {
      throw new NotFoundError("Task not found");
    }
    return TaskMapper.toDto(task, this.now());
  }

  async create(userId: string, input: CreateTaskDto): Promise<TaskDto> {
    const now = this.now();
    const data: CreateTaskData = {
      userId,
      title: input.title,
      description: input.description,
      status: input.status,
      priority: input.priority,
      dueDate: input.dueDate,
      completedAt: input.status === "COMPLETED" ? now : null,
    };

    const task = await this.repository.create(data);
    return TaskMapper.toDto(task, now);
  }

  async update(
    userId: string,
    id: string,
    input: UpdateTaskDto,
  ): Promise<TaskDto> {
    const existing = await this.repository.findById(userId, id);
    if (!existing) {
      throw new NotFoundError("Task not found");
    }

    const now = this.now();
    const data: UpdateTaskData = { ...input };

    // Completion is derived business logic, not something the client sends.
    if (input.status === "COMPLETED") {
      data.completedAt = existing.completedAt ?? now;
    } else if (input.status !== undefined) {
      data.completedAt = null;
    }

    const task = await this.repository.update(id, data);
    return TaskMapper.toDto(task, now);
  }

  updateStatus(
    userId: string,
    id: string,
    input: UpdateTaskStatusDto,
  ): Promise<TaskDto> {
    return this.update(userId, id, { status: input.status });
  }

  async delete(userId: string, id: string): Promise<void> {
    const deletedCount = await this.repository.deleteById(userId, id);
    if (deletedCount === 0) {
      throw new NotFoundError("Task not found");
    }
  }
}
