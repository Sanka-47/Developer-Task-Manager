import type { DashboardSummary } from "@taskapp/shared";

import { TaskMapper } from "../tasks/task.mapper";
import type { DashboardData, IDashboardRepository } from "./dashboard.repository";

export interface DashboardServiceDependencies {
  repository: IDashboardRepository;
  now?: () => Date;
}

export class DashboardService {
  private readonly repository: IDashboardRepository;
  private readonly now: () => Date;

  constructor(dependencies: DashboardServiceDependencies) {
    this.repository = dependencies.repository;
    this.now = dependencies.now ?? (() => new Date());
  }

  async getSummary(userId: string): Promise<DashboardSummary> {
    const now = this.now();
    const data = await this.repository.getSummary(userId, now);
    const summary = this.buildSummary(data, now);

    return summary;
  }

  private buildSummary(data: DashboardData, now: Date): DashboardSummary {
    const { byStatus, byPriority } = data;
    const total =
      byStatus.TODO + byStatus.IN_PROGRESS + byStatus.COMPLETED;

    return {
      total,
      pending: byStatus.TODO,
      inProgress: byStatus.IN_PROGRESS,
      completed: byStatus.COMPLETED,
      overdue: data.overdue,
      dueToday: data.dueToday,
      completionRate:
        total === 0 ? 0 : Math.round((byStatus.COMPLETED / total) * 100),
      byStatus,
      byPriority,
      upcoming: TaskMapper.toDtoList(data.upcoming, now),
      recentlyCreated: TaskMapper.toDtoList(data.recentlyCreated, now),
    };
  }
}
