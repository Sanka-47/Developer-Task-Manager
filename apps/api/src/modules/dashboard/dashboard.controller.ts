import type { Request, Response } from "express";

import { sendSuccess } from "../../common/http/api-response";
import { requireAuth } from "../auth/auth.middleware";
import type { DashboardService } from "./dashboard.service";

export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  getSummary = async (req: Request, res: Response): Promise<void> => {
    const { userId } = requireAuth(req);
    const summary = await this.service.getSummary(userId);

    sendSuccess(res, summary);
  };
}
