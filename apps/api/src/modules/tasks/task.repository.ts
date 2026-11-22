import type { Prisma, PrismaClient } from "@prisma/client";
import type {
  SortOrder,
  TaskPriority,
  TaskQuery,
  TaskSortField,
  TaskStatus,
} from "@taskapp/shared";

export interface TaskRecord {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: Date | null;
  completedAt: Date | null;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTaskData {
  userId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: Date | null;
  completedAt: Date | null;
}

export interface UpdateTaskData {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: Date | null;
  completedAt?: Date | null;
}

export interface TaskPage {
  items: TaskRecord[];
  total: number;
}

export interface ITaskRepository {
  create(data: CreateTaskData): Promise<TaskRecord>;
  findById(userId: string, id: string): Promise<TaskRecord | null>;
  update(id: string, data: UpdateTaskData): Promise<TaskRecord>;
  deleteById(userId: string, id: string): Promise<number>;
  findMany(userId: string, filters: TaskQuery): Promise<TaskPage>;
}

function buildOrderBy(
  sortBy: TaskSortField,
  sortOrder: SortOrder,
): Prisma.TaskOrderByWithRelationInput[] {
  const direction: Prisma.SortOrder = sortOrder;

  switch (sortBy) {
    case "dueDate":
      return [
        { dueDate: { sort: direction, nulls: "last" } },
        { createdAt: "desc" },
      ];
    case "title":
      return [{ title: direction }, { id: "asc" }];
    case "priority":
      return [{ priority: direction }, { createdAt: "desc" }];
    case "updatedAt":
      return [{ updatedAt: direction }, { id: "asc" }];
    case "createdAt":
    default:
      return [{ createdAt: direction }, { id: "asc" }];
  }
}

function buildWhere(
  userId: string,
  filters: TaskQuery,
  now: Date,
): Prisma.TaskWhereInput {
  const conditions: Prisma.TaskWhereInput[] = [{ userId }];

  if (filters.q) {
    conditions.push({ title: { contains: filters.q, mode: "insensitive" } });
  }
  if (filters.status) {
    conditions.push({ status: filters.status });
  }
  if (filters.priority) {
    conditions.push({ priority: filters.priority });
  }
  if (filters.overdue) {
    conditions.push({ status: { not: "COMPLETED" }, dueDate: { lt: now } });
  }

  return { AND: conditions };
}

export class PrismaTaskRepository implements ITaskRepository {
  constructor(private readonly db: PrismaClient) {}

  create(data: CreateTaskData): Promise<TaskRecord> {
    return this.db.task.create({
      data: {
        userId: data.userId,
        title: data.title,
        description: data.description,
        status: data.status,
        priority: data.priority,
        dueDate: data.dueDate,
        completedAt: data.completedAt,
      },
    });
  }

  findById(userId: string, id: string): Promise<TaskRecord | null> {
    return this.db.task.findFirst({ where: { id, userId } });
  }

  update(id: string, data: UpdateTaskData): Promise<TaskRecord> {
    return this.db.task.update({
      where: { id },
      data: {
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
      },
    });
  }

  async deleteById(userId: string, id: string): Promise<number> {
    const result = await this.db.task.deleteMany({ where: { id, userId } });
    return result.count;
  }

  async findMany(userId: string, filters: TaskQuery): Promise<TaskPage> {
    const where = buildWhere(userId, filters, new Date());
    const orderBy = buildOrderBy(filters.sortBy, filters.sortOrder);
    const skip = (filters.page - 1) * filters.pageSize;

    const [items, total] = await this.db.$transaction([
      this.db.task.findMany({
        where,
        orderBy,
        skip,
        take: filters.pageSize,
      }),
      this.db.task.count({ where }),
    ]);

    return { items, total };
  }
}
