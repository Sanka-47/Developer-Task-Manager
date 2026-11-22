import type { RequestHandler } from "express";
import type { PrismaClient } from "@prisma/client";

import { env } from "./config/env";
import { prisma } from "./lib/prisma";
import { AuthController } from "./modules/auth/auth.controller";
import { PrismaAuthRepository } from "./modules/auth/auth.repository";
import { createAuthenticate } from "./modules/auth/auth.middleware";
import { AuthService } from "./modules/auth/auth.service";
import { PasswordService } from "./modules/auth/password.service";
import { TokenService } from "./modules/auth/token.service";
import { DashboardController } from "./modules/dashboard/dashboard.controller";
import { PrismaDashboardRepository } from "./modules/dashboard/dashboard.repository";
import { DashboardService } from "./modules/dashboard/dashboard.service";
import { TaskController } from "./modules/tasks/task.controller";
import { PrismaTaskRepository } from "./modules/tasks/task.repository";
import { TaskService } from "./modules/tasks/task.service";

export interface AppContainer {
  authController: AuthController;
  taskController: TaskController;
  dashboardController: DashboardController;
  authenticate: RequestHandler;
}

/**
 * Composition root. Every dependency is constructed explicitly here, which
 * keeps modules decoupled and makes it easy to swap implementations in tests.
 */
export function createContainer(db: PrismaClient = prisma): AppContainer {
  const tokens = new TokenService({
    secret: env.JWT_ACCESS_SECRET,
    accessTtl: env.JWT_ACCESS_TTL,
  });
  const passwords = new PasswordService(env.BCRYPT_ROUNDS);

  const authRepository = new PrismaAuthRepository(db);
  const authService = new AuthService({
    repository: authRepository,
    tokens,
    passwords,
    refreshTtlDays: env.REFRESH_TOKEN_TTL_DAYS,
  });

  const taskRepository = new PrismaTaskRepository(db);
  const taskService = new TaskService({ repository: taskRepository });

  const dashboardRepository = new PrismaDashboardRepository(db);
  const dashboardService = new DashboardService({
    repository: dashboardRepository,
  });

  return {
    authController: new AuthController(authService),
    taskController: new TaskController(taskService),
    dashboardController: new DashboardController(dashboardService),
    authenticate: createAuthenticate(tokens),
  };
}
