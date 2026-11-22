import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { tokenStore } from "@/lib/auth/token-store";
import {
  ApiError,
  apiRequest,
  onSessionExpired,
} from "./client";

function mockResponse(status: number, body?: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => body,
  } as unknown as Response;
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  tokenStore.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiRequest", () => {
  it("attaches the in-memory access token", async () => {
    tokenStore.set("access-token-1");
    fetchMock.mockResolvedValueOnce(
      mockResponse(200, { success: true, data: { id: "task_1" } }),
    );

    const response = await apiRequest<{ id: string }>("/tasks");

    expect(response.data.id).toBe("task_1");
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = init.headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer access-token-1");
    expect(headers.get("Content-Type")).toBeNull();
  });

  it("serialises JSON bodies and sets the content type", async () => {
    tokenStore.set("token");
    fetchMock.mockResolvedValueOnce(
      mockResponse(201, { success: true, data: { id: "task_1" } }),
    );

    await apiRequest("/tasks", {
      method: "POST",
      body: { title: "New task" },
    });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.body).toBe(JSON.stringify({ title: "New task" }));
    expect((init.headers as Headers).get("Content-Type")).toBe(
      "application/json",
    );
  });

  it("normalises API errors with field details", async () => {
    fetchMock.mockResolvedValueOnce(
      mockResponse(400, {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Validation failed",
          details: [{ path: "title", message: "Title is required" }],
        },
        requestId: "req-1",
      }),
    );

    const error = await apiRequest("/tasks").catch((caught) => caught);

    expect(error).toBeInstanceOf(ApiError);
    const apiError = error as ApiError;
    expect(apiError.status).toBe(400);
    expect(apiError.code).toBe("VALIDATION_ERROR");
    expect(apiError.details).toEqual([
      { path: "title", message: "Title is required" },
    ]);
    expect(apiError.requestId).toBe("req-1");
  });

  it("wraps network failures in a NETWORK_ERROR", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    const error = await apiRequest("/tasks").catch((caught) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(0);
    expect((error as ApiError).code).toBe("NETWORK_ERROR");
  });

  it("refreshes once on 401 and retries with the new token", async () => {
    tokenStore.set("expired-token");

    fetchMock
      .mockResolvedValueOnce(
        mockResponse(401, {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Expired" },
        }),
      )
      .mockResolvedValueOnce(
        mockResponse(200, {
          success: true,
          data: {
            user: {
              id: "user_1",
              name: "Test",
              email: "test@example.com",
              createdAt: "2026-01-01T00:00:00.000Z",
            },
            accessToken: "fresh-token",
          },
        }),
      )
      .mockResolvedValueOnce(
        mockResponse(200, { success: true, data: { ok: true } }),
      );

    const response = await apiRequest<{ ok: boolean }>("/tasks");

    expect(response.data.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/v1/auth/refresh");

    const retryHeaders = fetchMock.mock.calls[2]?.[1]?.headers as Headers;
    expect(retryHeaders.get("Authorization")).toBe("Bearer fresh-token");
  });

  it("emits a session-expired event when the refresh fails", async () => {
    const listener = vi.fn();
    const unsubscribe = onSessionExpired(listener);
    tokenStore.set("expired-token");

    fetchMock
      .mockResolvedValueOnce(
        mockResponse(401, {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Expired" },
        }),
      )
      .mockResolvedValueOnce(
        mockResponse(401, {
          success: false,
          error: { code: "UNAUTHORIZED", message: "No session" },
        }),
      );

    await expect(apiRequest("/tasks")).rejects.toBeInstanceOf(ApiError);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(tokenStore.get()).toBeNull();
    unsubscribe();
  });
});
