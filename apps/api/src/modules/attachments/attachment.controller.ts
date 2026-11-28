import type { Request, Response } from "express";
import type { CreateAttachmentInput } from "@taskapp/shared";

import {
  sendNoContent,
  sendSuccess,
} from "../../common/http/api-response";
import { requireAuth } from "../auth/auth.middleware";
import type { AttachmentService } from "./attachment.service";

interface AttachmentTaskParams {
  taskId: string;
}

interface AttachmentParams extends AttachmentTaskParams {
  attachmentId: string;
}

export class AttachmentController {
  constructor(private readonly service: AttachmentService) {}

  list = async (req: Request, res: Response): Promise<void> => {
    const { userId } = requireAuth(req);
    const { taskId } = req.validated.params as AttachmentTaskParams;
    const attachments = await this.service.list(userId, taskId);

    sendSuccess(res, attachments);
  };

  createUpload = async (req: Request, res: Response): Promise<void> => {
    const { userId } = requireAuth(req);
    const { taskId } = req.validated.params as AttachmentTaskParams;
    const input = req.validated.body as CreateAttachmentInput;
    const result = await this.service.createUpload(userId, taskId, input);

    res.setHeader(
      "Location",
      `/api/v1/tasks/${taskId}/attachments/${result.attachment.id}`,
    );
    sendSuccess(res, result, 201);
  };

  complete = async (req: Request, res: Response): Promise<void> => {
    const { userId } = requireAuth(req);
    const { taskId, attachmentId } = req.validated.params as AttachmentParams;
    const attachment = await this.service.complete(
      userId,
      taskId,
      attachmentId,
    );

    sendSuccess(res, attachment);
  };

  downloadUrl = async (req: Request, res: Response): Promise<void> => {
    const { userId } = requireAuth(req);
    const { taskId, attachmentId } = req.validated.params as AttachmentParams;
    const result = await this.service.createDownloadUrl(
      userId,
      taskId,
      attachmentId,
    );

    sendSuccess(res, result);
  };

  delete = async (req: Request, res: Response): Promise<void> => {
    const { userId } = requireAuth(req);
    const { taskId, attachmentId } = req.validated.params as AttachmentParams;
    await this.service.delete(userId, taskId, attachmentId);

    sendNoContent(res);
  };
}
