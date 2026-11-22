import type { Request, Response } from "express";
import type {
  CreateTaskInput,
  TaskQuery,
  UpdateTaskInput,
  UpdateTaskStatusInput,
} from "@taskapp/shared";

import {
  sendNoContent,
  sendSuccess,
} from "../../common/http/api-response";
import { requireAuth } from "../auth/auth.middleware";
import type { TaskService } from "./task.service";
import { TaskMapper } from "./task.mapper";

interface TaskIdParams {
  id: string;
}

export class TaskController {
  constructor(private readonly service: TaskService) {}

  list = async (req: Request, res: Response): Promise<void> => {
    const { userId } = requireAuth(req);
    const query = req.validated.query as TaskQuery;
    const result = await this.service.list(userId, query);

    sendSuccess(res, result.data, 200, result.meta);
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    const { userId } = requireAuth(req);
    const { id } = req.validated.params as TaskIdParams;
    const task = await this.service.getById(userId, id);

    sendSuccess(res, task);
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const { userId } = requireAuth(req);
    const input = req.validated.body as CreateTaskInput;
    const task = await this.service.create(
      userId,
      TaskMapper.fromCreateInput(input),
    );

    res.setHeader("Location", `/api/v1/tasks/${task.id}`);
    sendSuccess(res, task, 201);
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const { userId } = requireAuth(req);
    const { id } = req.validated.params as TaskIdParams;
    const input = req.validated.body as UpdateTaskInput;
    const task = await this.service.update(
      userId,
      id,
      TaskMapper.fromUpdateInput(input),
    );

    sendSuccess(res, task);
  };

  updateStatus = async (req: Request, res: Response): Promise<void> => {
    const { userId } = requireAuth(req);
    const { id } = req.validated.params as TaskIdParams;
    const input = req.validated.body as UpdateTaskStatusInput;
    const task = await this.service.updateStatus(userId, id, input);

    sendSuccess(res, task);
  };

  delete = async (req: Request, res: Response): Promise<void> => {
    const { userId } = requireAuth(req);
    const { id } = req.validated.params as TaskIdParams;
    await this.service.delete(userId, id);

    sendNoContent(res);
  };
}
