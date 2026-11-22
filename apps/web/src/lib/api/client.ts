import type {
  ApiErrorCode,
  ApiErrorDetail,
  ApiErrorResponse,
  ApiSuccessResponse,
  AuthSession,
} from "@taskapp/shared";

import { tokenStore } from "@/lib/auth/token-store";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/v1";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly details: ApiErrorDetail[] = [],
    readonly requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }

  static isApiError(error: unknown): error is ApiError {
    return error instanceof ApiError;
  }
}

export interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** Attach the in-memory access token. Defaults to true. */
  auth?: boolean;
  /** Internal flag used to avoid refresh loops. */
  skipRefresh?: boolean;
}

const SESSION_EXPIRED_EVENT = "taskapp:session-expired";

function emitSessionExpired(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  }
}

export function onSessionExpired(listener: () => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  window.addEventListener(SESSION_EXPIRED_EVENT, listener);
  return () => window.removeEventListener(SESSION_EXPIRED_EVENT, listener);
}

let refreshPromise: Promise<AuthSession | null> | null = null;

async function performRefresh(): Promise<AuthSession | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      tokenStore.clear();
      return null;
    }

    const payload = (await response.json()) as ApiSuccessResponse<AuthSession>;
    tokenStore.set(payload.data.accessToken);
    return payload.data;
  } catch {
    tokenStore.clear();
    return null;
  }
}

/**
 * Refreshes the session at most once at a time. Concurrent 401s share the
 * same promise, so the rotating refresh token is never consumed twice.
 */
export function refreshSession(): Promise<AuthSession | null> {
  if (!refreshPromise) {
    refreshPromise = performRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function fallbackMessage(status: number): string {
  if (status === 401) {
    return "Your session has expired. Please sign in again.";
  }
  if (status === 403) {
    return "You do not have permission to perform this action.";
  }
  if (status === 404) {
    return "The requested resource was not found.";
  }
  if (status === 429) {
    return "Too many requests. Please wait a moment and try again.";
  }
  if (status >= 500) {
    return "Something went wrong on our side. Please try again.";
  }
  return "The request could not be completed.";
}

/**
 * Centralised fetch wrapper: JSON encoding, auth header, one retry after a
 * silent token refresh, and normalised `ApiError` instances.
 */
export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiSuccessResponse<T>> {
  const {
    body,
    auth = true,
    skipRefresh = false,
    headers,
    ...rest
  } = options;

  const requestHeaders = new Headers(headers);
  requestHeaders.set("Accept", "application/json");

  if (body !== undefined) {
    requestHeaders.set("Content-Type", "application/json");
  }

  const token = tokenStore.get();
  if (auth && token) {
    requestHeaders.set("Authorization", `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...rest,
      headers: requestHeaders,
      credentials: "include",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(
      0,
      "NETWORK_ERROR",
      "Unable to reach the server. Check your connection and try again.",
    );
  }

  if (response.status === 401 && auth && !skipRefresh && token) {
    let session: AuthSession | null = null;
    try {
      session = await refreshSession();
    } catch {
      session = null;
    }

    if (session) {
      return apiRequest<T>(path, { ...options, skipRefresh: true });
    }

    emitSessionExpired();
  }

  if (response.status === 204) {
    return { success: true, data: undefined as T };
  }

  const payload = await safeJson(response);

  if (!response.ok) {
    const errorBody = payload as ApiErrorResponse | null;
    throw new ApiError(
      response.status,
      errorBody?.error?.code ?? "INTERNAL_ERROR",
      errorBody?.error?.message ?? fallbackMessage(response.status),
      errorBody?.error?.details ?? [],
      errorBody?.requestId ?? response.headers.get("x-request-id") ?? undefined,
    );
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    (payload as ApiSuccessResponse<T>).success !== true
  ) {
    throw new ApiError(
      response.status,
      "INTERNAL_ERROR",
      "The server returned an unexpected response.",
    );
  }

  return payload as ApiSuccessResponse<T>;
}
