import type { PrismaClient } from "@prisma/client";
import type { TaskPriority, TaskStatus } from "@taskapp/shared";

import { endOfUtcDay, startOfUtcDay } from "../../common/utils/date";
import type { TaskRecord } from "../tasks/task.repository";

export interface DashboardData {
  byStatus: Record<TaskStatus, number>;
  byPriority: Record<TaskPriority, number>;
  overdue: number;
  dueToday: number;
  upcoming: TaskRecord[];
  recentlyCreated: TaskRecord[];
}

export interface IDashboardRepository {
  getSummary(userId: string, now: Date): Promise<DashboardData>;
}

const UPCOMING_LIMIT = 5;
const RECENT_LIMIT = 5;

export class PrismaDashboardRepository implements IDashboardRepository {
  constructor(private readonly db: PrismaClient) {}

  async getSummary(userId: string, now: Date): Promise<DashboardData> {
    const dayStart = startOfUtcDay(now);
    const dayEnd = endOfUtcDay(now);

    const [
      statusGroups,
      priorityGroups,
      overdue,
      dueToday,
      upcoming,
      recentlyCreated,
    ] = await Promise.all([
      this.db.task.groupBy({
        by: ["status"],
        where: { userId },
        _count: { _all: true },
      }),
      this.db.task.groupBy({
        by: ["priority"],
        where: { userId },
        _count: { _all: true },
      }),
      this.db.task.count({
        where: {
          userId,
          status: { not: "COMPLETED" },
          dueDate: { lt: now },
        },
      }),
      this.db.task.count({
        where: {
          userId,
          status: { not: "COMPLETED" },
          dueDate: { gte: dayStart, lt: dayEnd },
        },
      }),
      this.db.task.findMany({
        where: {
          userId,
          status: { not: "COMPLETED" },
          dueDate: { gte: now },
        },
        orderBy: { dueDate: "asc" },
        take: UPCOMING_LIMIT,
      }),
      this.db.task.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: RECENT_LIMIT,
      }),
    ]);

    const byStatus: Record<TaskStatus, number> = {
      TODO: 0,
      IN_PROGRESS: 0,
      COMPLETED: 0,
    };
    for (const group of statusGroups) {
      byStatus[group.status] = group._count._all;
    }

    const byPriority: Record<TaskPriority, number> = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
    };
    for (const group of priorityGroups) {
      byPriority[group.priority] = group._count._all;
    }

    return {
      byStatus,
      byPriority,
      overdue,
      dueToday,
      upcoming,
      recentlyCreated,
    };
  }
}
