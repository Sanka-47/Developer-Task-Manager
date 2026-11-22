import { Router } from "express";
import type { RequestHandler } from "express";

import { asyncHandler } from "../../common/http/async-handler";
import type { DashboardController } from "./dashboard.controller";

export function createDashboardRouter(
  controller: DashboardController,
  authenticate: RequestHandler,
): Router {
  const router = Router();

  router.use(authenticate);
  router.get("/", asyncHandler(controller.getSummary));

  return router;
}
