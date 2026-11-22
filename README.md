# TaskApp

A full-stack task management application built with **Next.js**, **Express**, **PostgreSQL** and **Prisma**. It includes JWT authentication, a dashboard, full task CRUD, search/filter/sort/pagination, a Kanban board with drag and drop, dark/light themes, optimistic updates and automated tests.

---

## Quick start

### Prerequisites

- Node.js **20.9+** (tested on 22.17)
- Docker Desktop (for PostgreSQL)
- npm **10+**

### One command

```bash
npm run setup
npm run dev
```

`npm run setup` creates `.env` files from the examples, installs dependencies, builds the shared package, starts PostgreSQL, applies migrations and seeds 26 demo tasks.

Then open:

| Service | URL |
| --- | --- |
| Web app | http://localhost:3100 |
| API | http://localhost:4200/api/v1 |
| PostgreSQL | `localhost:5433` |

**Demo account:** `demo@taskapp.dev` / `Demo1234!`

### Manual setup

```bash
npm install
npm run setup:env          # copies .env.example files if missing
npm run build:shared
npm run db:up
npm run db:migrate
npm run db:seed
npm run dev
```

The database container listens on host port **5433** by default so it does not clash with a local PostgreSQL already using 5432. Override it with `POSTGRES_PORT` and update `DATABASE_URL` in `apps/api/.env` if needed.

---

## Features

### Functional

- **Dashboard** — total, pending, in-progress, completed, overdue, due-today, completion rate, status/priority breakdowns, upcoming and recently created tasks.
- **Task CRUD** — create, view details, edit, delete, change status.
- **Task listing** — responsive table on desktop, cards on mobile, search by title, status/priority filters, overdue filter, sorting by created/updated/due date/title/priority, pagination.
- **Task fields** — title, description, status, priority, due date, created at, updated at, plus derived `isOverdue` and `completedAt`.
- **Forms** — client and server validation, field-level server errors, pending/disabled states that prevent duplicate submissions.
- **Auth** — register, login, silent session restore, logout, protected routes.

### Bonus

- Kanban board with drag-and-drop (`@dnd-kit`).
- Optimistic status changes and deletes with rollback on failure.
- Dark/light theme with system preference support.
- Accessible dialogs, menus, forms and focus states.
- Unit, component and HTTP integration tests.
- Security hardening: refresh-token rotation with reuse detection, bcrypt, Helmet, CORS allow-list, rate limiting, per-user data isolation, request IDs.

---

## Tech stack

| Layer | Choice |
| --- | --- |
| Frontend | Next.js 16 App Router, React 19, TypeScript |
| Styling | Tailwind CSS 4, CSS design tokens, `next-themes` |
| Data fetching | TanStack Query 5 |
| Forms | React Hook Form + Zod |
| Drag and drop | `@dnd-kit` |
| Backend | Express 5, TypeScript (CommonJS build) |
| Database | PostgreSQL 16, Prisma 6 |
| Validation | Zod 4 (shared schemas) |
| Testing | Vitest, Testing Library, Supertest |
| Logging | Pino + `pino-http` |

---

## UI
### Dashboard

<img width="1912" height="1130" alt="image" src="https://github.com/user-attachments/assets/aa1d40bb-29aa-4559-b44c-684c2d859efd" />

### Tasks

<img width="1912" height="1113" alt="image" src="https://github.com/user-attachments/assets/411c4bbc-4c49-4dbd-9a18-9240acd9d63f" />

### Board

<img width="1912" height="1651" alt="image" src="https://github.com/user-attachments/assets/6a6916c9-7cb5-4686-b5a9-87c1d7c87f13" />



## Project structure

```text
TaskApp/
├─ apps/
│  ├─ api/
│  │  ├─ prisma/
│  │  │  ├─ schema.prisma          # models, enums, indexes
│  │  │  ├─ migrations/            # committed SQL migrations
│  │  │  └─ seed.ts                # demo user + 26 tasks
│  │  ├─ src/
│  │  │  ├─ modules/
│  │  │  │  ├─ auth/               # routes, controller, service, repository,
│  │  │  │  │                      # DTOs, mapper, middleware, cookies, tokens
│  │  │  │  ├─ tasks/              # routes, controller, service, repository,
│  │  │  │  │                      # DTOs, mapper
│  │  │  │  └─ dashboard/          # routes, controller, service, repository
│  │  │  ├─ common/                # errors, HTTP helpers, validation, middleware
│  │  │  ├─ config/                # env validation, logger
│  │  │  ├─ lib/                   # Prisma client
│  │  │  ├─ routes/                # API router composition
│  │  │  ├─ app.ts                 # Express app factory
│  │  │  ├─ container.ts           # composition root / dependency wiring
│  │  │  └─ server.ts              # HTTP server + graceful shutdown
│  │  └─ tests/                    # HTTP integration tests + in-memory repos
│  └─ web/
│     ├─ src/
│     │  ├─ app/                   # App Router pages, layouts, providers
│     │  ├─ components/            # auth, dashboard, tasks, layout, UI primitives
│     │  ├─ hooks/                 # queries, mutations, filters, debouncing
│     │  ├─ lib/
│     │  │  ├─ api/                # fetch client + service layer
│     │  │  ├─ auth/               # auth context, in-memory token store
│     │  │  ├─ query/              # query client + key factory
│     │  │  ├─ utils/              # cn, dates, error formatting
│     │  │  └─ validation/         # task form schema
│     │  └─ app/globals.css        # design tokens and theme
├─ packages/
│  └─ shared/                      # enums, Zod schemas, DTO/API types
├─ scripts/setup-env.mjs
├─ docker-compose.yml
└─ package.json                    # npm workspaces + root scripts
```

---

## Architecture

### Backend request flow

```text
HTTP request
  → route (Express Router)
  → validation middleware (shared Zod schema)
  → authentication middleware (JWT)
  → controller (HTTP only)
  → service (business rules)
  → repository interface
  → Prisma repository (database only)
  → mapper (entity → DTO)
  → consistent JSON response
```

Key points:

- **Dependency inversion** — services depend on `IAuthRepository`, `ITaskRepository` and `IDashboardRepository`; Prisma implementations are injected in `container.ts`. This is what makes the HTTP integration tests run without a database.
- **Single composition root** — all repositories, services and controllers are constructed in `container.ts`.
- **Centralized errors** — `AppError` subclasses (`NotFoundError`, `ConflictError`, `UnauthorizedError`) and Zod errors become consistent responses in `error-handler.ts`. Unexpected errors are logged and masked.
- **Response envelope** — every success and error uses the same shape:

```json
{
  "success": true,
  "data": {},
  "meta": { "page": 1, "pageSize": 10, "total": 26, "totalPages": 3, "hasNextPage": true, "hasPreviousPage": false }
}
```

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [{ "path": "title", "message": "Title is required" }]
  },
  "requestId": "..."
}
```

### Database

- `User` 1—N `Task` (cascade delete).
- `User` 1—N `RefreshToken` (cascade delete).
- Enums `task_status` and `task_priority`.
- Unique index on `users.email` and `refresh_tokens.token_hash`.
- Composite indexes for the common filters: `(user_id, status)`, `(user_id, priority)`, `(user_id, created_at desc)`, `(user_id, due_date)`.
- `overdue` is **derived** (`dueDate < now && status !== COMPLETED`), never stored, so it cannot become stale.

### Authentication

- Access token: short-lived JWT, kept **only in React memory** (never `localStorage`).
- Refresh token: opaque random token in an `httpOnly`, `SameSite=Lax` cookie scoped to `/api/v1/auth`.
- Only a SHA-256 hash of the refresh token is stored in the database.
- Every refresh rotates the token. Reusing a rotated token is treated as theft and revokes **all** sessions for that user.
- On page load the client calls `/auth/refresh` once; the API client also performs a single-flight refresh and retries the original request once after a 401.
- Next.js rewrites `/api/*` to Express, so the browser is same-origin and the cookie is same-site.

### Frontend

- App Router with server components for layouts/pages and client components only where interactivity is required.
- Pages compose feature views; feature views use hooks; hooks use the API service layer.
- TanStack Query owns server state; URL search params own filter/sort/page state, so views are shareable and refresh-safe.
- Optimistic mutations update the task cache immediately and roll back on error.
- Shared Zod schemas keep client and server validation aligned.

---

## API reference

Base URL: `/api/v1`

### Auth

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/auth/register` | Create an account and start a session |
| `POST` | `/auth/login` | Sign in |
| `POST` | `/auth/refresh` | Rotate the refresh token and issue a new access token |
| `POST` | `/auth/logout` | Revoke the current refresh token and clear the cookie |
| `GET` | `/auth/me` | Current user (requires bearer token) |

### Tasks (all require `Authorization: Bearer <token>`)

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/tasks` | List with search/filter/sort/pagination |
| `POST` | `/tasks` | Create a task |
| `GET` | `/tasks/:id` | Get task details |
| `PATCH` | `/tasks/:id` | Update any editable field |
| `PATCH` | `/tasks/:id/status` | Change status only |
| `DELETE` | `/tasks/:id` | Delete a task |

Query parameters for `GET /tasks`:

| Parameter | Values | Default |
| --- | --- | --- |
| `page` | integer ≥ 1 | `1` |
| `pageSize` | 1–100 | `10` |
| `q` | title search, max 120 chars | — |
| `status` | `TODO`, `IN_PROGRESS`, `COMPLETED` | — |
| `priority` | `LOW`, `MEDIUM`, `HIGH` | — |
| `overdue` | `true`, `false` | — |
| `sortBy` | `createdAt`, `updatedAt`, `dueDate`, `title`, `priority` | `createdAt` |
| `sortOrder` | `asc`, `desc` | `desc` |

### Dashboard and health

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/dashboard` | Aggregated stats for the current user |
| `GET` | `/health` | Liveness probe |

### Status codes

`200` OK · `201` Created · `204` No Content · `400` Validation · `401` Unauthorized · `404` Not Found · `409` Conflict · `429` Rate Limited · `500` Internal Error.

---

## Scripts

| Command | Description |
| --- | --- |
| `npm run setup` | Env files, install, shared build, DB up, migrate, seed |
| `npm run dev` | Shared watch + API + web together |
| `npm run build` | Build shared, API and web |
| `npm start` | Start built API and web |
| `npm run typecheck` | Typecheck all workspaces |
| `npm test` | Run all tests |
| `npm run db:up` / `db:down` | Start/stop PostgreSQL |
| `npm run db:migrate` | Apply Prisma migrations |
| `npm run db:seed` | Seed demo data |
| `npm run db:reset` | Reset database and re-seed |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:logs` | Follow PostgreSQL logs |

Workspace-specific commands are also available, e.g. `npm run test -w @taskapp/api`.

---

## Testing

```bash
npm test
```

- **API — 39 tests**
  - Service unit tests for auth, tasks and mappers.
  - HTTP integration tests with Supertest covering registration, login, refresh rotation/reuse detection, logout, auth guards, task CRUD, validation errors, filtering/sorting/pagination, overdue derivation, user isolation and dashboard aggregation.
  - Integration tests use in-memory repositories through the real service/controller/route stack, so **no database is required**.
- **Web — 20 tests**
  - API client error/refresh behavior.
  - Task form schema and payload conversion.
  - Pagination component, task badges and date utilities.

Tests run with `NODE_ENV=test` and a dedicated setup file, so they never read a developer `.env` or touch a real database.

---

## Environment variables

### `apps/api/.env`

| Variable | Default | Notes |
| --- | --- | --- |
| `NODE_ENV` | `development` | `development`, `test`, `production` |
| `PORT` | `4200` | API port |
| `DATABASE_URL` | `postgresql://taskapp:taskapp@localhost:5433/taskapp?schema=public` | Must match Compose port |
| `JWT_ACCESS_SECRET` | — | **Required**, at least 32 chars |
| `JWT_ACCESS_TTL` | `15m` | Access token lifetime |
| `REFRESH_TOKEN_TTL_DAYS` | `30` | Refresh token lifetime |
| `CORS_ORIGINS` | `http://localhost:3100` | Comma-separated allow-list |
| `COOKIE_DOMAIN` | — | Optional cookie domain |
| `BCRYPT_ROUNDS` | `12` | Password hashing cost |
| `LOG_LEVEL` | `info` | Pino level |

### `apps/web/.env.local`

| Variable | Default | Notes |
| --- | --- | --- |
| `API_ORIGIN` | `http://localhost:4200` | Server-side rewrite target |
| `NEXT_PUBLIC_API_BASE_URL` | `/api/v1` | Browser API base; keep relative to use the proxy |

---

## Security notes

- Refresh tokens are random, hashed at rest and rotated on every use; reuse revokes the whole session family.
- Access tokens are never persisted in browser storage.
- Passwords use bcrypt (cost 12 by default) and are never returned by the API.
- Login errors do not reveal whether an email exists.
- Every task query is scoped by `userId`; cross-user reads and writes return `404`.
- Helmet sets security headers; CORS is allow-listed; auth endpoints are rate limited.
- All input is parsed and sanitized with shared Zod schemas; Prisma parameterizes queries.
- Unexpected errors are logged with a request ID and masked in responses.
- The refresh cookie is `httpOnly`, `SameSite=Lax` and path-scoped to auth endpoints.

---

## Troubleshooting

### PostgreSQL port already in use

The default host port is `5433`. To use another port:

```bash
# PowerShell
$env:POSTGRES_PORT="5434"; docker compose up -d
```

Then update `DATABASE_URL` in `apps/api/.env`.

### API port unavailable on Windows

Windows may reserve port ranges. Check them with:

```powershell
netsh interface ipv4 show excludedportrange protocol=tcp
```

If the API port is excluded, change `PORT` in `apps/api/.env` **and** `API_ORIGIN` in `apps/web/.env.local` to the same new port.

### npm install fails with peer-dependency errors

The repository includes `.npmrc` with `legacy-peer-deps=true`, which is required for the current Next/React/Vitest peer graph. Keep it.

### Vitest cannot find `jsdom`

`jsdom` is declared in both the web workspace and the root dev dependencies because Vitest is hoisted to the root in npm workspaces. Keep both entries.

### Prisma deprecation warning

Prisma 6 warns that `package.json#prisma` will move to `prisma.config.ts` in Prisma 7. It is harmless for this Prisma 6 project.

---

## Specification checklist

| Requirement | Status |
| --- | --- |
| Dashboard totals, statuses, priorities, overdue | ✅ |
| Task create / view / update / delete / status change | ✅ |
| Listing table/layout, search, filter, sort, pagination | ✅ |
| All required task fields | ✅ |
| Form validation, server errors, duplicate-submit prevention | ✅ |
| Backend routes/controllers/services/repositories/DTOs/mappers/schemas/validations | ✅ |
| REST design, status codes, centralized errors, async handling | ✅ |
| Prisma schema, relationships, constraints, indexes | ✅ |
| Environment-based configuration and security | ✅ |
| Component-based frontend with pages/layouts/components/hooks/services/utils | ✅ |
| Responsive, accessible UI with loading/empty/error states | ✅ |
| Separate API service layer and centralized error handling | ✅ |
| Server/client state management without redundant requests | ✅ |
| TypeScript and Next.js conventions | ✅ |
| Kanban board and drag-and-drop | ✅ |
| Dark/light themes | ✅ |
| Optimistic UI updates | ✅ |
| Unit and integration tests | ✅ |
