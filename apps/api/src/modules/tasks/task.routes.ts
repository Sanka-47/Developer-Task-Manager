import { Router } from "express";
import type { RequestHandler } from "express";

import {
  createTaskSchema,
  taskIdParamSchema,
  taskQuerySchema,
  updateTaskSchema,
  updateTaskStatusSchema,
} from "@taskapp/shared";

import { asyncHandler } from "../../common/http/async-handler";
import { validate } from "../../common/http/validate";
import type { TaskController } from "./task.controller";

export function createTaskRouter(
  controller: TaskController,
  authenticate: RequestHandler,
): Router {
  const router = Router();

  router.use(authenticate);

  router.get(
    "/",
    validate({ query: taskQuerySchema }),
    asyncHandler(controller.list),
  );

  router.post(
    "/",
    validate({ body: createTaskSchema }),
    asyncHandler(controller.create),
  );

  router.get(
    "/:id",
    validate({ params: taskIdParamSchema }),
    asyncHandler(controller.getById),
  );

  router.patch(
    "/:id",
    validate({ params: taskIdParamSchema, body: updateTaskSchema }),
    asyncHandler(controller.update),
  );

  router.patch(
    "/:id/status",
    validate({ params: taskIdParamSchema, body: updateTaskStatusSchema }),
    asyncHandler(controller.updateStatus),
  );

  router.delete(
    "/:id",
    validate({ params: taskIdParamSchema }),
    asyncHandler(controller.delete),
  );

  return router;
}
