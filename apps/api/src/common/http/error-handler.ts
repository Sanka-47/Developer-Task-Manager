import type { ErrorRequestHandler, RequestHandler, Response } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

import type { ApiErrorDetail } from "@taskapp/shared";

import { logger } from "../../config/logger";
import { AppError } from "../errors/app-error";

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: "NOT_FOUND",
      message: `Route ${req.method} ${req.originalUrl} was not found`,
    },
    requestId: req.requestId,
  });
};

function sendError(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  requestId: string,
  details?: ApiErrorDetail[],
): void {
  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      ...(details?.length ? { details } : {}),
    },
    requestId,
  });
}

/**
 * Single place where every error becomes an HTTP response. Expected errors
 * keep their status and message; unexpected errors are logged and masked.
 */
export const errorHandler: ErrorRequestHandler = (
  error,
  req,
  res,
  next,
) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  const requestId = req.requestId ?? "unknown";

  if (error instanceof ZodError) {
    const details: ApiErrorDetail[] = error.issues.map((issue) => ({
      path: issue.path.length ? issue.path.join(".") : "body",
      message: issue.message,
    }));
    sendError(res, 400, "VALIDATION_ERROR", "Validation failed", requestId, details);
    return;
  }

  if (error instanceof AppError) {
    sendError(
      res,
      error.statusCode,
      error.code,
      error.message,
      requestId,
      error.details,
    );
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      sendError(
        res,
        409,
        "CONFLICT",
        "A record with these details already exists",
        requestId,
      );
      return;
    }
    if (error.code === "P2025") {
      sendError(res, 404, "NOT_FOUND", "Resource not found", requestId);
      return;
    }
    if (error.code === "P2003") {
      sendError(
        res,
        400,
        "VALIDATION_ERROR",
        "A related record does not exist",
        requestId,
      );
      return;
    }
  }

  if (
    error instanceof SyntaxError &&
    "status" in error &&
    (error as SyntaxError & { status?: number }).status === 400
  ) {
    sendError(
      res,
      400,
      "VALIDATION_ERROR",
      "Request body must contain valid JSON",
      requestId,
    );
    return;
  }

  logger.error({ err: error, requestId }, "Unhandled request error");
  sendError(
    res,
    500,
    "INTERNAL_ERROR",
    "An unexpected error occurred. Please try again.",
    requestId,
  );
};
