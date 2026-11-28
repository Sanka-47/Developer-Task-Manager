import { randomUUID } from "node:crypto";

import type { TaskPriority, TaskQuery, TaskStatus } from "@taskapp/shared";

import type {
  CreateRefreshTokenData,
  CreateUserData,
  IAuthRepository,
  RefreshTokenRecord,
  RefreshTokenWithUser,
  UserRecord,
} from "../../src/modules/auth/auth.repository";
import type {
  AttachmentRecord,
  CreateAttachmentData,
  IAttachmentRepository,
} from "../../src/modules/attachments/attachment.repository";
import type {
  DownloadUrlOptions,
  FileStorage,
  StoredObjectMetadata,
  UploadUrlOptions,
} from "../../src/modules/attachments/file-storage";
import type {
  DashboardData,
  IDashboardRepository,
} from "../../src/modules/dashboard/dashboard.repository";
import type {
  CreateTaskData,
  ITaskRepository,
  TaskPage,
  TaskRecord,
  UpdateTaskData,
} from "../../src/modules/tasks/task.repository";

const PRIORITY_RANK: Record<TaskPriority, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
};

/**
 * In-memory persistence used by HTTP integration tests. Keeping the
 * repositories behind their real interfaces means the tests exercise the
 * actual Express stack, validation, controllers and services without needing
 * a running PostgreSQL instance.
 */

export class InMemoryAuthRepository implements IAuthRepository {
  readonly users: UserRecord[] = [];
  readonly refreshTokens: RefreshTokenRecord[] = [];

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    return this.users.find((user) => user.email === email) ?? null;
  }

  async findUserById(id: string): Promise<UserRecord | null> {
    return this.users.find((user) => user.id === id) ?? null;
  }

  async createUser(data: CreateUserData): Promise<UserRecord> {
    const now = new Date();
    const user: UserRecord = {
      id: randomUUID(),
      name: data.name,
      email: data.email,
      passwordHash: data.passwordHash,
      createdAt: now,
      updatedAt: now,
    };
    this.users.push(user);
    return user;
  }

  async createRefreshToken(
    data: CreateRefreshTokenData,
  ): Promise<RefreshTokenRecord> {
    const token: RefreshTokenRecord = {
      id: randomUUID(),
      tokenHash: data.tokenHash,
      userId: data.userId,
      expiresAt: data.expiresAt,
      revokedAt: null,
      createdAt: new Date(),
    };
    this.refreshTokens.push(token);
    return token;
  }

  async findRefreshTokenByHash(
    tokenHash: string,
  ): Promise<RefreshTokenWithUser | null> {
    const token = this.refreshTokens.find(
      (candidate) => candidate.tokenHash === tokenHash,
    );
    if (!token) {
      return null;
    }
    const user = this.users.find((candidate) => candidate.id === token.userId);
    return user ? { ...token, user } : null;
  }

  async revokeRefreshToken(id: string): Promise<void> {
    const token = this.refreshTokens.find((candidate) => candidate.id === id);
    if (token) {
      token.revokedAt = new Date();
    }
  }

  async revokeAllRefreshTokens(userId: string): Promise<void> {
    for (const token of this.refreshTokens) {
      if (token.userId === userId && !token.revokedAt) {
        token.revokedAt = new Date();
      }
    }
  }
}

function compareTasks(
  a: TaskRecord,
  b: TaskRecord,
  sortBy: TaskQuery["sortBy"],
  sortOrder: TaskQuery["sortOrder"],
): number {
  const direction = sortOrder === "asc" ? 1 : -1;

  switch (sortBy) {
    case "title":
      return a.title.localeCompare(b.title) * direction;
    case "priority":
      return (PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]) * direction;
    case "dueDate": {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1; // Nulls always sort last.
      if (!b.dueDate) return -1;
      return (a.dueDate.getTime() - b.dueDate.getTime()) * direction;
    }
    case "updatedAt":
      return (a.updatedAt.getTime() - b.updatedAt.getTime()) * direction;
    case "createdAt":
    default:
      return (a.createdAt.getTime() - b.createdAt.getTime()) * direction;
  }
}

export class InMemoryTaskRepository implements ITaskRepository {
  readonly tasks: TaskRecord[] = [];

  async create(data: CreateTaskData): Promise<TaskRecord> {
    const now = new Date();
    const task: TaskRecord = {
      id: randomUUID(),
      title: data.title,
      description: data.description,
      status: data.status,
      priority: data.priority,
      dueDate: data.dueDate,
      completedAt: data.completedAt,
      userId: data.userId,
      createdAt: now,
      updatedAt: now,
    };
    this.tasks.push(task);
    return task;
  }

  async findById(userId: string, id: string): Promise<TaskRecord | null> {
    return (
      this.tasks.find((task) => task.id === id && task.userId === userId) ??
      null
    );
  }

  async update(id: string, data: UpdateTaskData): Promise<TaskRecord> {
    const index = this.tasks.findIndex((task) => task.id === id);
    if (index === -1) {
      throw new Error(`Task ${id} not found`);
    }

    const current = this.tasks[index];
    const updated: TaskRecord = {
      ...current,
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined
        ? { description: data.description }
        : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.priority !== undefined ? { priority: data.priority } : {}),
      ...(data.dueDate !== undefined ? { dueDate: data.dueDate } : {}),
      ...(data.completedAt !== undefined
        ? { completedAt: data.completedAt }
        : {}),
      updatedAt: new Date(),
    };

    this.tasks[index] = updated;
    return updated;
  }

  async deleteById(userId: string, id: string): Promise<number> {
    const index = this.tasks.findIndex(
      (task) => task.id === id && task.userId === userId,
    );
    if (index === -1) {
      return 0;
    }
    this.tasks.splice(index, 1);
    return 1;
  }

  async findMany(userId: string, filters: TaskQuery): Promise<TaskPage> {
    const now = new Date();
    const search = filters.q?.toLowerCase();

    const matching = this.tasks.filter((task) => {
      if (task.userId !== userId) return false;
      if (search && !task.title.toLowerCase().includes(search)) return false;
      if (filters.status && task.status !== filters.status) return false;
      if (filters.priority && task.priority !== filters.priority) return false;
      if (
        filters.overdue &&
        !(
          task.status !== "COMPLETED" &&
          task.dueDate !== null &&
          task.dueDate.getTime() < now.getTime()
        )
      ) {
        return false;
      }
      return true;
    });

    matching.sort((a, b) =>
      compareTasks(a, b, filters.sortBy, filters.sortOrder),
    );

    const skip = (filters.page - 1) * filters.pageSize;
    return {
      items: matching.slice(skip, skip + filters.pageSize),
      total: matching.length,
    };
  }
}

export class InMemoryAttachmentRepository implements IAttachmentRepository {
  readonly attachments: AttachmentRecord[] = [];

  constructor(private readonly tasks: InMemoryTaskRepository) {}

  async create(data: CreateAttachmentData): Promise<AttachmentRecord> {
    const now = new Date();
    const attachment: AttachmentRecord = {
      id: randomUUID(),
      taskId: data.taskId,
      storageKey: data.storageKey,
      fileName: data.fileName,
      contentType: data.contentType,
      sizeBytes: data.sizeBytes,
      status: data.status,
      uploadedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.attachments.push(attachment);
    return attachment;
  }

  async findByIdForUser(
    id: string,
    taskId: string,
    userId: string,
  ): Promise<AttachmentRecord | null> {
    if (!(await this.tasks.findById(userId, taskId))) {
      return null;
    }
    return (
      this.attachments.find(
        (attachment) =>
          attachment.id === id && attachment.taskId === taskId,
      ) ?? null
    );
  }

  async findManyForTask(
    taskId: string,
    userId: string,
  ): Promise<AttachmentRecord[]> {
    if (!(await this.tasks.findById(userId, taskId))) {
      return [];
    }
    return this.attachments.filter(
      (attachment) => attachment.taskId === taskId,
    );
  }

  async markUploaded(id: string): Promise<AttachmentRecord> {
    const attachment = this.require(id);
    const updated: AttachmentRecord = {
      ...attachment,
      status: "UPLOADED",
      uploadedAt: new Date(),
      updatedAt: new Date(),
    };
    this.replace(updated);
    return updated;
  }

  async markFailed(id: string): Promise<AttachmentRecord> {
    const attachment = this.require(id);
    const updated: AttachmentRecord = {
      ...attachment,
      status: "FAILED",
      updatedAt: new Date(),
    };
    this.replace(updated);
    return updated;
  }

  async deleteByIdForUser(
    id: string,
    taskId: string,
    userId: string,
  ): Promise<number> {
    if (!(await this.tasks.findById(userId, taskId))) {
      return 0;
    }
    const index = this.attachments.findIndex(
      (attachment) => attachment.id === id && attachment.taskId === taskId,
    );
    if (index === -1) {
      return 0;
    }
    this.attachments.splice(index, 1);
    return 1;
  }

  async deleteByTaskId(taskId: string, userId: string): Promise<number> {
    if (!(await this.tasks.findById(userId, taskId))) {
      return 0;
    }
    const before = this.attachments.length;
    for (let index = this.attachments.length - 1; index >= 0; index -= 1) {
      if (this.attachments[index].taskId === taskId) {
        this.attachments.splice(index, 1);
      }
    }
    return before - this.attachments.length;
  }

  private require(id: string): AttachmentRecord {
    const attachment = this.attachments.find((candidate) => candidate.id === id);
    if (!attachment) {
      throw new Error(`Attachment ${id} not found`);
    }
    return attachment;
  }

  private replace(updated: AttachmentRecord): void {
    const index = this.attachments.findIndex(
      (attachment) => attachment.id === updated.id,
    );
    this.attachments[index] = updated;
  }
}

export class InMemoryFileStorage implements FileStorage {
  readonly objects = new Map<string, StoredObjectMetadata>();
  readonly uploadUrls: string[] = [];
  readonly deletedKeys: string[] = [];

  async createUploadUrl(options: UploadUrlOptions): Promise<string> {
    const url = `https://storage.test/${options.key}?upload=${options.expiresInSeconds}`;
    this.uploadUrls.push(url);
    return url;
  }

  async createDownloadUrl(options: DownloadUrlOptions): Promise<string> {
    return `https://storage.test/${options.key}?download=${encodeURIComponent(options.fileName)}`;
  }

  async headObject(key: string): Promise<StoredObjectMetadata | null> {
    return this.objects.get(key) ?? null;
  }

  async deleteObject(key: string): Promise<void> {
    this.deletedKeys.push(key);
    this.objects.delete(key);
  }

  put(key: string, contentLength: number, contentType: string): void {
    this.objects.set(key, { contentLength, contentType });
  }
}

function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function endOfUtcDay(date: Date): Date {
  return new Date(startOfUtcDay(date).getTime() + 24 * 60 * 60 * 1000);
}

export class InMemoryDashboardRepository implements IDashboardRepository {
  constructor(private readonly taskRepository: InMemoryTaskRepository) {}

  async getSummary(userId: string, now: Date): Promise<DashboardData> {
    const tasks = this.taskRepository.tasks.filter(
      (task) => task.userId === userId,
    );

    const byStatus: Record<TaskStatus, number> = {
      TODO: 0,
      IN_PROGRESS: 0,
      COMPLETED: 0,
    };
    const byPriority: Record<TaskPriority, number> = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
    };

    for (const task of tasks) {
      byStatus[task.status] += 1;
      byPriority[task.priority] += 1;
    }

    const openTasks = tasks.filter((task) => task.status !== "COMPLETED");
    const dayStart = startOfUtcDay(now);
    const dayEnd = endOfUtcDay(now);

    const upcoming = openTasks
      .filter((task) => task.dueDate !== null && task.dueDate >= now)
      .sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime())
      .slice(0, 5);

    const recentlyCreated = [...tasks]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 5);

    return {
      byStatus,
      byPriority,
      overdue: openTasks.filter(
        (task) => task.dueDate !== null && task.dueDate < now,
      ).length,
      dueToday: openTasks.filter(
        (task) =>
          task.dueDate !== null &&
          task.dueDate >= dayStart &&
          task.dueDate < dayEnd,
      ).length,
      upcoming,
      recentlyCreated,
    };
  }
}
