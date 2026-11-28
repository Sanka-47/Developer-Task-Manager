# TaskApp

A full-stack task management application built with **Next.js**, **Express**, **PostgreSQL** and **Prisma**. It includes JWT authentication, a dashboard, full task CRUD, search/filter/sort/pagination, a Kanban board with drag and drop, dark/light themes, optimistic updates, private S3 attachments and automated tests.

The repository also contains the complete AWS deployment extension: Docker images, a production-shaped local stack, Terraform for VPC/EC2/ALB/RDS/S3/CloudWatch/ECR/SSM, and GitHub Actions CI/CD with OIDC. The infrastructure has been formatted and validated locally; applying it requires AWS credentials and a Route 53 hosted zone.

---

## Quick start

### Prerequisites

- Node.js **20.9+** (tested on 22.17)
- Docker Desktop (PostgreSQL and LocalStack)
- npm **10+**

### One command

```bash
npm run setup
npm run dev
```

`npm run setup` creates `.env` files from the examples, installs dependencies, builds the shared package, starts PostgreSQL and LocalStack, applies migrations and seeds 26 demo tasks.

Then open:

| Service | URL |
| --- | --- |
| Web app | http://localhost:3100 |
| API | http://localhost:4200/api/v1 |
| PostgreSQL | `localhost:5433` |
| LocalStack S3 | http://localhost:4566 |

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

The database container listens on host port **5433** by default so it does not clash with a local PostgreSQL already using 5432. Override it with `POSTGRES_PORT` and update `DATABASE_URL` in `apps/api/.env` if needed. LocalStack listens on **4566**; the bucket and CORS rules are created automatically by `scripts/localstack-init.sh`.

### Production-shaped Docker stack

The local production stack mirrors the AWS topology more closely: a Next.js standalone container, an Express container, PostgreSQL, LocalStack and a one-off migration image.

```bash
npm run docker:build
npm run docker:up
npm run docker:seed
```

| Service | URL |
| --- | --- |
| Web app | http://localhost:3101 |
| API | http://localhost:4201/api/v1 |
| PostgreSQL | `localhost:5434` |
| LocalStack S3 | http://localhost:4567 |

Stop it with `npm run docker:down`. The stack uses the isolated Compose project `taskapp-prod`, so it does not collide with the developer services on 3100/4200/5433/4566.

---

## AWS deployment

The deployment is implemented in Terraform under [`infra/`](./infra/) and documented in detail in [`KNOWLEDGE.md`](./KNOWLEDGE.md). It creates:

- A VPC with two public subnets for the ALB and two private subnets for RDS.
- Security groups that allow only HTTP/HTTPS to the ALB, app ports from the ALB, and PostgreSQL from the app security group. There is no inbound SSH.
- A private, encrypted, versioned S3 bucket with CORS, lifecycle rules and Block Public Access.
- A least-privilege EC2 role, instance profile, ECR repositories and CloudWatch log groups.
- A KMS key and SSM `SecureString` parameters for the database URL, JWT secret, bucket name and CORS origin.
- An EC2 instance running the web and API containers, an Elastic IP, an ALB with HTTPS, ACM validation and a Route 53 alias.
- A private RDS PostgreSQL instance with encryption, backups and SSL enforcement.
- CloudWatch alarms, an SNS topic and an AWS Budgets alarm.
- An optional GitHub OIDC deploy role.

### Deploy from scratch

```bash
# 1. Create the encrypted Terraform state bucket once.
cd infra/bootstrap
cp terraform.tfvars.example terraform.tfvars   # edit values
terraform init
terraform apply

# 2. Configure the main stack.
cd ..
cp backend.hcl.example backend.hcl             # set bucket and region
cp terraform.tfvars.example terraform.tfvars   # domain, zone, email, GitHub repo
terraform init -backend-config=backend.hcl
terraform fmt -recursive
terraform validate
terraform plan -out=tfplan
terraform apply tfplan
```

Push the first images and deploy through GitHub Actions by setting the repository secret `AWS_DEPLOY_ROLE_ARN` to the `github_deploy_role_arn` output. A successful CI run on `main` builds and pushes the API, web and migrator images, then runs `/opt/taskapp/deploy.sh <sha>` through SSM Run Command.

The stack is designed to be destroyed after the demo:

```bash
cd infra
terraform destroy
```

The S3 bucket and ECR repositories use `force_delete`/`force_destroy` outside `prod`, and RDS has no deletion protection in the demo, so teardown does not leave billable resources behind.

---

## Features

### Functional

- **Dashboard** — total, pending, in-progress, completed, overdue, due-today, completion rate, status/priority breakdowns, upcoming and recently created tasks.
- **Task CRUD** — create, view details, edit, delete, change status.
- **Task listing** — responsive table on desktop, cards on mobile, search by title, status/priority filters, overdue filter, sorting by created/updated/due date/title/priority, pagination.
- **Task fields** — title, description, status, priority, due date, created at, updated at, plus derived `isOverdue` and `completedAt`.
- **Forms** — client and server validation, field-level server errors, pending/disabled states that prevent duplicate submissions.
- **Auth** — register, login, silent session restore, logout, protected routes.
- **Attachments** — upload images, PDF, text, CSV, ZIP and DOCX files up to 25 MB directly to private S3 with pre-signed URLs; list, download and delete them from the task details view.

### Bonus

- Kanban board with drag-and-drop (`@dnd-kit`).
- Optimistic status changes, deletes and attachment deletes with rollback on failure.
- Dark/light theme with system preference support.
- Accessible dialogs, menus, forms and focus states.
- Unit, component and HTTP integration tests.
- Security hardening: refresh-token rotation with reuse detection, bcrypt, Helmet, CORS allow-list, rate limiting, per-user data isolation, request IDs and private object storage.

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
| File storage | Private S3 (LocalStack locally) with pre-signed URLs |
| Validation | Zod 4 (shared schemas) |
| Testing | Vitest, Testing Library, Supertest |
| Logging | Pino + `pino-http` |
| Containers | Docker multi-stage builds, Next.js standalone output |
| Infrastructure | Terraform, AWS EC2, ALB, RDS, S3, ECR, CloudWatch, SSM, KMS |
| CI/CD | GitHub Actions, OIDC, ECR, SSM Run Command |

---

## UI

### Dashboard

<img width="1912" height="994" alt="TaskApp dashboard" src="https://github.com/user-attachments/assets/f6e595a0-e342-44a5-bba2-ad6cdbe0f01b" />

### Tasks

<img width="1912" height="994" alt="TaskApp task list" src="https://github.com/user-attachments/assets/4e4b42c9-59a3-4cbf-acf6-3b3abea7437e" />

### Board

<img width="1912" height="994" alt="TaskApp Kanban board" src="https://github.com/user-attachments/assets/42935ae3-e2c1-4b13-9b46-cf5cb07471e3" />

---

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
│  │  │  │  ├─ attachments/        # storage port, S3 adapter, repository,
│  │  │  │  │                      # service, controller, routes
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
│     └─ src/
│        ├─ app/                   # App Router pages, layouts, providers
│        ├─ components/            # auth, dashboard, tasks, layout, UI primitives
│        ├─ hooks/                 # queries, mutations, filters, debouncing
│        ├─ lib/
│        │  ├─ api/                # fetch client + service layer
│        │  ├─ auth/               # auth context, in-memory token store
│        │  ├─ query/              # query client + key factory
│        │  ├─ utils/              # cn, dates, errors, files
│        │  └─ validation/         # task form schema
│        └─ app/globals.css        # design tokens and theme
├─ packages/
│  └─ shared/                      # enums, Zod schemas, DTO/API types
├─ infra/                          # Terraform stack + bootstrap + user data
├─ deploy/                         # EC2 Compose file with CloudWatch logging
├─ scripts/                        # env setup, LocalStack init, Docker tags
├─ .github/workflows/              # CI and OIDC deploy workflows
├─ Dockerfile.api                  # API runtime + migrator targets
├─ Dockerfile.web                  # Next.js standalone runtime
├─ docker-compose.yml              # local PostgreSQL + LocalStack
├─ docker-compose.prod.yml         # production-shaped local stack
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

- **Dependency inversion** — services depend on repository and storage interfaces; Prisma and S3 implementations are injected in `container.ts`. This is what makes the HTTP integration tests run without a database or S3.
- **Single composition root** — all repositories, services, controllers and the storage adapter are constructed in `container.ts`.
- **Centralized errors** — `AppError` subclasses (`NotFoundError`, `ConflictError`, `UnauthorizedError`, `ValidationError`, `StorageError`) and Zod errors become consistent responses in `error-handler.ts`. Unexpected errors are logged and masked.
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

### Attachment flow

```text
Browser                     Express API                    S3 / LocalStack
   │                             │                              │
   │ POST /tasks/:id/attachments │                              │
   │────────────────────────────>│ create PENDING row           │
   │                             │ sign short-lived PUT URL     │
   │<────────────────────────────│                              │
   │ PUT file + Content-Type     │                              │
   │────────────────────────────────────────────────────────────>│
   │ POST .../complete           │                              │
   │────────────────────────────>│ HeadObject, verify size/type │
   │                             │─────────────────────────────>│
   │                             │ mark UPLOADED                │
   │<────────────────────────────│                              │
   │ GET .../download-url        │                              │
   │────────────────────────────>│ sign short-lived GET URL     │
   │<────────────────────────────│                              │
   │ GET pre-signed URL          │                              │
   │────────────────────────────────────────────────────────────>│
```

The API never receives file bytes. Upload and download URLs expire after five minutes by default, are never logged, and are not stored in the database. Deleting an attachment or its task removes the S3 object before the metadata row is deleted.

### Database

- `User` 1–N `Task` (cascade delete).
- `User` 1–N `RefreshToken` (cascade delete).
- `Task` 1–N `Attachment` (cascade delete).
- Enums `task_status`, `task_priority` and `attachment_status`.
- Unique indexes on `users.email`, `refresh_tokens.token_hash` and `attachments.storage_key`.
- Composite indexes for the common filters: `(user_id, status)`, `(user_id, priority)`, `(user_id, created_at desc)`, `(user_id, due_date)` and `(task_id, created_at)`.
- `overdue` is **derived** (`dueDate < now && status !== COMPLETED`), never stored, so it cannot become stale.

### Authentication

- Access token: short-lived JWT, kept **only in React memory** (never `localStorage`).
- Refresh token: opaque random token in an `httpOnly`, `SameSite=Lax` cookie scoped to `/api/v1/auth`.
- Only a SHA-256 hash of the refresh token is stored in the database.
- Every refresh rotates the token. Reusing a rotated token is treated as theft and revokes **all** sessions for that user.
- On page load the client calls `/auth/refresh` once; the API client also performs a single-flight refresh and retries the original request once after a 401.
- Next.js rewrites `/api/*` to Express locally, so the browser is same-origin and the cookie is same-site. In AWS the ALB routes `/api/*` directly to the API target group.

### Frontend

- App Router with server components for layouts/pages and client components only where interactivity is required.
- Pages compose feature views; feature views use hooks; hooks use the API service layer.
- TanStack Query owns server state; URL search params own filter/sort/page state, so views are shareable and refresh-safe.
- Optimistic mutations update the cache immediately and roll back on error.
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
| `DELETE` | `/tasks/:id` | Delete a task and its attachment objects |

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

### Attachments (all require `Authorization: Bearer <token>`)

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/tasks/:taskId/attachments` | List attachments for a task |
| `POST` | `/tasks/:taskId/attachments` | Create upload metadata and return a pre-signed PUT URL |
| `POST` | `/tasks/:taskId/attachments/:attachmentId/complete` | Verify the object and mark it `UPLOADED` |
| `GET` | `/tasks/:taskId/attachments/:attachmentId/download-url` | Return a short-lived pre-signed GET URL |
| `DELETE` | `/tasks/:taskId/attachments/:attachmentId` | Delete the object and metadata |

Allowed content types: PNG, JPEG, WebP, PDF, plain text, CSV, ZIP and DOCX. Maximum size: 25 MB.

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
| `npm run setup` | Env files, install, shared build, DB/LocalStack up, migrate, seed |
| `npm run dev` | Shared watch + API + web together |
| `npm run build` | Build shared, API and web |
| `npm start` | Start built API and web |
| `npm run typecheck` | Typecheck all workspaces |
| `npm test` | Run all tests |
| `npm run db:up` / `db:down` | Start/stop PostgreSQL and LocalStack |
| `npm run db:migrate` | Apply Prisma migrations |
| `npm run db:seed` | Seed demo data |
| `npm run db:reset` | Reset database and re-seed |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:logs` | Follow PostgreSQL logs |
| `npm run docker:build` | Build SHA-tagged production images |
| `npm run docker:up` | Start the production-shaped local stack |
| `npm run docker:seed` | Run the seed against the production stack |
| `npm run docker:down` | Stop the production-shaped stack |

Workspace-specific commands are also available, e.g. `npm run test -w @taskapp/api`.

---

## Testing

```bash
npm test
```

- **API — 46 tests**
  - Service unit tests for auth, tasks, attachments and mappers.
  - HTTP integration tests with Supertest covering registration, login, refresh rotation/reuse detection, logout, auth guards, task CRUD, validation errors, filtering/sorting/pagination, overdue derivation, user isolation, dashboard aggregation and the full attachment lifecycle.
  - Attachment tests cover invalid metadata, oversized files, missing objects, content-type mismatches, cross-user `404`s and S3 cleanup when a task is deleted.
  - Integration tests use in-memory repositories and an in-memory `FileStorage`, so **no database or S3 is required**.
- **Web — 23 tests**
  - API client error/refresh behavior.
  - Task form schema and payload conversion.
  - Pagination component, task badges, date utilities and file helpers.

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
| `AWS_REGION` | `us-east-1` | S3 region; on EC2 this comes from the instance role |
| `S3_BUCKET` | `taskapp-attachments` | Private attachment bucket |
| `S3_KEY_PREFIX` | `attachments` | Object key prefix |
| `S3_UPLOAD_URL_TTL_SECONDS` | `300` | Pre-signed PUT lifetime |
| `S3_DOWNLOAD_URL_TTL_SECONDS` | `300` | Pre-signed GET lifetime |
| `S3_MAX_FILE_BYTES` | `26214400` | 25 MB upload limit |
| `S3_ENDPOINT_URL` | — | LocalStack endpoint |
| `S3_PUBLIC_ENDPOINT_URL` | — | Browser-facing endpoint for pre-signed URLs when the API runs in Docker |
| `S3_FORCE_PATH_STYLE` | `false` | `true` for LocalStack |

### `apps/web/.env.local`

| Variable | Default | Notes |
| --- | --- | --- |
| `API_ORIGIN` | `http://localhost:4200` | Server-side rewrite target |
| `NEXT_PUBLIC_API_BASE_URL` | `/api/v1` | Browser API base; keep relative to use the proxy |

In AWS, the API reads `DATABASE_URL`, `JWT_ACCESS_SECRET`, `S3_BUCKET` and `CORS_ORIGINS` from SSM Parameter Store during EC2 bootstrap. No long-lived AWS access keys are stored in `.env`, images, GitHub secrets or the repository; the EC2 instance profile supplies credentials.

---

## Security notes

- Refresh tokens are random, hashed at rest and rotated on every use; reuse revokes the whole session family.
- Access tokens are never persisted in browser storage.
- Passwords use bcrypt (cost 12 by default) and are never returned by the API.
- Login errors do not reveal whether an email exists.
- Every task and attachment query is scoped by `userId`; cross-user reads and writes return `404`.
- Helmet sets security headers; CORS is allow-listed; auth endpoints are rate limited.
- All input is parsed and sanitized with shared Zod schemas; Prisma parameterizes queries.
- Unexpected errors are logged with a request ID and masked in responses.
- The refresh cookie is `httpOnly`, `SameSite=Lax` and path-scoped to auth endpoints.
- S3 is private, encrypted and versioned. The browser only receives short-lived pre-signed URLs.
- The ALB is the only public entry point. RDS is private, and no security group allows inbound SSH.
- GitHub Actions deploys with OIDC; no long-lived AWS credentials are stored in GitHub.

---

## Troubleshooting

### PostgreSQL port already in use

The default host port is `5433`. To use another port:

```powershell
$env:POSTGRES_PORT="5434"; docker compose up -d
```

Then update `DATABASE_URL` in `apps/api/.env`.

### API port unavailable on Windows

Windows may reserve port ranges. Check them with:

```powershell
netsh interface ipv4 show excludedportrange protocol=tcp
```

If the API port is excluded, change `PORT` in `apps/api/.env` **and** `API_ORIGIN` in `apps/web/.env.local` to the same new port.

### Docker Desktop is not running

Start Docker Desktop and wait until the engine is healthy:

```powershell
docker version
```

If Docker Desktop reports that the `com.docker.service` service is stopped and cannot start, start Docker Desktop with administrator privileges or start the service manually from an elevated terminal:

```powershell
Start-Service com.docker.service
```

### LocalStack bucket is missing

The init script runs when the container becomes ready. Check it with:

```bash
docker compose logs localstack
docker compose exec localstack awslocal s3 ls
```

If needed, recreate the services:

```bash
npm run db:down
npm run db:up
```

### npm install fails with peer-dependency errors

The repository includes `.npmrc` with `legacy-peer-deps=true`, which is required for the current Next/React/Vitest peer graph. Keep it.

### Vitest cannot find `jsdom`

`jsdom` is declared in both the web workspace and the root dev dependencies because Vitest is hoisted to the root in npm workspaces. Keep both entries.

### Prisma deprecation warning

Prisma 6 warns that `package.json#prisma` will move to `prisma.config.ts` in Prisma 7. It is harmless for this Prisma 6 project.

### Terraform plan needs credentials

`terraform validate` works without AWS credentials. `terraform plan` and `terraform apply` need an authenticated AWS identity with permission to create the resources in `infra/`. See `infra/README.md` for the bootstrap and backend configuration steps.

---

## Specification checklist

| Requirement | Status |
| --- | --- |
| Dashboard totals, statuses, priorities, overdue | Complete |
| Task create / view / update / delete / status change | Complete |
| Listing table/layout, search, filter, sort, pagination | Complete |
| All required task fields | Complete |
| Form validation, server errors, duplicate-submit prevention | Complete |
| Backend routes/controllers/services/repositories/DTOs/mappers/schemas/validations | Complete |
| REST design, status codes, centralized errors, async handling | Complete |
| Prisma schema, relationships, constraints, indexes | Complete |
| Environment-based configuration and security | Complete |
| Component-based frontend with pages/layouts/components/hooks/services/utils | Complete |
| Responsive, accessible UI with loading/empty/error states | Complete |
| Separate API service layer and centralized error handling | Complete |
| Server/client state management without redundant requests | Complete |
| TypeScript and Next.js conventions | Complete |
| Kanban board and drag-and-drop | Complete |
| Dark/light themes | Complete |
| Optimistic UI updates | Complete |
| Unit and integration tests | Complete |
| Private S3 attachments with pre-signed URLs | Complete |
| Docker images and production-shaped local stack | Complete |
| Terraform infrastructure and AWS security controls | Implemented; live apply pending AWS credentials |
| GitHub Actions CI and OIDC deploy workflow | Implemented; first live deploy pending AWS credentials |
