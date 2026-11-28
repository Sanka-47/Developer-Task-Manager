import type { ApiErrorCode, ApiErrorDetail } from "@taskapp/shared";

/**
 * Base class for expected, operational errors. Anything that is not an
 * `AppError` is treated as an unexpected failure and hidden behind a 500.
 */
export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly details?: ApiErrorDetail[],
  ) {
    super(message);
    this.name = new.target.name;
    Error.captureStackTrace?.(this, new.target);
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation failed", details?: ApiErrorDetail[]) {
    super(400, "VALIDATION_ERROR", message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super(401, "UNAUTHORIZED", message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have access to this resource") {
    super(403, "FORBIDDEN", message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(404, "NOT_FOUND", message);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Resource already exists") {
    super(409, "CONFLICT", message);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = "Too many requests. Please try again later.") {
    super(429, "TOO_MANY_REQUESTS", message);
  }
}

export class StorageError extends AppError {
  constructor(message = "File storage is unavailable. Please try again.") {
    super(502, "STORAGE_ERROR", message);
  }
}
