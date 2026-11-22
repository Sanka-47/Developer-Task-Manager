import type { ApiErrorDetail } from "@taskapp/shared";

import { ApiError } from "@/lib/api/client";

export function getErrorMessage(error: unknown): string {
  if (ApiError.isApiError(error)) {
    return error.message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Something went wrong. Please try again.";
}

export function getFieldErrors(
  error: unknown,
): Record<string, string> | undefined {
  if (!ApiError.isApiError(error) || error.details.length === 0) {
    return undefined;
  }

  return error.details.reduce<Record<string, string>>((accumulator, detail) => {
    if (!accumulator[detail.path]) {
      accumulator[detail.path] = detail.message;
    }
    return accumulator;
  }, {});
}

export function toErrorDetails(
  error: unknown,
): ApiErrorDetail[] | undefined {
  return ApiError.isApiError(error) ? error.details : undefined;
}
