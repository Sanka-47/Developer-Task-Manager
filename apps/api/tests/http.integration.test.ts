import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import type { AppContainer } from "../src/container";
import { createApp } from "../src/app";
import { AuthController } from "../src/modules/auth/auth.controller";
import { createAuthenticate } from "../src/modules/auth/auth.middleware";
import { AuthService } from "../src/modules/auth/auth.service";
import { PasswordService } from "../src/modules/auth/password.service";
import { TokenService } from "../src/modules/auth/token.service";
import { DashboardController } from "../src/modules/dashboard/dashboard.controller";
import { DashboardService } from "../src/modules/dashboard/dashboard.service";
import { TaskController } from "../src/modules/tasks/task.controller";
import { TaskService } from "../src/modules/tasks/task.service";
import {
  InMemoryAuthRepository,
  InMemoryDashboardRepository,
  InMemoryTaskRepository,
} from "./helpers/in-memory-repositories";

const API = "/api/v1";
const PASSWORD = "Str0ngPass!";
const ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET ??
  "integration-test-secret-that-is-long-enough-1234";

interface TestContext {
  app: ReturnType<typeof createApp>;
  authRepository: InMemoryAuthRepository;
  taskRepository: InMemoryTaskRepository;
}

function buildContext(): TestContext {
  const authRepository = new InMemoryAuthRepository();
  const taskRepository = new InMemoryTaskRepository();
  const dashboardRepository = new InMemoryDashboardRepository(taskRepository);

  const tokens = new TokenService({
    secret: ACCESS_SECRET,
    accessTtl: "15m",
  });
  const passwords = new PasswordService(4); // Keep bcrypt fast in tests.

  const authService = new AuthService({
    repository: authRepository,
    tokens,
    passwords,
    refreshTtlDays: 30,
  });
  const taskService = new TaskService({ repository: taskRepository });
  const dashboardService = new DashboardService({
    repository: dashboardRepository,
  });

  const container: AppContainer = {
    authController: new AuthController(authService),
    taskController: new TaskController(taskService),
    dashboardController: new DashboardController(dashboardService),
    authenticate: createAuthenticate(tokens),
  };

  return {
    app: createApp(container),
    authRepository,
    taskRepository,
  };
}

function readRefreshCookie(response: request.Response): string {
  const header = response.headers["set-cookie"] as unknown as
    | string[]
    | string
    | undefined;
  const cookies = Array.isArray(header) ? header : [header ?? ""];
  const cookie = cookies.find((value) => value.startsWith("taskapp_refresh="));
  expect(cookie, "refresh cookie should be set").toBeDefined();
  return cookie!.split(";")[0];
}

function bearer(token: string): string {
  return `Bearer ${token}`;
}

async function register(
  app: TestContext["app"],
  overrides: Partial<{ name: string; email: string; password: string }> = {},
): Promise<{ token: string; cookie: string; user: { id: string; email: string } }> {
  const response = await request(app)
    .post(`${API}/auth/register`)
    .send({
      name: "Test User",
      email: `user-${Math.random().toString(36).slice(2)}@example.com`,
      password: PASSWORD,
      ...overrides,
    })
    .expect(201);

  return {
    token: response.body.data.accessToken as string,
    cookie: readRefreshCookie(response),
    user: response.body.data.user as { id: string; email: string },
  };
}

describe("HTTP API integration", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = buildContext();
  });

  describe("health and routing", () => {
    it("exposes a health endpoint", async () => {
      const response = await request(ctx.app).get(`${API}/health`).expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: { status: "ok" },
      });
    });

    it("returns a structured 404 for unknown routes", async () => {
      const response = await request(ctx.app)
        .get(`${API}/does-not-exist`)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: { code: "NOT_FOUND" },
      });
      expect(response.body.requestId).toEqual(expect.any(String));
    });
  });

  describe("authentication", () => {
    it("rejects invalid registration payloads with field details", async () => {
      const response = await request(ctx.app)
        .post(`${API}/auth/register`)
        .send({ name: "A", email: "not-an-email", password: "short" })
        .expect(400);

      expect(response.body.error.code).toBe("VALIDATION_ERROR");
      expect(response.body.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "name" }),
          expect.objectContaining({ path: "email" }),
          expect.objectContaining({ path: "password" }),
        ]),
      );
    });

    it("registers a user, returns an access token and sets a scoped refresh cookie", async () => {
      const response = await request(ctx.app)
        .post(`${API}/auth/register`)
        .send({
          name: "Ada Lovelace",
          email: "ADA@Example.com",
          password: PASSWORD,
        })
        .expect(201);

      expect(response.body.data.user).toMatchObject({
        name: "Ada Lovelace",
        email: "ada@example.com",
      });
      expect(response.body.data.accessToken).toEqual(expect.any(String));

      const cookie = readRefreshCookie(response);
      expect(cookie).toMatch(/^taskapp_refresh=/);
      expect(response.headers["set-cookie"]?.join(";")).toContain(
        "Path=/api/v1/auth",
      );
      expect(response.headers["set-cookie"]?.join(";")).toContain("HttpOnly");
      expect(ctx.authRepository.users).toHaveLength(1);
      expect(ctx.authRepository.users[0].passwordHash).not.toBe(PASSWORD);
    });

    it("rejects duplicate emails with 409", async () => {
      const email = "duplicate@example.com";
      await register(ctx.app, { email });

      const response = await request(ctx.app)
        .post(`${API}/auth/register`)
        .send({ name: "Other User", email, password: PASSWORD })
        .expect(409);

      expect(response.body.error.code).toBe("CONFLICT");
    });

    it("logs in and rejects wrong credentials with the same message", async () => {
      const email = "login@example.com";
      await register(ctx.app, { email });

      const success = await request(ctx.app)
        .post(`${API}/auth/login`)
        .send({ email, password: PASSWORD })
        .expect(200);
      expect(success.body.data.user.email).toBe(email);

      const wrongPassword = await request(ctx.app)
        .post(`${API}/auth/login`)
        .send({ email, password: "Wr0ngPass!" })
        .expect(401);
      const unknownEmail = await request(ctx.app)
        .post(`${API}/auth/login`)
        .send({ email: "missing@example.com", password: PASSWORD })
        .expect(401);

      expect(wrongPassword.body.error.message).toBe(
        unknownEmail.body.error.message,
      );
    });

    it("rotates refresh tokens and revokes the session on reuse", async () => {
      const { cookie: firstCookie } = await register(ctx.app);

      const refreshed = await request(ctx.app)
        .post(`${API}/auth/refresh`)
        .set("Cookie", firstCookie)
        .expect(200);
      const secondCookie = readRefreshCookie(refreshed);
      expect(secondCookie).not.toBe(firstCookie);

      // Replaying a rotated token is treated as theft and revokes all sessions.
      await request(ctx.app)
        .post(`${API}/auth/refresh`)
        .set("Cookie", firstCookie)
        .expect(401);

      await request(ctx.app)
        .post(`${API}/auth/refresh`)
        .set("Cookie", secondCookie)
        .expect(401);
    });

    it("clears the refresh cookie on logout and prevents further refreshes", async () => {
      const { cookie } = await register(ctx.app);

      const logout = await request(ctx.app)
        .post(`${API}/auth/logout`)
        .set("Cookie", cookie)
        .expect(204);
      expect(logout.headers["set-cookie"]?.join(";")).toContain(
        "taskapp_refresh=;",
      );

      await request(ctx.app)
        .post(`${API}/auth/refresh`)
        .set("Cookie", cookie)
        .expect(401);
    });

    it("returns the current user for a valid access token only", async () => {
      const { token, user } = await register(ctx.app);

      const response = await request(ctx.app)
        .get(`${API}/auth/me`)
        .set("Authorization", bearer(token))
        .expect(200);
      expect(response.body.data).toMatchObject({
        id: user.id,
        email: user.email,
      });

      await request(ctx.app).get(`${API}/auth/me`).expect(401);
      await request(ctx.app)
        .get(`${API}/auth/me`)
        .set("Authorization", bearer("not-a-jwt"))
        .expect(401);
    });
  });

  describe("tasks", () => {
    it("requires authentication for every task endpoint", async () => {
      await request(ctx.app).get(`${API}/tasks`).expect(401);
      await request(ctx.app)
        .post(`${API}/tasks`)
        .send({ title: "Nope" })
        .expect(401);
    });

    it("creates a task and returns 201 with a Location header", async () => {
      const { token } = await register(ctx.app);
      const dueDate = new Date(Date.now() + 86_400_000).toISOString();

      const response = await request(ctx.app)
        .post(`${API}/tasks`)
        .set("Authorization", bearer(token))
        .send({
          title: "  Write the integration tests  ",
          description: "Cover the HTTP layer",
          priority: "HIGH",
          dueDate,
        })
        .expect(201);

      expect(response.headers.location).toBe(
        `${API}/tasks/${response.body.data.id}`,
      );
      expect(response.body.data).toMatchObject({
        title: "Write the integration tests",
        description: "Cover the HTTP layer",
        status: "TODO",
        priority: "HIGH",
        dueDate,
        completedAt: null,
        isOverdue: false,
      });
    });

    it("returns validation details for invalid task input", async () => {
      const { token } = await register(ctx.app);

      const missingTitle = await request(ctx.app)
        .post(`${API}/tasks`)
        .set("Authorization", bearer(token))
        .send({ description: "No title" })
        .expect(400);
      expect(missingTitle.body.error.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: "title" })]),
      );

      const invalidStatus = await request(ctx.app)
        .post(`${API}/tasks`)
        .set("Authorization", bearer(token))
        .send({ title: "Task", status: "DONE" })
        .expect(400);
      expect(invalidStatus.body.error.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: "status" })]),
      );
    });

    it("lists, searches, filters, sorts and paginates tasks", async () => {
      const { token } = await register(ctx.app);
      const create = (title: string, status: string, priority: string) =>
        request(ctx.app)
          .post(`${API}/tasks`)
          .set("Authorization", bearer(token))
          .send({ title, status, priority })
          .expect(201);

      await create("Alpha task", "TODO", "HIGH");
      await create("Beta task", "IN_PROGRESS", "LOW");
      await create("Gamma task", "TODO", "MEDIUM");

      const filtered = await request(ctx.app)
        .get(`${API}/tasks?q=alpha&status=TODO&priority=HIGH`)
        .set("Authorization", bearer(token))
        .expect(200);
      expect(filtered.body.data).toHaveLength(1);
      expect(filtered.body.data[0].title).toBe("Alpha task");
      expect(filtered.body.meta).toMatchObject({
        page: 1,
        pageSize: 10,
        total: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      });

      const firstPage = await request(ctx.app)
        .get(`${API}/tasks?page=1&pageSize=2&sortBy=title&sortOrder=asc`)
        .set("Authorization", bearer(token))
        .expect(200);
      expect(firstPage.body.data.map((task: { title: string }) => task.title)).toEqual([
        "Alpha task",
        "Beta task",
      ]);
      expect(firstPage.body.meta).toMatchObject({
        page: 1,
        pageSize: 2,
        total: 3,
        totalPages: 2,
        hasNextPage: true,
        hasPreviousPage: false,
      });

      const secondPage = await request(ctx.app)
        .get(`${API}/tasks?page=2&pageSize=2&sortBy=title&sortOrder=asc`)
        .set("Authorization", bearer(token))
        .expect(200);
      expect(secondPage.body.data.map((task: { title: string }) => task.title)).toEqual([
        "Gamma task",
      ]);
      expect(secondPage.body.meta).toMatchObject({
        hasNextPage: false,
        hasPreviousPage: true,
      });

      await request(ctx.app)
        .get(`${API}/tasks?pageSize=1000`)
        .set("Authorization", bearer(token))
        .expect(400);
    });

    it("marks overdue tasks and filters them", async () => {
      const { token } = await register(ctx.app);

      const overdue = await request(ctx.app)
        .post(`${API}/tasks`)
        .set("Authorization", bearer(token))
        .send({
          title: "Overdue task",
          dueDate: new Date(Date.now() - 86_400_000).toISOString(),
        })
        .expect(201);
      expect(overdue.body.data.isOverdue).toBe(true);

      const upcoming = await request(ctx.app)
        .post(`${API}/tasks`)
        .set("Authorization", bearer(token))
        .send({
          title: "Upcoming task",
          dueDate: new Date(Date.now() + 86_400_000).toISOString(),
        })
        .expect(201);
      expect(upcoming.body.data.isOverdue).toBe(false);

      const filtered = await request(ctx.app)
        .get(`${API}/tasks?overdue=true`)
        .set("Authorization", bearer(token))
        .expect(200);
      expect(filtered.body.meta.total).toBe(1);
      expect(filtered.body.data[0].title).toBe("Overdue task");
    });

    it("updates status and derives completedAt", async () => {
      const { token } = await register(ctx.app);
      const created = await request(ctx.app)
        .post(`${API}/tasks`)
        .set("Authorization", bearer(token))
        .send({ title: "Finish me" })
        .expect(201);
      const id = created.body.data.id as string;

      const completed = await request(ctx.app)
        .patch(`${API}/tasks/${id}/status`)
        .set("Authorization", bearer(token))
        .send({ status: "COMPLETED" })
        .expect(200);
      expect(completed.body.data.status).toBe("COMPLETED");
      expect(completed.body.data.completedAt).toEqual(expect.any(String));

      const reopened = await request(ctx.app)
        .patch(`${API}/tasks/${id}/status`)
        .set("Authorization", bearer(token))
        .send({ status: "IN_PROGRESS" })
        .expect(200);
      expect(reopened.body.data.status).toBe("IN_PROGRESS");
      expect(reopened.body.data.completedAt).toBeNull();

      await request(ctx.app)
        .patch(`${API}/tasks/${id}/status`)
        .set("Authorization", bearer(token))
        .send({ status: "DONE" })
        .expect(400);
    });

    it("rejects empty updates and returns 404 for unknown tasks", async () => {
      const { token } = await register(ctx.app);
      const created = await request(ctx.app)
        .post(`${API}/tasks`)
        .set("Authorization", bearer(token))
        .send({ title: "Editable" })
        .expect(201);

      await request(ctx.app)
        .patch(`${API}/tasks/${created.body.data.id}`)
        .set("Authorization", bearer(token))
        .send({})
        .expect(400);

      await request(ctx.app)
        .get(`${API}/tasks/00000000-0000-0000-0000-000000000000`)
        .set("Authorization", bearer(token))
        .expect(404);
    });

    it("deletes a task and returns 404 afterwards", async () => {
      const { token } = await register(ctx.app);
      const created = await request(ctx.app)
        .post(`${API}/tasks`)
        .set("Authorization", bearer(token))
        .send({ title: "Temporary" })
        .expect(201);
      const id = created.body.data.id as string;

      await request(ctx.app)
        .delete(`${API}/tasks/${id}`)
        .set("Authorization", bearer(token))
        .expect(204);

      await request(ctx.app)
        .get(`${API}/tasks/${id}`)
        .set("Authorization", bearer(token))
        .expect(404);
      await request(ctx.app)
        .delete(`${API}/tasks/${id}`)
        .set("Authorization", bearer(token))
        .expect(404);
    });

    it("prevents users from reading or modifying each other's tasks", async () => {
      const owner = await register(ctx.app, { email: "owner@example.com" });
      const other = await register(ctx.app, { email: "other@example.com" });

      const created = await request(ctx.app)
        .post(`${API}/tasks`)
        .set("Authorization", bearer(owner.token))
        .send({ title: "Private task" })
        .expect(201);
      const id = created.body.data.id as string;

      await request(ctx.app)
        .get(`${API}/tasks/${id}`)
        .set("Authorization", bearer(other.token))
        .expect(404);
      await request(ctx.app)
        .patch(`${API}/tasks/${id}`)
        .set("Authorization", bearer(other.token))
        .send({ title: "Hijacked" })
        .expect(404);
      await request(ctx.app)
        .delete(`${API}/tasks/${id}`)
        .set("Authorization", bearer(other.token))
        .expect(404);

      const ownerView = await request(ctx.app)
        .get(`${API}/tasks/${id}`)
        .set("Authorization", bearer(owner.token))
        .expect(200);
      expect(ownerView.body.data.title).toBe("Private task");
    });
  });

  describe("dashboard", () => {
    it("summarises the authenticated user's tasks", async () => {
      const { token } = await register(ctx.app);
      const create = (body: Record<string, unknown>) =>
        request(ctx.app)
          .post(`${API}/tasks`)
          .set("Authorization", bearer(token))
          .send(body)
          .expect(201);

      await create({ title: "Todo", status: "TODO", priority: "HIGH" });
      await create({
        title: "Doing",
        status: "IN_PROGRESS",
        priority: "MEDIUM",
      });
      await create({
        title: "Done",
        status: "COMPLETED",
        priority: "LOW",
      });

      const response = await request(ctx.app)
        .get(`${API}/dashboard`)
        .set("Authorization", bearer(token))
        .expect(200);

      expect(response.body.data).toMatchObject({
        total: 3,
        pending: 1,
        inProgress: 1,
        completed: 1,
        completionRate: 33,
        byStatus: { TODO: 1, IN_PROGRESS: 1, COMPLETED: 1 },
        byPriority: { LOW: 1, MEDIUM: 1, HIGH: 1 },
      });
      expect(response.body.data.recentlyCreated).toHaveLength(3);
    });

    it("requires authentication", async () => {
      await request(ctx.app).get(`${API}/dashboard`).expect(401);
    });
  });
});
