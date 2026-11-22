import type { Response } from "express";
import type { PaginationMeta } from "@taskapp/shared";

export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode = 200,
  meta?: PaginationMeta,
): void {
  res.status(statusCode).json({
    success: true,
    data,
    ...(meta ? { meta } : {}),
  });
}

export function sendNoContent(res: Response): void {
  res.status(204).end();
}
