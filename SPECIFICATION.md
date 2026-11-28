# Assignment: Full-Stack Task Management Application

> **Status: Core assignment complete** — implemented in `apps/api`, `apps/web` and `packages/shared`. See `README.md` for setup, architecture and API documentation.
>
> **AWS deployment extension: implemented, live AWS apply pending** — attachments, containers, Terraform, CloudWatch configuration and GitHub Actions workflows are in the repository and pass local checks. `terraform plan`/`apply`, the first ECR push, and the live HTTPS smoke test require AWS credentials and a Route 53 hosted zone. See `KNOWLEDGE.md` for the learning guide and `infra/README.md` for the deployment runbook.

## Technology Stack
* [x] **Frontend:** Next.js / React.js
* [x] **Backend:** Node.js / Express.js
* [x] **Database:** PostgreSQL
* [x] **ORM:** Prisma
* [x] **Language:** TypeScript / JavaScript

---

## 1. Functional Requirements
Develop a modern, responsive Task Management Application with the following functionality:

### 1.1 Dashboard
* [x] Display total tasks.
* [x] Display completed, pending, and in-progress tasks.
* [x] Display overdue tasks.
* [x] Provide an overview of task statuses and priorities.

### 1.2 Task Management (CRUD)
* [x] Create new tasks.
* [x] View task details.
* [x] Update existing tasks.
* [x] Delete tasks.
* [x] Update task statuses.

### 1.3 Task Listing
* [x] Display tasks in a structured table or appropriate layout.
* [x] Search tasks by title.
* [x] Filter tasks by status and priority.
* [x] Sort tasks by creation date and due date.
* [x] Implement pagination.

### 1.4 Task Details
Each task should contain the following information:
* [x] **Title**
* [x] **Description**
* [x] **Status** (`TODO`, `IN_PROGRESS`, `COMPLETED`)
* [x] **Priority** (`LOW`, `MEDIUM`, `HIGH`)
* [x] **Due Date**
* [x] **Created At**
* [x] **Updated At**

### 1.5 Form Management
* [x] Implement proper form handling.
* [x] Validate user inputs.
* [x] Display meaningful validation messages.
* [x] Handle server-side validation errors.
* [x] Prevent duplicate form submissions.

---

## 2. Backend Technical & Architectural Requirements
The backend must follow standard software engineering principles, including **OOP**, **modular development**, **clean code**, **SOLID principles**, and **separation of concerns**.

### Module Structure
The backend should have clearly separated modules for:
* [x] **Routes:** Define API endpoints and route configurations.
* [x] **Controllers:** Handle HTTP requests and responses.
* [x] **Services:** Contain all business logic.
* [x] **Repositories:** Handle database operations exclusively.
* [x] **DTOs:** Define data transfer objects for requests and responses.
* [x] **Mappers:** Handle transformations between database entities, DTOs, and response objects.
* [x] **Schemas:** Define request and response data structures where appropriate.
* [x] **Validations:** Handle request validation and input constraints.

### Additional Backend Expectations
* [x] Proper REST API design and HTTP status codes.
* [x] Centralized error handling and consistent API responses.
* [x] Input validation and data sanitization.
* [x] Proper database schema design and relationships using Prisma.
* [x] Appropriate database constraints and indexes.
* [x] Environment-based configuration management.
* [x] Proper handling of asynchronous operations.
* [x] Secure and maintainable code practices.
* [x] Separation of business logic from database operations:
  * [x] **Controllers** handle HTTP requests and responses.
  * [x] **Services** contain business logic.
  * [x] **Repositories** exclusively handle database interactions.

---

## 3. Frontend Technical & Architectural Requirements
The frontend should demonstrate good UI/UX practices, reusable component design, maintainable architecture, and proper integration with the backend.

### 3.1 Component-Based Architecture
* [x] Properly structured and reusable components.
* [x] Separation of pages, layouts, components, hooks, services, and utilities.
* [x] Avoid unnecessary code duplication.
* [x] Maintain clear component responsibilities.

### 3.2 UI/UX Design
* [x] Develop a clean, modern, and professional user interface.
* [x] Responsive design supporting desktop, tablet, and mobile devices.
* [x] Consistent typography, spacing, colors, and component styling.
* [x] Proper handling of loading states, empty states, and error states.
* [x] User-friendly navigation and interactions.
* [x] Follow accessibility and semantic HTML best practices.

### 3.3 API Integration
* [x] Maintain a separate API service layer.
* [x] Properly handle API requests and responses.
* [x] Centralized API configuration and error handling.
* [x] Handle network errors and unexpected server responses.
* [x] Avoid placing API request logic directly inside reusable UI components.

### 3.4 State Management
* [x] Appropriate state management for application-wide and component-level states.
* [x] Proper handling of server state and client state.
* [x] Avoid unnecessary API requests and redundant state.

### 3.5 Frontend Best Practices
* [x] Use TypeScript.
* [x] Follow appropriate Next.js / React.js conventions.
* [x] Proper handling of environment variables.
* [x] Avoid unnecessary client-side rendering.
* [x] Maintain consistent coding standards and reusable architecture.

---

## 4. Additional Considerations
The following features are optional but will be considered advantages:
* [x] Kanban board view.
* [x] Drag-and-drop task management.
* [x] Dark and light themes.
* [x] Optimistic UI updates.
* [x] Unit and integration testing.
* [x] Additional security and performance optimizations.
* [x] Private S3 attachments with pre-signed upload/download URLs.
* [x] Production-shaped Docker stack and deployment automation.

---

## 5. AWS Deployment Extension

> **Status: Implemented in code; live AWS verification pending.** The phases below were implemented in order. Items marked `[x]` are implemented and verified locally (tests, `terraform fmt`, `terraform validate`, Docker builds/smoke tests where Docker was available). Items marked `[ ]` require an AWS account, credentials, a domain/Route 53 zone, or a live deployment. See `KNOWLEDGE.md` and `infra/README.md`.

### 5.1 Locked architecture decisions

* [x] **IaC tool:** Terraform
* [x] **Frontend hosting:** Next.js container on EC2
* [x] **API hosting:** Express container on EC2 behind an Application Load Balancer
* [x] **Database:** PostgreSQL on RDS in private subnets
* [x] **File storage:** Private S3 bucket with short-lived pre-signed upload/download URLs
* [x] **Admin access:** SSM Session Manager instead of public SSH
* [x] **Observability:** CloudWatch Logs and alarms
* [x] **Container registry:** ECR
* [x] **Secrets:** SSM Parameter Store SecureString + KMS
* [x] **TLS:** ACM certificate on the ALB
* [x] **Demo topology:** One EC2 instance runs both containers; ALB routes `/api/*` to the API target group and everything else to the web target group

### 5.2 Execution rules

* [x] Work through the phases in order; do not start a phase until the previous phase passes its acceptance criteria.
* [x] Keep the existing layered backend architecture: routes → controllers → services → repositories, with DTOs, mappers, schemas and validations.
* [x] Keep the existing frontend separation: pages, layouts, components, hooks, services and utilities.
* [x] No long-lived AWS access keys in `.env`, Docker images, GitHub secrets or the repository.
* [x] No public S3 bucket, no publicly accessible RDS instance and no inbound SSH from `0.0.0.0/0`.
* [ ] Review `terraform plan` before every `terraform apply` — plan requires AWS credentials.
* [ ] Run `terraform destroy` after the demo and confirm no billable resources remain.
* [x] Update `README.md` and `KNOWLEDGE.md` whenever the implementation diverges from the plan.
* [x] Do not mark a phase complete until its tests, smoke checks and acceptance criteria pass.

### 5.3 Phase 1 — Task attachments without AWS

Goal: implement the attachment domain and UI against a local S3-compatible service before adding AWS infrastructure.

* [x] Add `AttachmentStatus` and `Attachment` to the Prisma schema with task relation, cascade delete, indexes and a unique `storageKey`.
* [x] Create and apply the Prisma migration.
* [x] Add shared attachment DTOs and Zod schemas.
* [x] Add a `FileStorage` interface and an in-memory fake for tests.
* [x] Implement `S3FileStorage` with upload URL, download URL, `HeadObject` and `DeleteObject`.
* [x] Implement `AttachmentRepository` and `AttachmentService` with task/attachment ownership checks.
* [x] Add upload-intent, complete-upload, list, download-url and delete endpoints.
* [x] Validate allowed content types and maximum file size; verify size after upload.
* [x] Delete the S3 object when an attachment or its task is deleted.
* [x] Add the attachments card to the task details view with upload progress, download, delete, loading, empty and error states.
* [x] Add LocalStack support through `S3_ENDPOINT_URL`, `S3_PUBLIC_ENDPOINT_URL` and `S3_FORCE_PATH_STYLE`.
* [x] Add API unit/integration tests and web tests.
* [x] Add the new environment variables to `apps/api/src/config/env.ts` and the env examples.

**Acceptance criteria**

* [x] A user can upload, list, download and delete an attachment for their own task.
* [x] Cross-user access returns `404`.
* [x] Invalid file types and oversized files are rejected.
* [x] Pre-signed URLs are short-lived and never logged.
* [x] Deleting a task removes its attachment rows and S3 objects.
* [x] All API and web tests pass (46 API, 23 web).
* [x] Live LocalStack smoke test passed for upload, complete, list, download and delete.

### 5.4 Phase 2 — Containerization

Goal: run the production-shaped app locally with Docker.

* [x] Add `Dockerfile.api` with multi-stage build, non-root runtime, health check and `migrator` target.
* [x] Add `Dockerfile.web` with Next.js standalone output, non-root runtime and health check.
* [x] Enable `output: "standalone"` in `apps/web/next.config.ts`.
* [x] Add `docker-compose.prod.yml` for API, web and one-off migrations.
* [x] Add `.dockerignore`.
* [x] Add container health checks and CloudWatch `awslogs` configuration.
* [x] Run API, web, PostgreSQL and LocalStack together locally.
* [x] Verify migrations, seed, login, task CRUD and attachments through the containers.
* [x] Confirm no secrets are baked into either image.

**Acceptance criteria**

* [x] Both images build reproducibly from a clean checkout.
* [x] Both containers become healthy.
* [x] The web app can reach the API in the container network.
* [x] `prisma migrate deploy` runs successfully in the migration image.
* [x] Image tags use Git SHAs, not `latest`.

> Container verification was completed before the Docker containers were removed to free disk space. The stack can be recreated with `npm run docker:build`, `npm run docker:up` and `npm run docker:seed` once Docker Desktop is running.

### 5.5 Phase 3 — Terraform foundation

Goal: create the network, security, storage and identity foundation.

* [x] Bootstrap the encrypted S3 Terraform state bucket and configure the backend with locking.
* [x] Add provider, variables, `default_tags` and outputs.
* [x] Add a VPC with two public subnets for the ALB and two private subnets for RDS.
* [x] Add an Internet Gateway and public route table.
* [x] Add security groups:
  * [x] ALB inbound `80`/`443` from the internet.
  * [x] App inbound `3100`/`4200` only from the ALB security group.
  * [x] RDS inbound `5432` only from the app security group.
  * [x] No inbound SSH.
* [x] Add a private S3 bucket with Block Public Access, ownership controls, encryption, versioning, CORS and lifecycle rules.
* [x] Add a least-privilege EC2 IAM role, instance profile and policies for S3, ECR, CloudWatch Logs, SSM parameters and KMS.
* [x] Add ECR repositories with immutable tags, scan-on-push and lifecycle policies.
* [x] Add a KMS key and SSM parameters for `DATABASE_URL`, `JWT_ACCESS_SECRET`, `S3_BUCKET` and `CORS_ORIGINS`.
* [x] Run `terraform fmt` and `terraform validate` for both the main stack and bootstrap stack.
* [ ] Run `terraform plan` against AWS and review the resources.

**Acceptance criteria**

* [ ] The plan creates the expected resources without unexpected replacements.
* [x] The S3 bucket configuration is private (Block Public Access, no public policy, bucket-owner-enforced ownership).
* [x] The database security group accepts traffic only from the app security group.
* [x] The IAM policy does not use `s3:*` or broad `Resource: "*"` for application access.
* [x] No security group allows inbound SSH from the internet.

### 5.6 Phase 4 — Compute, database and edge

Goal: deploy the application and verify it end to end over HTTPS.

* [x] Add the EC2 instance, Elastic IP, encrypted root volume and user data bootstrap.
* [x] Require IMDSv2 and set the metadata hop limit for containers.
* [x] Add the private RDS PostgreSQL instance, DB subnet group and parameter group.
* [x] Enable RDS encryption, automated backups and SSL enforcement.
* [x] Add the ALB, web/API target groups, health checks and target attachments.
* [x] Add ACM certificate validation and Route 53 alias record.
* [x] Add CloudWatch log groups for API and web.
* [ ] Apply the stack and deploy the first API/web/migration images.
* [ ] Run `prisma migrate deploy` and seed the demo data on AWS.
* [ ] Verify HTTPS login, task CRUD, dashboard and attachment upload/download.
* [ ] Verify CloudWatch logs for both containers.

**Acceptance criteria**

* [ ] The app is reachable over HTTPS at the configured domain.
* [ ] Both ALB target groups report healthy.
* [ ] RDS is not publicly accessible.
* [ ] Attachments upload and download directly through pre-signed S3 URLs in AWS.
* [ ] API and web logs appear in CloudWatch.
* [ ] No application port is exposed directly to the internet.

### 5.7 Phase 5 — Operations, CI/CD and hardening

Goal: make the deployment repeatable, observable and safe to operate.

* [x] Add CloudWatch alarms for ALB 5xx, target latency, EC2 status, RDS CPU, RDS storage and RDS connections.
* [x] Add an SNS topic and optional email subscription for alarms.
* [ ] Verify SSM Session Manager shell access.
* [ ] Verify SSM port forwarding to RDS for `psql`/Prisma Studio.
* [x] Add GitHub Actions CI for install, shared build, typecheck, tests, production build, Terraform validation and container builds.
* [x] Add GitHub Actions deploy with OIDC, ECR push and SSM Run Command.
* [x] Add an AWS Budgets alarm.
* [ ] Test `terraform destroy` and confirm clean teardown.
* [x] Update `README.md`, `KNOWLEDGE.md` and `infra/README.md` with the final commands and URLs.

**Acceptance criteria**

* [x] No AWS access keys are stored in GitHub.
* [ ] A push to `main` builds, pushes and deploys the app through OIDC.
* [ ] Alarms notify the configured email.
* [ ] SSM access works without inbound SSH.
* [ ] `terraform destroy` completes without leftover billable resources.
* [ ] The deployment can be recreated from scratch using the documented steps.

### 5.8 Optional hardening (post-demo)

* [ ] AWS WAF in front of the ALB.
* [ ] Auto Scaling group with rolling deploys.
* [ ] Multi-AZ RDS and deletion protection.
* [ ] RDS Proxy for connection pooling.
* [ ] GuardDuty Malware Protection for S3.
* [ ] CloudTrail and GuardDuty enabled.
* [ ] S3 server access logging.
* [ ] VPC interface endpoints for S3, ECR, CloudWatch and SSM.
* [ ] S3 access logs and ALB access logs.
* [ ] Blue/green or canary deployment strategy.

### 5.9 AWS definition of done

* [x] The core assignment still passes all existing tests and builds.
* [ ] The app is reachable only through the ALB over HTTPS.
* [ ] The web and API containers are healthy on AWS.
* [ ] RDS is private and reachable only from the app security group (configuration is implemented; live verification pending).
* [ ] S3 is private and attachments use short-lived pre-signed URLs (configuration is implemented; live verification pending).
* [ ] No inbound SSH is open (configuration is implemented; live verification pending).
* [x] No long-lived AWS credentials exist in the repository, images or CI.
* [ ] CloudWatch logs and alarms are working on AWS.
* [ ] `terraform apply` and `terraform destroy` both succeed from a clean state.
* [x] `README.md`, `KNOWLEDGE.md` and `infra/README.md` describe the final deployment accurately.
* [ ] The demo can be shown end to end in under five minutes.

### 5.10 Out of scope for this extension

* Multi-region disaster recovery.
* Kubernetes or ECS migration.
* A custom domain registrar integration outside Route 53.
* Replacing the current authentication model.
* A separate submission/assignment domain model; attachments are added to existing tasks.
