import { describe, expect, it } from "vitest";

import type { TaskQuery } from "@taskapp/shared";

import type {
  CreateTaskData,
  ITaskRepository,
  TaskPage,
  TaskRecord,
  UpdateTaskData,
} from "./task.repository";
import { TaskService } from "./task.service";

const NOW = new Date("2026-06-15T12:00:00.000Z");

function makeTask(overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: "task_1",
    title: "Existing task",
    description: null,
    status: "TODO",
    priority: "MEDIUM",
    dueDate: null,
    completedAt: null,
    userId: "user_1",
    createdAt: new Date("2026-06-01T09:00:00.000Z"),
    updatedAt: new Date("2026-06-01T09:00:00.000Z"),
    ...overrides,
  };
}

const defaultQuery: TaskQuery = {
  page: 1,
  pageSize: 10,
  q: undefined,
  status: undefined,
  priority: undefined,
  overdue: false,
  sortBy: "createdAt",
  sortOrder: "desc",
};

class FakeTaskRepository implements ITaskRepository {
  tasks: TaskRecord[] = [];
  lastFilters: TaskQuery | null = null;
  private sequence = 0;

  async create(data: CreateTaskData): Promise<TaskRecord> {
    this.sequence += 1;
    const task = makeTask({
      ...data,
      id: `task_${this.sequence}`,
      createdAt: NOW,
      updatedAt: NOW,
    });
    this.tasks.push(task);
    return task;
  }

  async findById(userId: string, id: string): Promise<TaskRecord | null> {
    return (
      this.tasks.find((task) => task.id === id && task.userId === userId) ?? null
    );
  }

  async update(id: string, data: UpdateTaskData): Promise<TaskRecord> {
    const index = this.tasks.findIndex((task) => task.id === id);
    const updated = { ...this.tasks[index], ...data } as TaskRecord;
    this.tasks[index] = updated;
    return updated;
  }

  async deleteById(userId: string, id: string): Promise<number> {
    const before = this.tasks.length;
    this.tasks = this.tasks.filter(
      (task) => !(task.id === id && task.userId === userId),
    );
    return before - this.tasks.length;
  }

  async findMany(userId: string, filters: TaskQuery): Promise<TaskPage> {
    this.lastFilters = filters;
    const owned = this.tasks.filter((task) => task.userId === userId);
    const start = (filters.page - 1) * filters.pageSize;
    return {
      items: owned.slice(start, start + filters.pageSize),
      total: owned.length,
    };
  }
}

function createService(): {
  service: TaskService;
  repository: FakeTaskRepository;
} {
  const repository = new FakeTaskRepository();
  const service = new TaskService({ repository, now: () => NOW });
  return { service, repository };
}

describe("TaskService", () => {
  it("creates a task and stamps completedAt when created as completed", async () => {
    const { service } = createService();

    const task = await service.create("user_1", {
      title: "Ship the release",
      description: "Cut the tag and publish notes",
      status: "COMPLETED",
      priority: "HIGH",
      dueDate: new Date("2026-06-20T10:00:00.000Z"),
    });

    expect(task.status).toBe("COMPLETED");
    expect(task.completedAt).toBe(NOW.toISOString());
    expect(task.isOverdue).toBe(false);
  });

  it("does not mark a completed task as overdue", async () => {
    const { service, repository } = createService();
    repository.tasks = [
      makeTask({
        status: "COMPLETED",
        dueDate: new Date("2026-06-01T10:00:00.000Z"),
        completedAt: new Date("2026-06-02T10:00:00.000Z"),
      }),
    ];

    const task = await service.getById("user_1", "task_1");

    expect(task.isOverdue).toBe(false);
  });

  it("marks an incomplete task with a past due date as overdue", async () => {
    const { service, repository } = createService();
    repository.tasks = [
      makeTask({ dueDate: new Date("2026-06-14T10:00:00.000Z") }),
    ];

    const task = await service.getById("user_1", "task_1");

    expect(task.isOverdue).toBe(true);
  });

  it("sets completedAt when a task transitions to completed", async () => {
    const { service, repository } = createService();
    repository.tasks = [makeTask()];

    const task = await service.update("user_1", "task_1", {
      status: "COMPLETED",
    });

    expect(task.completedAt).toBe(NOW.toISOString());
  });

  it("clears completedAt when a completed task is reopened", async () => {
    const { service, repository } = createService();
    repository.tasks = [
      makeTask({
        status: "COMPLETED",
        completedAt: new Date("2026-06-10T10:00:00.000Z"),
      }),
    ];

    const task = await service.update("user_1", "task_1", {
      status: "IN_PROGRESS",
    });

    expect(task.completedAt).toBeNull();
  });

  it("rejects updates to a task owned by another user", async () => {
    const { service, repository } = createService();
    repository.tasks = [makeTask({ userId: "user_2" })];

    await expect(
      service.update("user_1", "task_1", { title: "Hijacked" }),
    ).rejects.toMatchObject({ statusCode: 404, code: "NOT_FOUND" });
  });

  it("rejects deleting a task that does not exist", async () => {
    const { service } = createService();

    await expect(service.delete("user_1", "missing")).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("returns pagination metadata for lists", async () => {
    const { service, repository } = createService();
    repository.tasks = Array.from({ length: 25 }, (_, index) =>
      makeTask({ id: `task_${index + 1}`, title: `Task ${index + 1}` }),
    );

    const result = await service.list("user_1", {
      ...defaultQuery,
      page: 2,
      pageSize: 10,
    });

    expect(result.data).toHaveLength(10);
    expect(result.meta).toEqual({
      page: 2,
      pageSize: 10,
      total: 25,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: true,
    });
  });

  it("passes filters through to the repository unchanged", async () => {
    const { service, repository } = createService();
    const query: TaskQuery = {
      ...defaultQuery,
      q: "release",
      status: "TODO",
      priority: "HIGH",
      overdue: true,
      sortBy: "dueDate",
      sortOrder: "asc",
    };

    await service.list("user_1", query);

    expect(repository.lastFilters).toEqual(query);
  });
});
