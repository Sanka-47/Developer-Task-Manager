import { Router } from "express";
import type { RequestHandler } from "express";

import {
  attachmentParamsSchema,
  attachmentTaskParamsSchema,
  createAttachmentSchema,
} from "@taskapp/shared";

import { asyncHandler } from "../../common/http/async-handler";
import { validate } from "../../common/http/validate";
import type { AttachmentController } from "./attachment.controller";

export function createAttachmentRouter(
  controller: AttachmentController,
  authenticate: RequestHandler,
): Router {
  const router = Router();

  router.use(authenticate);

  router.get(
    "/:taskId/attachments",
    validate({ params: attachmentTaskParamsSchema }),
    asyncHandler(controller.list),
  );

  router.post(
    "/:taskId/attachments",
    validate({
      params: attachmentTaskParamsSchema,
      body: createAttachmentSchema,
    }),
    asyncHandler(controller.createUpload),
  );

  router.post(
    "/:taskId/attachments/:attachmentId/complete",
    validate({ params: attachmentParamsSchema }),
    asyncHandler(controller.complete),
  );

  router.get(
    "/:taskId/attachments/:attachmentId/download-url",
    validate({ params: attachmentParamsSchema }),
    asyncHandler(controller.downloadUrl),
  );

  router.delete(
    "/:taskId/attachments/:attachmentId",
    validate({ params: attachmentParamsSchema }),
    asyncHandler(controller.delete),
  );

  return router;
}
