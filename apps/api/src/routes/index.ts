import { Router } from "express";

import type { AppContainer } from "../container";
import { createAttachmentRouter } from "../modules/attachments/attachment.routes";
import { createAuthRouter } from "../modules/auth/auth.routes";
import { createDashboardRouter } from "../modules/dashboard/dashboard.routes";
import { createTaskRouter } from "../modules/tasks/task.routes";

export function createApiRouter(container: AppContainer): Router {
  const router = Router();

  router.get("/health", (_req, res) => {
    res.json({
      success: true,
      data: {
        status: "ok",
        uptimeSeconds: Math.round(process.uptime()),
        timestamp: new Date().toISOString(),
      },
    });
  });

  router.use(
    "/auth",
    createAuthRouter(container.authController, container.authenticate),
  );
  router.use(
    "/tasks",
    createTaskRouter(container.taskController, container.authenticate),
  );
  router.use(
    "/tasks",
    createAttachmentRouter(container.attachmentController, container.authenticate),
  );
  router.use(
    "/dashboard",
    createDashboardRouter(container.dashboardController, container.authenticate),
  );

  return router;
}
