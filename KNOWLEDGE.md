# TaskApp on AWS — Learning & Implementation Guide

> **Status:** The local TaskApp, S3 attachment feature, container images, Terraform stack and GitHub Actions workflows are **implemented**. The code passes local tests, TypeScript builds, `terraform fmt` and `terraform validate`. A live AWS deployment has **not** been applied in this environment because no AWS credentials or Route 53 zone were available. This document remains the learning guide and architecture explanation; the actual implementation under `infra/`, `deploy/`, `Dockerfile.*` and `.github/workflows/` is authoritative where a sketch below differs.

> **Chosen architecture:** Terraform for infrastructure, Next.js frontend on EC2, Express API on EC2 behind an Application Load Balancer (ALB), PostgreSQL on RDS, private S3 bucket with pre-signed URLs for task attachments, CloudWatch for logs/alarms, and SSM Session Manager instead of public SSH.

> **Implementation snapshot (authoritative):**
>
> - Attachment domain: `apps/api/src/modules/attachments/`, Prisma migration `20261126082256_add_attachments`, shared schemas/types and `apps/web/src/components/tasks/task-attachments.tsx`.
> - Local storage: LocalStack 3.8.1 through `docker-compose.yml`; bucket and CORS are created by `scripts/localstack-init.sh`.
> - Containers: `Dockerfile.api` (`runner` and `migrator` targets), `Dockerfile.web`, `docker-compose.prod.yml` for local production shape and `deploy/docker-compose.aws.yml` for EC2.
> - Infrastructure: `infra/` (VPC, security groups, S3, IAM, ECR, KMS/SSM, RDS, EC2, ALB/ACM/Route 53, CloudWatch, budgets, optional GitHub OIDC role) and `infra/bootstrap/` for the state bucket.
> - CI/CD: `.github/workflows/ci.yml` and `.github/workflows/deploy.yml` (OIDC, ECR push, SSM Run Command).
> - Local verification: `npm test` (46 API, 23 web), `npm run build`, `npm run docker:build`, `npm run docker:up`, `npm run docker:seed`, `terraform fmt -check -recursive infra`, and `terraform validate` in both Terraform stacks.
> - Live AWS verification: not run in this environment. Use `infra/README.md` and Section 8 below when credentials and a Route 53 zone are available.

---

## Table of contents

1. [The target architecture](#1-the-target-architecture)
2. [AWS mental model](#2-aws-mental-model)
3. [Technology deep dives](#3-technology-deep-dives)
4. [How TaskApp maps to AWS](#4-how-taskapp-maps-to-aws)
5. [Application implementation blueprint](#5-application-implementation-blueprint)
6. [Containerization](#6-containerization)
7. [Terraform implementation](#7-terraform-implementation)
8. [Deployment runbook](#8-deployment-runbook)
9. [CI/CD with GitHub Actions](#9-cicd-with-github-actions)
10. [Security checklist](#10-security-checklist)
11. [Troubleshooting](#11-troubleshooting)
12. [Cost awareness](#12-cost-awareness)
13. [Learning exercises](#13-learning-exercises)
14. [Glossary](#14-glossary)
15. [Implementation roadmap](#15-implementation-roadmap)

---

## 0. How to use this guide

This guide is written for someone using these technologies for the first time. Read it in three passes:

1. **Understand the shape** — Sections 1 and 2 explain what runs where and the AWS mental model.
2. **Learn each building block** — Section 3 explains Terraform, EC2, Docker, ALB, RDS, S3, IAM, SSM and CloudWatch.
3. **Follow the implementation** — Sections 4–8 map each block to TaskApp, with code sketches, commands and a deployment runbook.

Conventions used below:

- `<account-id>`, `<region>`, `app.example.com`, `i-0123456789abcdef0` are placeholders.
- Commands assume **AWS CLI v2**, **Terraform >= 1.10**, **Docker Desktop**, and **Node.js 22**.
- The example region is `eu-central-1`; change it consistently.
- “Demo” means a cheap, single-instance deployment for an interview. “Production-like” means separate instances, autoscaling and stricter controls.

> **Important:** Do not start by writing every Terraform file at once. Build in small steps, run `terraform plan`, inspect what will be created, apply, then verify in the AWS console and with CLI commands. That is how you actually learn Terraform.

> **Before you create anything:** use a sandbox AWS account, enable MFA, never use the root user for Terraform, and set an AWS Budgets alarm. It is much easier to learn when a forgotten load balancer cannot produce a surprise bill.

---

## 1. The target architecture

### 1.1 Diagram

```text
                          Internet
                             │
                             │ HTTPS 443
                             ▼
                 ┌───────────────────────┐
                 │   Route 53 (DNS)      │
                 │   app.example.com     │
                 └───────────┬───────────┘
                             │
                             ▼
                 ┌───────────────────────┐
                 │   ACM certificate     │
                 │   TLS termination     │
                 └───────────┬───────────┘
                             │
                             ▼
        ┌──────────────────────────────────────────┐
        │        Application Load Balancer          │
        │                                          │
        │  /api/*  ──────────────► API target group │
        │  default ──────────────► Web target group │
        └───────────────┬──────────────┬───────────┘
                        │              │
              port 4200 │              │ port 3100
                        ▼              ▼
        ┌──────────────────────────────────────────┐
        │        EC2 instance (Amazon Linux)       │
        │                                          │
        │  ┌────────────┐      ┌────────────┐      │
        │  │ Express API│      │ Next.js web│      │
        │  │ container  │      │ container  │      │
        │  └─────┬──────┘      └────────────┘      │
        │        │                                  │
        │  Docker Compose + CloudWatch awslogs      │
        └────────┼──────────────────────────────────┘
                 │ 5432 (private)
                 ▼
        ┌───────────────────────┐
        │  RDS PostgreSQL       │
        │  private subnets      │
        │  no public access     │
        └───────────────────────┘

  Browser ── pre-signed PUT/GET ──► private S3 bucket (attachments)
  API     ── signs URLs / HeadObject / DeleteObject ──► S3
  EC2     ── logs ──► CloudWatch Logs
  Admin   ── SSM Session Manager ──► EC2 (no inbound SSH)
  GitHub  ── OIDC ──► ECR / SSM Run Command
```

### 1.2 What runs where

| Piece | Where it runs | Why |
|---|---|---|
| Next.js web app | Docker container on EC2 | Chosen architecture; keeps everything in AWS |
| Express API | Docker container on EC2 | Same host for the demo; ALB routes `/api/*` to it |
| PostgreSQL | RDS in private subnets | Managed backups, patching, no public database |
| Attachments | Private S3 bucket | Durable object storage; no file bytes through Express |
| TLS certificate | ACM | Free managed certificate for ALB |
| Container images | ECR | Private registry with IAM-based pulls |
| Logs and alarms | CloudWatch | Central logs, metrics and alerting |
| Admin access | SSM Session Manager | No public SSH port, no key pair to manage |
| Infrastructure | Terraform | Repeatable create/destroy and reviewable changes |

### 1.3 Request flows

**Page request**

1. Browser resolves `app.example.com` through Route 53.
2. TLS terminates at the ALB using an ACM certificate.
3. The ALB default rule forwards to the **web target group** on port `3100`.
4. The Next.js container returns HTML, CSS and JavaScript.

**API request**

1. Browser calls `https://app.example.com/api/v1/tasks`.
2. The ALB rule `/api/*` forwards to the **API target group** on port `4200`.
3. Express handles the request, using the same origin as the web app.
4. The API talks to RDS over port `5432` inside the VPC.
5. The API may sign S3 URLs or call S3 with its EC2 instance role.

**Attachment upload**

1. Browser asks the API to create an upload: `POST /api/v1/tasks/:taskId/attachments`.
2. API validates the task, file name, content type and size, creates a `PENDING` attachment row, and returns a short-lived pre-signed `PUT` URL.
3. Browser uploads the file **directly to S3** with that URL.
4. Browser calls `POST /api/v1/tasks/:taskId/attachments/:id/complete`.
5. API calls S3 `HeadObject` to verify the object exists and has the expected size/type, then marks the row `UPLOADED`.
6. Browser requests a download URL: `GET /api/v1/tasks/:taskId/attachments/:id/download-url`.
7. API returns a short-lived pre-signed `GET` URL. The browser downloads directly from S3.

**Admin access**

1. You run `aws ssm start-session --target i-...` from your laptop.
2. The SSM Agent on EC2 opens an outbound connection to the SSM service.
3. AWS gives you a shell without opening port 22 or managing SSH keys.

### 1.4 Why this design

- **No public SSH:** SSM Session Manager removes the most attacked port on the internet.
- **No public database:** RDS is only reachable from the API security group.
- **Private S3:** the bucket blocks all public access; access is temporary and signed.
- **No file bytes through Express:** direct-to-S3 uploads keep the API small and fast.
- **Same origin:** ALB path routing means cookies and CORS are simple; the browser only sees `app.example.com`.
- **Reproducible:** Terraform can create and destroy the whole demo stack.
- **Observable:** ALB, EC2, RDS and application logs all land in CloudWatch.

### 1.5 Demo vs production-like

| Concern | Demo (recommended first) | Production-like |
|---|---|---|
| EC2 | One instance runs both containers | Separate web and API instances or Auto Scaling groups |
| ALB | One ALB, two target groups | Same, plus WAF and access logs |
| RDS | Single-AZ `db.t4g.micro` | Multi-AZ, larger class, deletion protection |
| Deploys | `docker compose pull && up -d` via SSM | CI/CD with rolling or blue/green deploys |
| Secrets | SSM Parameter Store SecureString | Secrets Manager + rotation |
| Database access | Direct from API | RDS Proxy / connection pooling at scale |
| Availability | Brief downtime on deploy | Multiple AZs, health-checked rolling deploys |

Start with the demo column. The learning value is in the wiring, not in paying for redundancy you do not need.

> **If you later move only the web app to Vercel:** keep the API behind the ALB, set `API_ORIGIN` to the API hostname, add the Vercel origin to `CORS_ORIGINS`, and change the refresh cookie to `SameSite=None; Secure` because the sites are now cross-site. That is a different deployment shape from the same-origin EC2 design in this guide.

---

## 2. AWS mental model

### 2.1 Accounts, regions and Availability Zones

- **Account** — the billing and security boundary. Use a sandbox account, not your root account, for learning.
- **Region** — a geographic area such as `eu-central-1` (Frankfurt). Resources are regional unless they are global (IAM, Route 53, CloudFront).
- **Availability Zone (AZ)** — one or more isolated data centers inside a region, such as `eu-central-1a`. Multi-AZ means resources are spread across AZs.
- **ARN** — Amazon Resource Name, the unique ID of an AWS resource. Example:
  `arn:aws:s3:::taskapp-attachments-demo`
  Most IAM policies are written in terms of ARNs.

### 2.2 VPC, subnets and routing

A **VPC** is your private network in AWS. You choose a CIDR block, for example `10.20.0.0/16`.

Inside it you create **subnets**:

- **Public subnet** — has a route to an Internet Gateway (IGW). The EC2 instance lives here in the demo so it can pull images and reach SSM without a NAT Gateway.
- **Private subnets** — no direct route to the internet. RDS lives here.

Routing is controlled by **route tables**:

- Public route table: `0.0.0.0/0 → igw-...`
- Private route table: only the local VPC route. RDS does not need internet access.
- A **NAT Gateway** would let private resources make outbound connections, but it costs about $32/month. The demo avoids it by putting EC2 in a public subnet while keeping the database private.

> **Learning point:** “Public subnet” does not automatically make an instance reachable. Reachability requires a public IP or Elastic IP, a route to the IGW, and a security group that allows the traffic.

### 2.3 Security groups vs network ACLs

| Feature | Security group | Network ACL |
|---|---|---|
| Attached to | ENIs (instances, ALB, RDS) | Subnets |
| Stateful? | Yes — return traffic is automatic | No — you must allow both directions |
| Rules | Allow only | Allow and deny |
| Typical use | Fine-grained service access | Broad subnet guardrails |

This project uses security groups only:

- **ALB SG:** inbound `443` (and `80` for redirect) from the internet.
- **App SG:** inbound `3100` and `4200` **only from the ALB SG**. No inbound `22`.
- **DB SG:** inbound `5432` **only from the App SG**.
- **Egress:** App SG needs `443` for S3/ECR/CloudWatch/SSM and `5432` to the DB SG.

Security groups can reference other security groups. That is how you express “the database accepts traffic from the API, but not from the internet.”

### 2.4 IAM in one page

IAM answers: **who** can do **what** on **which resource** under **which conditions**.

- **User** — a long-lived identity, usually a person. Avoid for applications.
- **Role** — an identity that can be assumed temporarily. EC2 assumes a role through an **instance profile**; GitHub Actions assumes a role through **OIDC**.
- **Policy** — a JSON document with `Effect`, `Action`, `Resource` and optional `Condition`.
- **Trust policy** — who is allowed to assume the role.
- **Permission policy** — what the role can do after it is assumed.

Two policies are involved in an EC2 role:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "ec2.amazonaws.com" },
    "Action": "sts:AssumeRole"
  }]
}
```

That trust policy says “EC2 may assume this role.” A separate permission policy grants access to S3, ECR, CloudWatch and SSM.

**Why no long-lived keys?** Credentials from an instance role are temporary, rotated automatically, and never stored in `.env` or Docker images. The AWS SDK finds them through the instance metadata service.

### 2.5 ARNs and naming

Use consistent names and tags:

```text
Project:     taskapp
Environment: demo
Region:      eu-central-1
Bucket:      taskapp-demo-attachments-<account-id>
EC2 role:    taskapp-demo-ec2
RDS:         taskapp-demo-db
Log group:   /taskapp/demo/api
SSM prefix:  /taskapp/demo/
```

Tags are not decoration: they drive cost reports, ownership and automation. Terraform should apply `Project`, `Environment`, `ManagedBy` to every taggable resource.

### 2.6 Managed vs self-managed

| You manage | AWS manages |
|---|---|
| Application code | Physical hardware |
| Container images | Hypervisor and networking |
| Security groups and IAM | RDS backups and patching (when configured) |
| Database schema and migrations | S3 durability and replication |
| OS patching on EC2 | ALB availability |

RDS is “managed PostgreSQL,” not “no operations.” You still own schema migrations, indexes, query performance, connection counts and backup retention choices.

### 2.7 A sensible learning order

1. Tour the AWS console: VPC, EC2, S3, RDS, IAM, CloudWatch, Systems Manager.
2. Create a private S3 bucket by hand, upload a file, generate a pre-signed URL with the CLI.
3. Write Terraform for that bucket only. Run `plan`, `apply`, `destroy`.
4. Dockerize the API and run it locally with PostgreSQL.
5. Create an EC2 instance and run the container manually.
6. Add an ALB and a target group.
7. Add RDS and run Prisma migrations.
8. Add S3 attachments to the application.
9. Add CloudWatch alarms and SSM access.
10. Automate image builds and deploys with GitHub Actions.

Trying to do all ten at once makes debugging painful. Each step should end with a working, observable system.

## 3. Technology deep dives

### 3.1 Terraform

Terraform is an **infrastructure as code** tool. You describe the desired end state in `.tf` files; Terraform calculates the API calls needed to reach that state.

#### Core concepts

| Concept | Meaning |
|---|---|
| Provider | Plugin that talks to an API, e.g. `hashicorp/aws` |
| Resource | Something Terraform manages, e.g. `aws_s3_bucket` |
| Data source | Read-only lookup, e.g. latest Amazon Linux AMI |
| Variable | Input to a configuration |
| Local | Computed value inside a configuration |
| Output | Value exported after apply, e.g. ALB DNS name |
| State | Terraform’s record of what it created and how it maps to real resources |
| Module | Reusable group of resources |
| Plan | Preview of changes |
| Apply | Execute the changes |
| Destroy | Delete managed resources |

#### A minimal example

```hcl
terraform {
  required_version = ">= 1.10.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

variable "aws_region" {
  type    = string
  default = "eu-central-1"
}

resource "aws_s3_bucket" "attachments" {
  bucket = "taskapp-demo-attachments-${data.aws_caller_identity.current.account_id}"

  tags = {
    Project     = "taskapp"
    Environment = "demo"
    ManagedBy   = "terraform"
  }
}

data "aws_caller_identity" "current" {}

output "bucket_name" {
  value = aws_s3_bucket.attachments.bucket
}
```

Run:

```bash
terraform init
terraform fmt
terraform validate
terraform plan
terraform apply
terraform output
terraform destroy
```

#### Reading a plan

- `+` create
- `~` update in place
- `-` destroy
- `-/+` destroy and recreate (replacement)
- `forces replacement` means the attribute cannot be changed in place

Always read the plan before typing `yes`. A “small” change such as an AMI update can replace an instance, and a subnet change can replace RDS.

#### State

Terraform state is a JSON file mapping your configuration to real resource IDs. It is **sensitive**:

- It can contain database passwords and other secrets.
- It must not be committed to Git.
- For teams, store it remotely in S3 with encryption and locking.

Example backend:

```hcl
terraform {
  backend "s3" {
    bucket       = "taskapp-demo-tfstate-<account-id>"
    key          = "demo/terraform.tfstate"
    region       = "eu-central-1"
    encrypt      = true
    use_lockfile = true
  }
}
```

`use_lockfile` requires Terraform >= 1.10. On older versions, use a DynamoDB table:

```hcl
dynamodb_table = "taskapp-demo-tfstate-lock"
```

Useful state commands:

```bash
terraform state list
terraform state show aws_s3_bucket.attachments
terraform state mv aws_s3_bucket.old aws_s3_bucket.new
terraform import aws_s3_bucket.attachments taskapp-demo-attachments-123456789012
terraform plan -refresh-only
```

#### Modules

A module is a directory of `.tf` files called with `module "name" { source = "./modules/network" ... }`.

For this project, start with a **single root module** under `infra/`, split into files by concern. That is easier to learn than passing twenty variables between child modules. Once it works, refactor into modules such as `network`, `database`, `storage` and `compute`.

#### Common Terraform mistakes

- Committing `.tfstate` or `.terraform/`.
- Putting secrets in `terraform.tfvars` and committing it.
- Using `latest` AMI IDs manually instead of a `data "aws_ami"` lookup.
- Forgetting `depends_on` when an IAM policy must exist before an instance starts.
- Running `destroy` while RDS deletion protection is enabled.
- Manually changing resources in the console and then wondering why the next plan wants to undo it.

---

### 3.2 EC2 and Docker

#### EC2 concepts

| Term | Meaning |
|---|---|
| AMI | Machine image, e.g. Amazon Linux 2023 |
| Instance type | CPU/RAM size, e.g. `t3.small` |
| EBS | Network disk attached to the instance |
| Elastic IP | Static public IPv4 address |
| User data | Script that runs on first boot |
| Instance profile | IAM role exposed to the instance |
| IMDS | Instance Metadata Service, where temporary credentials come from |
| Security group | Virtual firewall attached to the instance’s network interface |

The demo uses one `t3.small` (2 vCPU, 2 GB RAM). Next.js builds can be memory-hungry, so build images in CI or on your laptop, not on a `t3.micro`.

#### Docker concepts

| Term | Meaning |
|---|---|
| Image | Immutable filesystem + metadata |
| Container | Running instance of an image |
| Dockerfile | Recipe for building an image |
| Layer | Cached filesystem change; order matters for build speed |
| Multi-stage build | Use a build image, copy only artifacts into a small runtime image |
| Compose | Declarative way to run multiple containers together |
| Volume | Persistent storage outside the container |
| Bridge network | Private network where containers reach each other by service name |
| Health check | Command that reports whether a container is healthy |

Why Docker here?

- The same image runs locally, in CI and on EC2.
- Dependencies are pinned inside the image.
- Rolling back means running a previous image tag.
- The host only needs Docker, not Node.js, Prisma or build tools.

#### User data and first boot

EC2 **user data** runs as root on first boot. Typical tasks:

1. Install Docker and the Compose plugin.
2. Create `/opt/taskapp`.
3. Fetch secrets from SSM Parameter Store into `/opt/taskapp/api.env` with mode `600`.
4. Log in to ECR and pull images.
5. Start `docker compose -f /opt/taskapp/docker-compose.yml up -d --wait`.

Do **not** put secrets directly in user data. User data is visible in the EC2 console and API, and it is stored in Terraform state if templated. Fetch secrets at boot from SSM or Secrets Manager.

#### Container credentials and the IMDS hop limit

The AWS SDK inside a container must reach the EC2 instance metadata service to get role credentials. With Docker’s bridge network, the default hop limit of 1 is often too low. Set:

```hcl
metadata_options {
  http_endpoint               = "enabled"
  http_tokens                 = "required" # IMDSv2 only
  http_put_response_hop_limit = 2
}
```

Symptom if this is wrong: the app works on the host but inside the container you see “Unable to locate credentials” or S3/ECR calls fail.

#### Patching and operations

- Amazon Linux 2023 uses `dnf`.
- Enable automatic security updates or patch during maintenance windows.
- EBS root volume should be encrypted.
- Logs go to stdout/stderr; do not write application logs to files inside the container.
- Containers should run as a non-root user where possible.

---

### 3.3 Application Load Balancer, ACM and Route 53

An ALB is a managed layer-7 reverse proxy. It understands HTTP, so it can route by path, host or header.

#### Components

| Component | Meaning |
|---|---|
| Listener | Port/protocol the ALB listens on, e.g. HTTPS `443` |
| Rule | Condition + action, e.g. path `/api/*` → API target group |
| Target group | Collection of targets (EC2 instances, IPs, Lambda) with a health check |
| Health check | ALB periodically calls a path; unhealthy targets stop receiving traffic |
| ACM | AWS Certificate Manager, issues and renews TLS certificates |
| Route 53 | DNS service; maps `app.example.com` to the ALB |

#### Routing for TaskApp

| Priority | Condition | Action |
|---|---|---|
| 10 | Path pattern `/api/*` | Forward to `taskapp-demo-api` target group, port `4200` |
| default | Everything else | Forward to `taskapp-demo-web` target group, port `3100` |

Health checks:

- Web: `GET /login` expecting `200`.
- API: `GET /api/v1/health` expecting `200`.

The ALB health check and the Docker `HEALTHCHECK` are different things. The Docker health check helps Compose and operators; the ALB health check decides whether the target receives traffic.

#### TLS and cookies

- ACM gives you a free certificate for a domain you control.
- The ALB terminates TLS, then talks plain HTTP to the containers inside the VPC.
- The browser sees HTTPS, so the API can set `Secure` cookies.
- Because web and API share `app.example.com`, the refresh cookie is same-origin and `SameSite=Lax` works naturally.

> If you test without a domain and use plain HTTP, `Secure` cookies will not be stored by the browser. For a temporary lab, either use a self-signed certificate, add a `COOKIE_SECURE=false` override for local testing, or use `NODE_ENV=development`. Do not ship the override to production.

#### Security group chaining

- ALB SG allows `443` from `0.0.0.0/0`.
- App SG allows `3100` and `4200` only from the ALB SG.
- App SG allows `5432` only to the DB SG.
- DB SG allows `5432` only from the App SG.

This means the instance has no public application ports even though it sits in a public subnet.

#### Things you do not need for this demo

- Sticky sessions: the API uses JWTs and the refresh token is stored in a cookie, not in server memory.
- WebSocket support: not used.
- Path rewriting: not needed; the API already serves `/api/v1`.
- Nginx: the ALB replaces it for TLS and routing.

### 3.4 RDS for PostgreSQL

RDS is a managed database service. AWS runs the server, storage, backups and patching; you own the schema, queries, indexes and connection management.

#### Concepts

| Term | Meaning |
|---|---|
| DB instance | The PostgreSQL server, e.g. `db.t4g.micro` |
| DB subnet group | The private subnets where RDS can place the instance |
| Parameter group | Database engine settings, e.g. `rds.force_ssl = 1` |
| Security group | Controls who can connect on `5432` |
| Automated backup | Daily snapshot + transaction logs for point-in-time restore |
| Multi-AZ | Synchronous standby in another AZ for failover |
| Performance Insights | Query and load monitoring |

#### Why private subnets?

RDS should have `publicly_accessible = false`. The only route to it is from the API security group inside the VPC. There is no reason for the internet to reach PostgreSQL.

#### Connection string

```text
postgresql://taskapp:<password>@taskapp-demo-db.abc123.eu-central-1.rds.amazonaws.com:5432/taskapp?schema=public&sslmode=require&connection_limit=10
```

- `sslmode=require` encrypts the connection.
- `connection_limit=10` keeps Prisma from opening too many connections on a small instance.
- URL-encode special characters in the password, or generate a password without reserved characters for the demo.

#### Migrations

- Local development: `prisma migrate dev`.
- Production: `prisma migrate deploy`.
- Never run `migrate dev` against RDS; it can reset data.
- Run migrations as a **separate one-off job**, not automatically on every app start. With multiple containers, startup migrations race each other.

A migration job in the deployment looks like:

```bash
docker run --rm \
  --env-file /opt/taskapp/api.env \
  <ecr>/taskapp-demo-migrator:<git-sha> \
  npx prisma migrate deploy
```

The migration image needs the Prisma CLI, so it keeps dev dependencies; the runtime image does not.

#### Backups and restores

- Set `backup_retention_period` to at least 7 days for a demo.
- Enable `storage_encrypted`.
- For production, enable `deletion_protection` and a final snapshot.
- Test a restore at least once. An untested backup is a hope, not a backup.

#### When to use RDS Proxy

Prisma opens a pool per API container. A single container is fine. With many containers or Lambda functions, connection counts can exhaust a small RDS instance. RDS Proxy pools connections and handles failover, at extra cost. For the demo, direct connections are simpler.

#### RDS does not give you SSH

You cannot SSH into RDS. To inspect it, connect with `psql` from the EC2 instance or use SSM port forwarding:

```bash
aws ssm start-session \
  --target i-0123456789abcdef0 \
  --document-name AWS-StartPortForwardingSessionToRemoteHost \
  --parameters '{"host":["taskapp-demo-db.abc123.eu-central-1.rds.amazonaws.com"],"portNumber":["5432"],"localPortNumber":["5433"]}'
```

Then connect locally to `localhost:5433`.

---

### 3.5 S3 and pre-signed URLs

S3 is object storage. It is not a filesystem and not a database. You store bytes under a **key** inside a **bucket**.

#### Core terms

| Term | Meaning |
|---|---|
| Bucket | Globally unique namespace, e.g. `taskapp-demo-attachments-123456789012` |
| Object | A file plus metadata |
| Key | Full object path, e.g. `attachments/<userId>/<taskId>/<uuid>.pdf` |
| Prefix | The “folder-like” part of a key; S3 has no real folders |
| Versioning | Keeps old versions when an object is overwritten or deleted |
| Lifecycle | Automatically expire objects or abort incomplete multipart uploads |
| CORS | Browser permission to call S3 directly from your web origin |
| Pre-signed URL | A URL with temporary, signed permission to perform one S3 action |

#### Keep the bucket private

- Enable **Block Public Access** at the bucket level.
- Do not add a public bucket policy.
- Do not use `ACL = public-read`.
- Grant access only to the EC2 role and to signed URLs.

The bucket policy can stay empty. IAM on the EC2 role is enough for the API. The browser never has IAM credentials; it only has a signed URL.

#### Encryption, versioning and lifecycle

- **SSE-S3 (`AES256`)** is the simplest encryption for the demo. It needs no extra KMS permissions.
- **SSE-KMS** gives you a customer-managed key and audit control, but the browser’s pre-signed `PUT` must send the matching encryption header and the role needs `kms:GenerateDataKey` / `kms:Decrypt`. Start with SSE-S3.
- **Versioning** protects against accidental overwrites. It also means deletes create delete markers.
- **Lifecycle** should abort incomplete multipart uploads after a few days. Optionally expire old versions.

#### CORS

The browser uploads directly to S3, so the bucket needs a CORS rule:

```json
[
  {
    "AllowedOrigins": ["https://app.example.com"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

`AllowedHeaders: ["*"]` is convenient for learning; in production, list the headers you actually send, such as `content-type`.

#### How a pre-signed URL works

A pre-signed URL contains:

- The bucket and key.
- The HTTP method (`PUT` for upload, `GET` for download).
- An expiration time.
- A signature created with the signer’s temporary credentials.

The URL grants exactly the action and duration encoded in it. It is **not** a public URL and it is **not** a session. Anyone who has the URL can use it until it expires, so treat it like a password:

- Keep expiry short: 5 minutes for upload, 1–5 minutes for download.
- Do not log full URLs.
- Do not store them in the database; generate them on demand.

#### Upload flow with AWS SDK v3

```ts
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({ region: process.env.AWS_REGION });

export async function createUploadUrl(input: {
  bucket: string;
  key: string;
  contentType: string;
  expiresIn: number;
}) {
  const command = new PutObjectCommand({
    Bucket: input.bucket,
    Key: input.key,
    ContentType: input.contentType,
  });

  return getSignedUrl(s3, command, { expiresIn: input.expiresIn });
}

export async function createDownloadUrl(input: {
  bucket: string;
  key: string;
  fileName: string;
  expiresIn: number;
}) {
  const command = new GetObjectCommand({
    Bucket: input.bucket,
    Key: input.key,
    ResponseContentDisposition: `attachment; filename="${input.fileName}"`,
  });

  return getSignedUrl(s3, command, { expiresIn: input.expiresIn });
}
```

Important detail: if the pre-signed `PUT` includes `ContentType`, the browser must send the **same** `Content-Type` header. Otherwise S3 returns `403 SignatureDoesNotMatch`.

#### Verifying an upload

A pre-signed `PUT` does not enforce a maximum size by itself. After the browser says “done,” the API should verify:

```ts
const head = await s3.send(new HeadObjectCommand({ Bucket, Key }));
if (!head.ContentLength || head.ContentLength > MAX_BYTES) {
  // delete the object and mark the attachment as failed
}
```

For hard size enforcement during upload, use a **pre-signed POST** with policy conditions, or upload through the API (simpler, but uses API bandwidth). For this project, verify after upload and delete invalid objects.

#### Object keys

Generate keys on the server:

```text
attachments/<userId>/<taskId>/<uuid>.<ext>
```

Do not trust the client’s file name as the key. Sanitize the display name, store it in the database, and use a UUID for the object key. This avoids path traversal, collisions and weird characters.

#### Deleting and orphans

- Deleting an attachment row should also delete the S3 object.
- Deleting a task with `onDelete: Cascade` deletes attachment rows, but **not** S3 objects. The service must delete objects before deleting the task, or a cleanup job must reconcile them.
- Failed or abandoned `PENDING` uploads should be cleaned up by a scheduled job or a lifecycle rule.

#### Local development without AWS

You can develop the attachment feature before creating any AWS resources:

- Run **LocalStack** or **LocalStack** locally.
- Point the SDK at it with `AWS_ENDPOINT_URL=http://localhost:4566`.
- Set dummy credentials: `AWS_ACCESS_KEY_ID=test`, `AWS_SECRET_ACCESS_KEY=test`.
- Set `S3_FORCE_PATH_STYLE=true` for LocalStack/LocalStack.
- Create the bucket with `aws s3 mb s3://taskapp-attachments --endpoint-url http://localhost:4566`.

This keeps the feedback loop fast and costs nothing.

---

### 3.6 IAM roles and least privilege

#### Trust policy vs permission policy

- **Trust policy** answers “who can assume this role?”
- **Permission policy** answers “what can the role do?”

For EC2:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "ec2.amazonaws.com" },
    "Action": "sts:AssumeRole"
  }]
}
```

For GitHub Actions OIDC, the principal is a federated provider and the condition restricts the repository and branch:

```json
{
  "Effect": "Allow",
  "Principal": {
    "Federated": "arn:aws:iam::<account-id>:oidc-provider/token.actions.githubusercontent.com"
  },
  "Action": "sts:AssumeRoleWithWebIdentity",
  "Condition": {
    "StringEquals": {
      "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
    },
    "StringLike": {
      "token.actions.githubusercontent.com:sub": "repo:your-org/TaskApp:ref:refs/heads/main"
    }
  }
}
```

#### Managed vs custom policies

- Use AWS managed policies for standard agent permissions, e.g. `AmazonSSMManagedInstanceCore`.
- Use a custom policy for your S3 bucket, so the role can only touch the attachment prefix.
- Avoid `s3:*` and `Resource: "*"`.

Example custom permission policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AttachmentObjects",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::taskapp-demo-attachments-123456789012/attachments/*"
    },
    {
      "Sid": "ListAttachmentPrefix",
      "Effect": "Allow",
      "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::taskapp-demo-attachments-123456789012",
      "Condition": {
        "StringLike": {
          "s3:prefix": ["attachments/*"]
        }
      }
    },
    {
      "Sid": "EcrPull",
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage"
      ],
      "Resource": "*"
    },
    {
      "Sid": "CloudWatchLogs",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:eu-central-1:123456789012:log-group:/taskapp/demo/*"
    },
    {
      "Sid": "ReadAppParameters",
      "Effect": "Allow",
      "Action": [
        "ssm:GetParameter",
        "ssm:GetParameters",
        "ssm:GetParametersByPath"
      ],
      "Resource": "arn:aws:ssm:eu-central-1:123456789012:parameter/taskapp/demo/*"
    },
    {
      "Sid": "DecryptSsmParameters",
      "Effect": "Allow",
      "Action": "kms:Decrypt",
      "Resource": "arn:aws:kms:eu-central-1:123456789012:key/<key-id>"
    }
  ]
}
```

`ecr:GetAuthorizationToken` requires `Resource: "*"` because it is not scoped to a repository. That is normal.

#### Policy evaluation

- Explicit **Deny** always wins.
- An allow must exist for the action and resource.
- Roles are temporary credentials; they expire and rotate automatically.
- Use the IAM Policy Simulator to test “would this action be allowed?” before deploying.

#### The instance profile

EC2 cannot assume a role directly. It uses an **instance profile**, a container for the role:

```hcl
resource "aws_iam_instance_profile" "app" {
  name = "taskapp-demo-ec2"
  role = aws_iam_role.app.name
}
```

Then attach it:

```hcl
iam_instance_profile = aws_iam_instance_profile.app.name
```

---

### 3.7 SSM Session Manager

SSM Session Manager gives you shell access without inbound SSH.

#### How it works

1. The SSM Agent on EC2 opens an **outbound** HTTPS connection to the SSM service.
2. You call `aws ssm start-session` with your IAM identity.
3. AWS brokers an interactive session between your CLI and the agent.

No port 22, no key pair, no bastion host, no public IP requirement (though the demo instance has one for outbound internet).

#### Prerequisites

- SSM Agent installed. Amazon Linux 2023 includes it.
- Instance profile with `AmazonSSMManagedInstanceCore`.
- Outbound `443` to `ssm.<region>.amazonaws.com`, `ssmmessages.<region>.amazonaws.com`, and `ec2messages.<region>.amazonaws.com`.
- If the instance is in a private subnet without NAT, create **VPC interface endpoints** for those services.

#### Useful commands

```bash
# List managed instances
aws ssm describe-instance-information \
  --query "InstanceInformationList[].{Id:InstanceId,Name:ComputerName,Ping:PingStatus}" \
  --output table

# Open a shell
aws ssm start-session --target i-0123456789abcdef0

# Run a command without an interactive shell
aws ssm send-command \
  --instance-ids i-0123456789abcdef0 \
  --document-name AWS-RunShellScript \
  --parameters 'commands=["cd /opt/taskapp && docker compose ps"]'

# Port-forward to RDS through the EC2 instance
aws ssm start-session \
  --target i-0123456789abcdef0 \
  --document-name AWS-StartPortForwardingSessionToRemoteHost \
  --parameters '{"host":["taskapp-demo-db.abc123.eu-central-1.rds.amazonaws.com"],"portNumber":["5432"],"localPortNumber":["5433"]}'
```

#### Why it is safer than SSH

- No long-lived SSH keys to leak.
- No inbound port to scan.
- Access is controlled by IAM and logged in CloudTrail.
- Sessions can be recorded to S3 and CloudWatch Logs.
- You can revoke access by changing IAM, not by rotating keys on every instance.

#### Troubleshooting

- Instance not listed: check the instance profile, agent status, outbound `443`, and region.
- `TargetNotConnected`: agent is not running or cannot reach SSM.
- Session starts then closes: check `/var/log/amazon/ssm/amazon-ssm-agent.log` on the instance.
- Port forwarding fails: the EC2 instance must be able to reach the RDS host and port.

---

### 3.8 CloudWatch

CloudWatch has three related products:

- **CloudWatch Logs** — collect and query text logs.
- **CloudWatch Metrics** — numeric time series.
- **CloudWatch Alarms** — notify or act when a metric crosses a threshold.

#### Logs

- Create log groups such as `/taskapp/demo/api` and `/taskapp/demo/web`.
- Set a retention period, e.g. 14 days, so logs do not accumulate forever.
- Containers log to stdout/stderr; the Docker `awslogs` driver ships those lines to CloudWatch.
- The EC2 instance role needs permission to create log streams and put log events.

Docker Compose logging configuration:

```yaml
logging:
  driver: awslogs
  options:
    awslogs-region: eu-central-1
    awslogs-group: /taskapp/demo/api
    awslogs-stream: api
```

#### Logs Insights queries

```sql
fields @timestamp, level, msg
| filter level = "error"
| sort @timestamp desc
| limit 50
```

```sql
fields @timestamp, msg
| filter msg like /presign/
| stats count() by bin(5m)
```

#### Metrics and alarms

Useful alarms for this project:

| Alarm | Metric | Suggested threshold |
|---|---|---|
| ALB target 5xx | `HTTPCode_Target_5XX_Count` | > 5 in 5 minutes |
| ALB latency | `TargetResponseTime` | p95 > 2 seconds |
| EC2 CPU | `CPUUtilization` | > 80% for 10 minutes |
| RDS CPU | `CPUUtilization` | > 80% for 10 minutes |
| RDS free storage | `FreeStorageSpace` | < 2 GB |
| RDS connections | `DatabaseConnections` | > 80% of max |
| Status check | `StatusCheckFailed` | >= 1 |

Alarms can publish to an SNS topic, which can email you or trigger a Lambda.

#### Dashboards

A simple dashboard can show:

- ALB request count and 5xx rate.
- API target response time.
- EC2 CPU and network.
- RDS CPU, connections and free storage.
- Recent error logs.

#### EC2 memory and disk

EC2’s default metrics do **not** include memory or disk usage. To get them, install the CloudWatch Agent and configure it to publish `mem_used_percent` and `disk_used_percent`. For a demo, CPU and status checks are enough.

---

### 3.9 ECR

Elastic Container Registry is a private Docker registry.

#### Concepts

- **Repository** — one per image, e.g. `taskapp-demo-api` and `taskapp-demo-web`.
- **Tag** — immutable version label, e.g. the Git SHA.
- **Scan on push** — basic vulnerability scanning.
- **Lifecycle policy** — automatically delete old images.

#### Login and push

```bash
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=eu-central-1
ECR="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"

aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "$ECR"

docker build -f Dockerfile.api -t "$ECR/taskapp-demo-api:${GIT_SHA}" .
docker push "$ECR/taskapp-demo-api:${GIT_SHA}"
```

On EC2, the instance role provides credentials, so no password is stored:

```bash
aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "$ECR"
```

Use immutable tags and never deploy `latest`. If `latest` is mutable, you cannot tell which code is running.

## 4. How TaskApp maps to AWS

### 4.1 Current repository shape

```text
TaskApp/
├─ apps/
│  ├─ api/                 Express + Prisma API
│  │  ├─ prisma/           schema, migrations, seed
│  │  └─ src/
│  │     ├─ config/        env validation
│  │     ├─ modules/       auth, tasks, dashboard
│  │     ├─ container.ts   dependency-injection composition root
│  │     └─ server.ts
│  └─ web/                 Next.js App Router frontend
│     └─ src/
│        ├─ app/           pages and layouts
│        ├─ components/    UI components
│        ├─ hooks/         React Query hooks
│        └─ lib/api/       fetch service layer
├─ packages/shared/        shared DTOs, schemas, constants
├─ docker-compose.yml      local PostgreSQL
└─ package.json            npm workspaces
```

### 4.2 Component mapping

| TaskApp piece | AWS replacement / addition | Notes |
|---|---|---|
| `apps/web` | Next.js container on EC2 | ALB default target group, port `3100` |
| `apps/api` | Express container on EC2 | ALB `/api/*` target group, port `4200` |
| `packages/shared` | Compiled into both images | No separate deployment |
| Local PostgreSQL | RDS PostgreSQL | Private subnets, SSL |
| Task attachments | S3 private bucket | Pre-signed upload/download |
| Pino logs | CloudWatch Logs | Docker `awslogs` driver |
| Prisma migrations | One-off migration image | `prisma migrate deploy` |
| Refresh cookie | Same-origin via ALB | HTTPS + `Secure` cookie |
| Admin shell | SSM Session Manager | No public SSH |
| Local `.env` files | SSM Parameter Store | Fetched at boot by instance role |

### 4.3 ALB routing and the Next.js rewrite

Locally, the browser calls `http://localhost:3100/api/v1/...`. Next.js rewrites that to `http://localhost:4200/api/v1/...` using `API_ORIGIN`. This keeps the browser on one origin.

In AWS, there are two valid approaches:

**Approach A — ALB path routing (recommended)**

```text
Browser → ALB /api/* → API target group (4200)
Browser → ALB /*     → Web target group (3100)
```

- The API request never reaches Next.js.
- ALB metrics are split per target group.
- The Next rewrite remains useful for local development but is bypassed in AWS.
- The browser still sees one origin: `https://app.example.com`.

**Approach B — proxy everything through Next.js**

```text
Browser → ALB /* → Web target group (3100) → Next rewrite → API container (4200)
```

- Simpler ALB (one target group), but every API call makes an extra hop.
- The web container must be able to reach `http://api:4200`.
- API metrics are hidden behind the web target group.

Use Approach A. Keep the Next rewrite for local dev, and set `NEXT_PUBLIC_API_BASE_URL=/api/v1` so browser calls are relative.

> `NEXT_PUBLIC_*` variables are compiled into the browser bundle at **build time**. Changing them requires rebuilding the web image. `API_ORIGIN` is read by the Next server at runtime and can be changed without rebuilding.

### 4.4 Authentication cookies in production

The existing auth design:

- Access token in React memory.
- Opaque refresh token in an `httpOnly` cookie.
- Refresh token hash stored in PostgreSQL.
- Rotation and reuse detection.

In production:

- The ALB serves HTTPS, so `Secure` cookies work.
- Web and API share `app.example.com`, so the cookie is same-origin and `SameSite=Lax` is appropriate.
- Leave `COOKIE_DOMAIN` unset unless you intentionally need a parent-domain cookie. Host-only cookies are safer.
- Set `CORS_ORIGINS=https://app.example.com` even though same-origin requests do not require CORS; it protects against accidental cross-origin use.
- Cookie path can remain `/api/v1/auth` so it is only sent to auth endpoints.

If login works but the session disappears after refresh, check:

1. Is the site actually HTTPS?
2. Is the cookie marked `Secure`?
3. Is the cookie domain/path correct?
4. Is the browser blocking the cookie as third-party?
5. Is the ALB forwarding `Set-Cookie` unchanged?

### 4.5 Files and folders to add

```text
TaskApp/
├─ Dockerfile.api
├─ Dockerfile.web
├─ docker-compose.prod.yml
├─ .dockerignore
├─ infra/
│  ├─ versions.tf
│  ├─ backend.tf
│  ├─ variables.tf
│  ├─ network.tf
│  ├─ security.tf
│  ├─ iam.tf
│  ├─ s3.tf
│  ├─ ecr.tf
│  ├─ ec2.tf
│  ├─ alb.tf
│  ├─ rds.tf
│  ├─ cloudwatch.tf
│  ├─ ssm.tf
│  ├─ outputs.tf
│  ├─ user-data.sh.tftpl
│  └─ terraform.tfvars.example
├─ .github/workflows/
│  ├─ ci.yml
│  └─ deploy.yml
├─ apps/api/src/modules/attachments/
│  ├─ attachment.controller.ts
│  ├─ attachment.mapper.ts
│  ├─ attachment.repository.ts
│  ├─ attachment.routes.ts
│  ├─ attachment.schemas.ts
│  ├─ attachment.service.ts
│  ├─ file-storage.ts
│  └─ s3-file-storage.ts
├─ apps/web/src/lib/api/attachments.api.ts
├─ apps/web/src/hooks/use-attachments.ts
└─ apps/web/src/components/tasks/task-attachments.tsx
```

---

## 5. Application implementation blueprint

### 5.1 Prisma schema changes

Add an attachment model and a relation on `Task`:

```prisma
enum AttachmentStatus {
  PENDING
  UPLOADED
  FAILED

  @@map("attachment_status")
}

model Attachment {
  id          String           @id @default(cuid())
  taskId      String           @map("task_id")
  task        Task             @relation(fields: [taskId], references: [id], onDelete: Cascade)
  storageKey  String           @unique @map("storage_key")
  fileName    String           @map("file_name")
  contentType String           @map("content_type")
  sizeBytes   Int              @map("size_bytes")
  status      AttachmentStatus @default(PENDING)
  uploadedAt  DateTime?        @map("uploaded_at")
  createdAt   DateTime         @default(now()) @map("created_at")
  updatedAt   DateTime         @updatedAt @map("updated_at")

  @@index([taskId, createdAt])
  @@index([status])
  @@map("attachments")
}
```

Add to `Task`:

```prisma
attachments Attachment[]
```

Why these fields:

- `storageKey` is the S3 object key, unique and server-generated.
- `fileName` is the display name, sanitized.
- `contentType` and `sizeBytes` are verified after upload.
- `status` distinguishes an intent to upload from a completed upload.
- `uploadedAt` records when verification succeeded.
- `onDelete: Cascade` removes rows when a task is deleted, but the service must also delete S3 objects.

Run locally:

```bash
npx prisma migrate dev --name add_attachments
```

Production:

```bash
npx prisma migrate deploy
```

### 5.2 Backend module structure

Follow the existing layered pattern:

```text
routes → controller → service → repository
                 ↘ file storage
```

- **Routes** wire HTTP paths and middleware.
- **Controller** parses/validates input and shapes the response envelope.
- **Service** enforces ownership and business rules.
- **Repository** talks to Prisma.
- **FileStorage** abstracts S3 so tests can use an in-memory fake.

### 5.3 Storage abstraction

```ts
// apps/api/src/modules/attachments/file-storage.ts
export interface UploadUrlInput {
  key: string;
  contentType: string;
  expiresInSeconds: number;
}

export interface DownloadUrlInput {
  key: string;
  fileName: string;
  expiresInSeconds: number;
}

export interface StoredObject {
  contentLength?: number;
  contentType?: string;
}

export interface FileStorage {
  createUploadUrl(input: UploadUrlInput): Promise<string>;
  createDownloadUrl(input: DownloadUrlInput): Promise<string>;
  headObject(key: string): Promise<StoredObject | null>;
  deleteObject(key: string): Promise<void>;
}
```

S3 implementation sketch:

```ts
// apps/api/src/modules/attachments/s3-file-storage.ts
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import type { FileStorage, StoredObject } from "./file-storage";

export class S3FileStorage implements FileStorage {
  private readonly client: S3Client;

  constructor(
    private readonly bucket: string,
    region: string,
    options?: { endpoint?: string; forcePathStyle?: boolean },
  ) {
    this.client = new S3Client({
      region,
      endpoint: options?.endpoint,
      forcePathStyle: options?.forcePathStyle,
    });
  }

  createUploadUrl(input: {
    key: string;
    contentType: string;
    expiresInSeconds: number;
  }): Promise<string> {
    return getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        ContentType: input.contentType,
      }),
      { expiresIn: input.expiresInSeconds },
    );
  }

  createDownloadUrl(input: {
    key: string;
    fileName: string;
    expiresInSeconds: number;
  }): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        ResponseContentDisposition: `attachment; filename="${input.fileName}"`,
      }),
      { expiresIn: input.expiresInSeconds },
    );
  }

  async headObject(key: string): Promise<StoredObject | null> {
    try {
      const result = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return {
        contentLength: result.ContentLength,
        contentType: result.ContentType,
      };
    } catch (error) {
      if (
        error instanceof Error &&
        (error.name === "NotFound" || error.name === "NoSuchKey")
      ) {
        return null;
      }
      throw error;
    }
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}
```

### 5.4 Service rules

The `AttachmentService` should enforce:

1. **Task ownership** — the task belongs to the authenticated user.
2. **Attachment ownership** — the attachment belongs to that task.
3. **Allowed content types** — for example `image/png`, `image/jpeg`, `application/pdf`, `text/plain`, `application/zip`.
4. **Maximum size** — for example 25 MB, checked before signing and verified after upload.
5. **Server-generated key** — never accept a client-provided S3 key.
6. **Short expiry** — 5 minutes for upload, 1–5 minutes for download.
7. **Status transitions** — `PENDING → UPLOADED`, or `PENDING → FAILED`.
8. **Verification** — `HeadObject` before marking `UPLOADED`.
9. **Cleanup** — delete the S3 object when the attachment or task is deleted.

Pseudo-code:

```ts
async createUpload(userId: string, taskId: string, input: CreateAttachmentInput) {
  const task = await this.tasks.findByIdForUser(taskId, userId);
  if (!task) throw new NotFoundError("Task not found");

  const key = buildAttachmentKey(userId, taskId, input.fileName);
  const attachment = await this.repository.create({
    taskId,
    storageKey: key,
    fileName: sanitizeFileName(input.fileName),
    contentType: input.contentType,
    sizeBytes: input.sizeBytes,
    status: "PENDING",
  });

  const uploadUrl = await this.storage.createUploadUrl({
    key,
    contentType: input.contentType,
    expiresInSeconds: this.uploadTtlSeconds,
  });

  return { attachment: toAttachmentDto(attachment), uploadUrl };
}

async complete(userId: string, taskId: string, attachmentId: string) {
  const attachment = await this.repository.findByIdForTaskAndUser(
    attachmentId,
    taskId,
    userId,
  );
  if (!attachment) throw new NotFoundError("Attachment not found");
  if (attachment.status === "UPLOADED") return toAttachmentDto(attachment);

  const head = await this.storage.headObject(attachment.storageKey);
  if (!head) throw new ConflictError("Upload was not found in storage");

  if (head.contentLength !== attachment.sizeBytes) {
    await this.storage.deleteObject(attachment.storageKey);
    await this.repository.markFailed(attachment.id);
    throw new BadRequestError("Uploaded file size does not match");
  }

  const updated = await this.repository.markUploaded(attachment.id);
  return toAttachmentDto(updated);
}
```

### 5.5 API endpoints

| Method | Path | Purpose | Response |
|---|---|---|---|
| `POST` | `/api/v1/tasks/:taskId/attachments` | Create upload intent + pre-signed URL | `{ attachment, uploadUrl, expiresAt }` |
| `POST` | `/api/v1/tasks/:taskId/attachments/:id/complete` | Verify object and mark uploaded | `{ attachment }` |
| `GET` | `/api/v1/tasks/:taskId/attachments` | List attachments | `{ data: AttachmentDto[] }` |
| `GET` | `/api/v1/tasks/:taskId/attachments/:id/download-url` | Get pre-signed download URL | `{ url, expiresAt }` |
| `DELETE` | `/api/v1/tasks/:taskId/attachments/:id` | Delete row and S3 object | `204 No Content` |

All endpoints require authentication. Return the existing API envelope and error shape so the frontend stays consistent.

### 5.6 Frontend implementation

Add shared types in `packages/shared`:

```ts
export interface AttachmentDto {
  id: string;
  taskId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  status: "PENDING" | "UPLOADED" | "FAILED";
  createdAt: string;
  uploadedAt: string | null;
}

export interface CreateAttachmentInput {
  fileName: string;
  contentType: string;
  sizeBytes: number;
}
```

Add `attachments.api.ts` following the `tasks.api.ts` pattern:

```ts
export const attachmentsApi = {
  list(taskId: string): Promise<AttachmentDto[]> {
    return apiRequest<AttachmentDto[]>(`/tasks/${taskId}/attachments`).then(
      (response) => response.data,
    );
  },

  create(taskId: string, input: CreateAttachmentInput) {
    return apiRequest<CreateUploadResult>(
      `/tasks/${taskId}/attachments`,
      { method: "POST", body: input },
    ).then((response) => response.data);
  },

  complete(taskId: string, attachmentId: string) {
    return apiRequest<AttachmentDto>(
      `/tasks/${taskId}/attachments/${attachmentId}/complete`,
      { method: "POST" },
    ).then((response) => response.data);
  },

  downloadUrl(taskId: string, attachmentId: string) {
    return apiRequest<{ url: string; expiresAt: string }>(
      `/tasks/${taskId}/attachments/${attachmentId}/download-url`,
    ).then((response) => response.data);
  },

  remove(taskId: string, attachmentId: string) {
    return apiRequest<void>(
      `/tasks/${taskId}/attachments/${attachmentId}`,
      { method: "DELETE" },
    ).then(() => undefined);
  },
};
```

Upload with progress using `XMLHttpRequest` (the Fetch API does not expose upload progress):

```ts
function uploadToS3(url: string, file: File, onProgress: (percent: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`S3 upload failed with ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("S3 upload failed"));
    xhr.send(file);
  });
}
```

Component behavior:

- Render attachments in `task-details-view.tsx` as a new card.
- Show file name, size, status and actions.
- Show an accessible progress bar with `role="progressbar"` and `aria-valuenow`.
- Use `aria-live="polite"` for upload completion and errors.
- Disable the file input while uploading.
- On success, call `complete`, then invalidate the attachments query.
- On delete, optimistically remove the row, then roll back on error.
- Download by requesting a fresh URL and opening it; do not cache URLs.

### 5.7 Environment variables

API additions:

```text
AWS_REGION=eu-central-1
S3_BUCKET=taskapp-demo-attachments-<account-id>
S3_KEY_PREFIX=attachments
S3_UPLOAD_URL_TTL_SECONDS=300
S3_DOWNLOAD_URL_TTL_SECONDS=300
S3_MAX_FILE_BYTES=26214400
S3_ENDPOINT_URL=            # optional, for LocalStack
S3_PUBLIC_ENDPOINT_URL=     # optional browser-facing LocalStack URL in Docker
S3_FORCE_PATH_STYLE=false   # true for LocalStack
```

Add these to `apps/api/src/config/env.ts` with Zod validation. Example:

```ts
AWS_REGION: z.string().default("eu-central-1"),
S3_BUCKET: z.string().min(3),
S3_KEY_PREFIX: z.string().default("attachments"),
S3_UPLOAD_URL_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(300),
S3_DOWNLOAD_URL_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(300),
S3_MAX_FILE_BYTES: z.coerce.number().int().positive().default(25 * 1024 * 1024),
S3_ENDPOINT_URL: z.string().url().optional(),
S3_PUBLIC_ENDPOINT_URL: z.string().url().optional(),
S3_FORCE_PATH_STYLE: z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true"),
```

Web additions:

```text
API_ORIGIN=http://api:4200        # server-side only, for the Next rewrite
NEXT_PUBLIC_API_BASE_URL=/api/v1  # baked at build time
```

Do **not** put AWS access keys in either `.env` file. On EC2, the instance role provides credentials. Locally, use `AWS_PROFILE` or LocalStack dummy credentials.

### 5.8 Testing

- **Unit tests:** fake `FileStorage` and in-memory repository; test ownership, validation, status transitions and verification failure.
- **HTTP integration tests:** use the existing Supertest setup with a fake storage implementation.
- **Local S3 tests:** run LocalStack and exercise real pre-signed URLs.
- **Terraform checks:** `terraform fmt -check`, `terraform validate`, `terraform plan`, and optionally `tflint` / `checkov`.
- **Manual smoke test:** login, create task, upload PDF, download it, delete it, confirm the S3 object is gone.

## 6. Containerization

### 6.1 API Dockerfile

Create `Dockerfile.api` at the repository root so it can access the workspace packages:

```dockerfile
# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl

COPY package.json package-lock.json .npmrc ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN npm ci

FROM base AS build
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build:shared
RUN npm run build -w @taskapp/api

# Migration/seed image: keeps dev dependencies so Prisma CLI and tsx exist.
FROM build AS migrator
WORKDIR /app/apps/api
CMD ["npx", "prisma", "migrate", "deploy"]

# Production dependencies only.
FROM build AS prod-deps
RUN npm prune --omit=dev

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/package.json ./package.json
COPY --from=prod-deps /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=prod-deps /app/packages/shared/dist ./packages/shared/dist
COPY --from=prod-deps /app/apps/api/package.json ./apps/api/package.json
COPY --from=prod-deps /app/apps/api/dist ./apps/api/dist
COPY --from=prod-deps /app/apps/api/prisma ./apps/api/prisma

WORKDIR /app/apps/api
USER node
EXPOSE 4200

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4200/api/v1/health || exit 1

CMD ["node", "dist/server.js"]
```

Notes:

- `openssl` is needed by Prisma on Alpine.
- Prisma Client is generated during `npm run build -w @taskapp/api`.
- Build the migration image separately:
  ```bash
  docker build --target migrator -f Dockerfile.api -t taskapp-api-migrator:local .
  ```
- If `npm prune --omit=dev` causes workspace issues, copy the full `node_modules` from `build` instead. Correctness first, image size second.
- Never copy `.env` into the image.

### 6.2 Web Dockerfile and Next standalone output

Add `output: "standalone"` to `apps/web/next.config.ts`:

```ts
const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  transpilePackages: ["@taskapp/shared"],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiOrigin}/api/:path*`,
      },
    ];
  },
};
```

Create `Dockerfile.web`:

```dockerfile
# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS base
WORKDIR /app

COPY package.json package-lock.json .npmrc ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN npm ci

FROM base AS build
ARG NEXT_PUBLIC_API_BASE_URL=/api/v1
ARG API_ORIGIN=http://localhost:4200
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV API_ORIGIN=$API_ORIGIN

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN npm run build:shared
RUN npm run build -w @taskapp/web

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3100
ENV HOSTNAME=0.0.0.0

COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static

USER node
EXPOSE 3100

CMD ["node", "apps/web/server.js"]
```

If the project later adds `apps/web/public`, copy it too:

```dockerfile
COPY --from=build /app/apps/web/public ./apps/web/public
```

Build:

```bash
docker build \
  --build-arg NEXT_PUBLIC_API_BASE_URL=/api/v1 \
  --build-arg API_ORIGIN=http://api:4200 \
  -f Dockerfile.web \
  -t taskapp-demo-web:local .
```

> `NEXT_PUBLIC_*` values are baked into the JavaScript bundle. If the API base URL changes, rebuild the image.

> `API_ORIGIN` is read by `next.config.ts` during the build, so pass it as a build arg if the Next rewrite will run inside Docker. In AWS, the ALB `/api/*` rule bypasses the Next rewrite, so this value is less important there.

> After the first standalone build, verify the server entry point:
> `find apps/web/.next/standalone -name server.js`.
> In a monorepo it is usually `apps/web/server.js`; adjust the Dockerfile `CMD` if your Next version places it elsewhere. If Next warns about tracing the monorepo root, set `outputFileTracingRoot` in `next.config.ts`.

### 6.3 Compose files

There are two compose files, each with a different job:

| File | Purpose |
|---|---|
| `docker-compose.yml` | Developer services: PostgreSQL on `5433` and LocalStack on `4566`. Started by `npm run db:up`. |
| `docker-compose.prod.yml` | Production-shaped local stack: PostgreSQL `5434`, LocalStack `4567`, migration job, API `4201` and web `3101`. Uses Compose project `taskapp-prod`. |
| `deploy/docker-compose.aws.yml` | EC2 runtime file written to `/opt/taskapp/docker-compose.yml` by user data. Uses ECR images and the `awslogs` driver. |

Local production-shaped stack:

```bash
npm run docker:build
npm run docker:up
npm run docker:seed
```

The EC2 file is rendered into user data with the repository names supplied by Terraform:

```yaml
services:
  api:
    image: ${ECR_REGISTRY}/${API_REPO}:${IMAGE_TAG}
    env_file: /opt/taskapp/api.env
    ports:
      - "4200:4200"
    logging:
      driver: awslogs
      options:
        awslogs-region: ${AWS_REGION}
        awslogs-group: ${LOG_GROUP_API}
        awslogs-stream: api

  web:
    image: ${ECR_REGISTRY}/${WEB_REPO}:${IMAGE_TAG}
    environment:
      API_ORIGIN: http://api:4200
    ports:
      - "3100:3100"
    depends_on:
      api:
        condition: service_healthy
    logging:
      driver: awslogs
      options:
        awslogs-region: ${AWS_REGION}
        awslogs-group: ${LOG_GROUP_WEB}
        awslogs-stream: web
```

The EC2 deploy script pulls the images, runs the migrator image (`prisma migrate deploy` and the idempotent seed), then starts the API and web containers. See `infra/user-data.sh.tftpl`.

### 6.4 `.dockerignore`

```text
node_modules
**/node_modules
**/dist
**/.next
.git
.gitignore
.env
.env.*
!.env.example
infra
*.md
```

Excluding `infra` keeps Terraform state and plans out of the image build context.

### 6.5 Image tagging and rollback

- Tag with the Git SHA: `taskapp-demo-api:abc1234`.
- Never deploy `latest`; it is mutable and hides which code is running.
- Keep the previous few tags in ECR with a lifecycle policy.
- Rollback = set `IMAGE_TAG` to the previous SHA and run `docker compose up -d`.

### 6.6 Local S3 with LocalStack

The repository uses LocalStack **3.8.1** for local attachments. The service is defined in `docker-compose.yml` and the bucket/CORS setup is in `scripts/localstack-init.sh`:

```yaml
services:
  localstack:
    image: localstack/localstack:3.8.1
    environment:
      SERVICES: s3
      DEBUG: 0
      PERSISTENCE: 1
      AWS_DEFAULT_REGION: us-east-1
    ports:
      - "4566:4566"
    volumes:
      - taskapp-localstack-data:/var/lib/localstack
      - ./scripts/localstack-init.sh:/etc/localstack/init/ready.d/init-s3.sh:ro
```

API environment for the developer stack:

```text
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
S3_ENDPOINT_URL=http://localhost:4566
S3_FORCE_PATH_STYLE=true
S3_BUCKET=taskapp-attachments
```

When the API runs in the production-shaped Docker stack, it reaches LocalStack at `http://localstack:4566`, while pre-signed URLs must use the browser-facing `http://localhost:4567`. That is why the API supports both `S3_ENDPOINT_URL` and `S3_PUBLIC_ENDPOINT_URL`.

Check the bucket:

```bash
docker compose exec localstack awslocal s3 ls
```

This lets you test pre-signed uploads without an AWS account.

---

## 7. Terraform implementation

### 7.1 Layout

Start with one root module under `infra/`:

```text
infra/
├─ versions.tf          Terraform and provider versions
├─ backend.tf           S3 state backend
├─ variables.tf         Inputs
├─ network.tf           VPC, subnets, IGW, route tables
├─ security.tf          Security groups
├─ iam.tf               EC2 role, policies, instance profile
├─ s3.tf                Private attachment bucket
├─ ecr.tf               Image repositories
├─ ec2.tf               Instance, EIP, user data
├─ alb.tf               ALB, target groups, listeners, ACM
├─ rds.tf               PostgreSQL instance and subnet group
├─ cloudwatch.tf        Log groups, alarms, dashboard
├─ ssm.tf               Secure parameters and KMS key
├─ outputs.tf           URLs, IDs, endpoints
├─ user-data.sh.tftpl   First-boot script
└─ terraform.tfvars.example
```

Add these to `.gitignore` before the first `apply`:

```text
infra/.terraform/
infra/*.tfstate
infra/*.tfstate.*
infra/*.tfplan
infra/terraform.tfvars
```

Commit `terraform.tfvars.example`, never the real `terraform.tfvars` if it contains secrets. Terraform state can contain secrets even when variables are marked sensitive, so it must stay in the encrypted S3 backend.

### 7.2 Bootstrap the state bucket

Terraform cannot create its own backend bucket. Create it once with the CLI:

```bash
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=eu-central-1
BUCKET="taskapp-demo-tfstate-${ACCOUNT_ID}"

aws s3api create-bucket \
  --bucket "$BUCKET" \
  --region "$REGION" \
  --create-bucket-configuration LocationConstraint="$REGION"

aws s3api put-bucket-versioning \
  --bucket "$BUCKET" \
  --versioning-configuration Status=Enabled

aws s3api put-bucket-encryption \
  --bucket "$BUCKET" \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {"SSEAlgorithm": "AES256"}
    }]
  }'

aws s3api put-public-access-block \
  --bucket "$BUCKET" \
  --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
```

Then `backend.tf`:

```hcl
terraform {
  backend "s3" {
    bucket       = "taskapp-demo-tfstate-123456789012"
    key          = "demo/terraform.tfstate"
    region       = "eu-central-1"
    encrypt      = true
    use_lockfile = true
  }
}
```

Replace the account ID. Do not commit `terraform.tfstate`; it lives in S3.

### 7.3 Versions and provider

```hcl
# infra/versions.tf
terraform {
  required_version = ">= 1.10.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.7"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

data "aws_caller_identity" "current" {}
```

`default_tags` applies tags to every resource that supports tags, reducing repetition. The `aws_caller_identity` data source is used to build unique bucket and registry names.

### 7.4 Variables

```hcl
# infra/variables.tf
variable "aws_region" {
  type    = string
  default = "eu-central-1"
}

variable "project" {
  type    = string
  default = "taskapp"
}

variable "environment" {
  type    = string
  default = "demo"
}

variable "domain_name" {
  type = string
}

variable "alert_email" {
  type = string
}

variable "instance_type" {
  type    = string
  default = "t3.small"
}

variable "db_instance_class" {
  type    = string
  default = "db.t4g.micro"
}

variable "image_tag" {
  type    = string
  default = "initial"
}
```

Example `terraform.tfvars` (no secrets):

```hcl
aws_region        = "eu-central-1"
project           = "taskapp"
environment       = "demo"
domain_name       = "app.example.com"
hosted_zone_name  = "example.com"
alert_email       = "you@example.com"
instance_type     = "t3.small"
db_instance_class = "db.t4g.micro"
image_tag         = "initial"
```

Database and JWT secrets are generated by Terraform with `random_password` and stored in SSM, so they do not belong in `terraform.tfvars`.

### 7.5 Network

ALB requires at least two public subnets in different AZs. RDS uses two private subnets.

```hcl
# infra/network.tf
data "aws_availability_zones" "available" {
  state = "available"
}

resource "aws_vpc" "main" {
  cidr_block           = "10.20.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true
}

resource "aws_subnet" "public" {
  count                   = 2
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.20.${count.index + 1}.0/24"
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true
}

resource "aws_subnet" "private" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.20.${count.index + 11}.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }
}

resource "aws_route_table_association" "public" {
  count          = length(aws_subnet.public)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_db_subnet_group" "main" {
  name       = "${var.project}-${var.environment}-db"
  subnet_ids = aws_subnet.private[*].id
}
```

The private subnets have no route to the internet. RDS does not need one. The EC2 instance sits in `aws_subnet.public[0]` so it can pull images and reach SSM without a NAT Gateway.

### 7.6 Security groups

```hcl
# infra/security.tf
resource "aws_security_group" "alb" {
  name        = "${var.project}-${var.environment}-alb"
  description = "Public HTTPS/HTTP to the ALB"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTP redirect"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description     = "Web target"
    from_port       = 3100
    to_port         = 3100
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }

  egress {
    description     = "API target"
    from_port       = 4200
    to_port         = 4200
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }
}

resource "aws_security_group" "app" {
  name        = "${var.project}-${var.environment}-app"
  description = "EC2 application instance"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Web from ALB only"
    from_port       = 3100
    to_port         = 3100
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  ingress {
    description     = "API from ALB only"
    from_port       = 4200
    to_port         = 4200
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  # No inbound SSH. Use SSM Session Manager.

  egress {
    description = "HTTPS to S3, ECR, CloudWatch, SSM"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description     = "PostgreSQL to RDS"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.db.id]
  }
}

resource "aws_security_group" "db" {
  name        = "${var.project}-${var.environment}-db"
  description = "PostgreSQL from the app only"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "PostgreSQL from app"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }

  # No public ingress.
}
```

> Security groups are stateful. You do not need to allow return traffic explicitly.

> **If you must keep SSH as a fallback:** add an ingress rule for port `22` from your current public IP as a `/32` only, never from `0.0.0.0/0`. The recommended path in this guide is SSM Session Manager, which needs no inbound SSH at all.

### 7.7 IAM role and instance profile

```hcl
# infra/iam.tf
data "aws_iam_policy_document" "ec2_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "app" {
  name               = "${var.project}-${var.environment}-ec2"
  assume_role_policy = data.aws_iam_policy_document.ec2_assume.json
}

resource "aws_iam_role_policy_attachment" "ssm_core" {
  role       = aws_iam_role.app.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

data "aws_iam_policy_document" "app" {
  statement {
    sid    = "AttachmentObjects"
    effect = "Allow"
    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
    ]
    resources = ["${aws_s3_bucket.attachments.arn}/attachments/*"]
  }

  statement {
    sid       = "ListAttachmentPrefix"
    effect    = "Allow"
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.attachments.arn]

    condition {
      test     = "StringLike"
      variable = "s3:prefix"
      values   = ["attachments/*"]
    }
  }

  statement {
    sid    = "EcrAuth"
    effect = "Allow"
    actions = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  statement {
    sid    = "EcrPull"
    effect = "Allow"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:GetDownloadUrlForLayer",
      "ecr:BatchGetImage",
    ]
    resources = [
      aws_ecr_repository.api.arn,
      aws_ecr_repository.web.arn,
    ]
  }

  statement {
    sid    = "CloudWatchLogs"
    effect = "Allow"
    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]
    resources = [
      "${aws_cloudwatch_log_group.api.arn}:*",
      "${aws_cloudwatch_log_group.web.arn}:*",
    ]
  }

  statement {
    sid    = "ReadParameters"
    effect = "Allow"
    actions = [
      "ssm:GetParameter",
      "ssm:GetParameters",
      "ssm:GetParametersByPath",
    ]
    resources = ["arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/${var.project}/${var.environment}/*"]
  }

  statement {
    sid       = "DecryptParameters"
    effect    = "Allow"
    actions   = ["kms:Decrypt"]
    resources = [aws_kms_key.ssm.arn]
  }
}

resource "aws_iam_policy" "app" {
  name   = "${var.project}-${var.environment}-app"
  policy = data.aws_iam_policy_document.app.json
}

resource "aws_iam_role_policy_attachment" "app" {
  role       = aws_iam_role.app.name
  policy_arn = aws_iam_policy.app.arn
}

resource "aws_iam_instance_profile" "app" {
  name = "${var.project}-${var.environment}-ec2"
  role = aws_iam_role.app.name
}
```

### 7.8 Private S3 bucket

```hcl
# infra/s3.tf
resource "aws_s3_bucket" "attachments" {
  bucket        = "${var.project}-${var.environment}-attachments-${data.aws_caller_identity.current.account_id}"
  force_destroy = var.environment != "prod"
}

resource "aws_s3_bucket_public_access_block" "attachments" {
  bucket = aws_s3_bucket.attachments.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "attachments" {
  bucket = aws_s3_bucket.attachments.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_versioning" "attachments" {
  bucket = aws_s3_bucket.attachments.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "attachments" {
  bucket = aws_s3_bucket.attachments.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "attachments" {
  bucket = aws_s3_bucket.attachments.id

  rule {
    id     = "abort-incomplete-uploads"
    status = "Enabled"

    filter {}

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

resource "aws_s3_bucket_cors_configuration" "attachments" {
  bucket = aws_s3_bucket.attachments.id

  cors_rule {
    allowed_origins = ["https://${var.domain_name}"]
    allowed_methods = ["GET", "PUT", "HEAD"]
    allowed_headers = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}
```

No bucket policy is needed for the API. The EC2 role grants access. The browser gets temporary access only through pre-signed URLs.

### 7.9 ECR repositories

```hcl
# infra/ecr.tf
resource "aws_ecr_repository" "api" {
  name                 = "${var.project}-api"
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_repository" "web" {
  name                 = "${var.project}-web"
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_lifecycle_policy" "api" {
  repository = aws_ecr_repository.api.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep the last 10 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 10
      }
      action = { type = "expire" }
    }]
  })
}
```

Add the same lifecycle policy for the web repository. The migration image can use the API repository with a different tag prefix, or a third repository if you prefer.

### 7.10 EC2 instance and user data

> The final implementation is in `infra/ec2.tf` and `infra/user-data.sh.tftpl`. The sketch below shows the learning progression; the final version writes `deploy/docker-compose.aws.yml` directly with `file(...)`, uses `/opt/taskapp/api.env`, and runs the separate migrator repository.

```hcl
# infra/ec2.tf
data "aws_ami" "al2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-2023.*-x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

resource "aws_instance" "app" {
  ami                    = data.aws_ami.al2023.id
  instance_type          = var.instance_type
  subnet_id              = aws_subnet.public[0].id
  vpc_security_group_ids = [aws_security_group.app.id]
  iam_instance_profile   = aws_iam_instance_profile.app.name

  user_data = templatefile("${path.module}/user-data.sh.tftpl", {
    aws_region   = var.aws_region
    project      = var.project
    environment  = var.environment
    ecr_registry = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.aws_region}.amazonaws.com"
    image_tag    = var.image_tag
    compose_b64  = base64encode(file("${path.module}/../docker-compose.prod.yml"))
  })

  user_data_replace_on_change = true

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required" # IMDSv2 only
    http_put_response_hop_limit = 2          # lets containers reach IMDS
  }

  root_block_device {
    volume_size = 30
    volume_type = "gp3"
    encrypted   = true
  }

  depends_on = [
    aws_iam_role_policy_attachment.app,
    aws_iam_role_policy_attachment.ssm_core,
    aws_cloudwatch_log_group.api,
    aws_cloudwatch_log_group.web,
    aws_ssm_parameter.database_url,
    aws_ssm_parameter.jwt_access_secret,
    aws_ssm_parameter.s3_bucket,
    aws_ssm_parameter.cors_origins,
    aws_s3_bucket.attachments,
    aws_ecr_repository.api,
    aws_ecr_repository.web,
  ]
}

resource "aws_eip" "app" {
  domain   = "vpc"
  instance = aws_instance.app.id
}
```

`user-data.sh.tftpl`:

```bash
#!/bin/bash
set -euxo pipefail

# 1. Base packages
dnf update -y
dnf install -y docker awscli-2 || dnf install -y docker awscli
systemctl enable --now docker
usermod -aG docker ec2-user || true

# 2. Docker Compose plugin
mkdir -p /usr/local/lib/docker/cli-plugins
curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# 3. Application directory and compose file
mkdir -p /opt/taskapp
echo "${compose_b64}" | base64 -d > /opt/taskapp/docker-compose.prod.yml

# 4. Fetch secrets from SSM Parameter Store
: > /opt/taskapp/api.env
for name in DATABASE_URL JWT_ACCESS_SECRET S3_BUCKET CORS_ORIGINS; do
  value=$(aws ssm get-parameter \
    --name "/${project}/${environment}/$${name}" \
    --with-decryption \
    --query Parameter.Value \
    --output text)
  echo "$${name}=$${value}" >> /opt/taskapp/api.env
done

# 5. Non-secret runtime configuration
cat >> /opt/taskapp/api.env <<EOF
NODE_ENV=production
PORT=4200
AWS_REGION=${aws_region}
S3_KEY_PREFIX=attachments
S3_UPLOAD_URL_TTL_SECONDS=300
S3_DOWNLOAD_URL_TTL_SECONDS=300
S3_MAX_FILE_BYTES=26214400
LOG_LEVEL=info
EOF
chmod 600 /opt/taskapp/api.env

# 6. Pull and start
export AWS_REGION=${aws_region}
export ECR_REGISTRY=${ecr_registry}
export IMAGE_TAG=${image_tag}

aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "$ECR_REGISTRY"

cd /opt/taskapp
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml --profile tools run --rm migrate
docker compose -f docker-compose.prod.yml up -d
```

The `compose_b64` trick avoids Terraform trying to interpolate `${ECR_REGISTRY}` and other `${...}` placeholders inside the Compose file.

> **Terraform template escaping:** `templatefile` treats `${...}` as Terraform interpolation. Shell variables that should be expanded later on the instance must be written as `$${name}`. The `$name` and `$(command)` forms are left alone by Terraform. This is a common source of confusing first-boot failures.

### 7.11 ALB, ACM and Route 53

Add a hosted zone variable if your DNS zone differs from the app hostname:

```hcl
variable "hosted_zone_name" {
  type = string
}
```

Certificate and validation:

```hcl
# infra/alb.tf
data "aws_route53_zone" "main" {
  name = var.hosted_zone_name
}

resource "aws_acm_certificate" "main" {
  domain_name       = var.domain_name
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "cert_validation" {
  for_each = {
    for option in aws_acm_certificate.main.domain_validation_options :
    option.domain_name => option
  }

  zone_id = data.aws_route53_zone.main.zone_id
  name    = each.value.resource_record_name
  type    = each.value.resource_record_type
  records = [each.value.resource_record_value]
  ttl     = 60
}

resource "aws_acm_certificate_validation" "main" {
  certificate_arn         = aws_acm_certificate.main.arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]
}

resource "aws_route53_record" "app" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }
}
```

If your DNS is not in Route 53, create the certificate in ACM manually and use its ARN instead of the validation resources.

ALB and target groups:

```hcl
resource "aws_lb" "main" {
  name               = "${var.project}-${var.environment}"
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id
}

resource "aws_lb_target_group" "web" {
  name     = "${var.project}-${var.environment}-web"
  port     = 3100
  protocol = "HTTP"
  vpc_id   = aws_vpc.main.id

  health_check {
    path                = "/login"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }
}

resource "aws_lb_target_group" "api" {
  name     = "${var.project}-${var.environment}-api"
  port     = 4200
  protocol = "HTTP"
  vpc_id   = aws_vpc.main.id

  health_check {
    path                = "/api/v1/health"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }
}

resource "aws_lb_target_group_attachment" "web" {
  target_group_arn = aws_lb_target_group.web.arn
  target_id        = aws_instance.app.id
  port             = 3100
}

resource "aws_lb_target_group_attachment" "api" {
  target_group_arn = aws_lb_target_group.api.arn
  target_id        = aws_instance.app.id
  port             = 4200
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate_validation.main.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.web.arn
  }
}

resource "aws_lb_listener_rule" "api" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 10

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }

  condition {
    path_pattern {
      values = ["/api/*"]
    }
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}
```

The same EC2 instance can be attached to two target groups on different ports. The ALB sends `/api/*` to port `4200` and everything else to `3100`.

### 7.12 RDS PostgreSQL

```hcl
# infra/rds.tf
resource "random_password" "db" {
  length  = 32
  special = false # avoids URL-encoding issues in DATABASE_URL
}

resource "aws_db_parameter_group" "main" {
  name   = "${var.project}-${var.environment}-pg16"
  family = "postgres16"

  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }
}

resource "aws_db_instance" "main" {
  identifier = "${var.project}-${var.environment}-db"

  engine         = "postgres"
  engine_version = "16"
  instance_class = var.db_instance_class

  allocated_storage = 20
  storage_type      = "gp3"
  storage_encrypted = true

  db_name  = "taskapp"
  username = "taskapp"
  password = random_password.db.result

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.db.id]
  parameter_group_name   = aws_db_parameter_group.main.name

  publicly_accessible = false
  multi_az            = false

  backup_retention_period = 7
  auto_minor_version_upgrade = true
  apply_immediately          = true

  deletion_protection = false
  skip_final_snapshot = true

  enabled_cloudwatch_logs_exports = ["postgresql"]

  tags = {
    Name = "${var.project}-${var.environment}-db"
  }
}
```

For production, set `multi_az = true`, `deletion_protection = true`, `skip_final_snapshot = false`, and a final snapshot identifier.

### 7.13 CloudWatch logs and alarms

```hcl
# infra/cloudwatch.tf
resource "aws_cloudwatch_log_group" "api" {
  name              = "/${var.project}/${var.environment}/api"
  retention_in_days = 14
}

resource "aws_cloudwatch_log_group" "web" {
  name              = "/${var.project}/${var.environment}/web"
  retention_in_days = 14
}

resource "aws_sns_topic" "alarms" {
  name = "${var.project}-${var.environment}-alarms"
}

resource "aws_sns_topic_subscription" "email" {
  topic_arn = aws_sns_topic.alarms.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

resource "aws_cloudwatch_metric_alarm" "alb_5xx" {
  alarm_name          = "${var.project}-${var.environment}-alb-5xx"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  statistic           = "Sum"
  threshold           = 5
  alarm_description   = "API target returned 5xx responses"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  ok_actions          = [aws_sns_topic.alarms.arn]

  dimensions = {
    LoadBalancer = aws_lb.main.arn_suffix
    TargetGroup  = aws_lb_target_group.api.arn_suffix
  }
}

resource "aws_cloudwatch_metric_alarm" "rds_cpu" {
  alarm_name          = "${var.project}-${var.environment}-rds-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "RDS CPU is high"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  ok_actions          = [aws_sns_topic.alarms.arn]

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.identifier
  }
}

resource "aws_cloudwatch_metric_alarm" "ec2_status" {
  alarm_name          = "${var.project}-${var.environment}-ec2-status"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "StatusCheckFailed"
  namespace           = "AWS/EC2"
  period              = 60
  statistic           = "Maximum"
  threshold           = 1
  alarm_description   = "EC2 status check failed"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  ok_actions          = [aws_sns_topic.alarms.arn]

  dimensions = {
    InstanceId = aws_instance.app.id
  }
}
```

Add alarms for RDS free storage, database connections, ALB target response time and EC2 CPU as you learn. Start with a few meaningful alarms rather than dozens of noisy ones.

### 7.14 SSM parameters and KMS

```hcl
# infra/ssm.tf
resource "aws_kms_key" "ssm" {
  description             = "${var.project}-${var.environment} SSM parameters"
  enable_key_rotation     = true
  deletion_window_in_days = 7
}

resource "aws_ssm_parameter" "database_url" {
  name   = "/${var.project}/${var.environment}/DATABASE_URL"
  type   = "SecureString"
  key_id = aws_kms_key.ssm.key_id
  value  = "postgresql://taskapp:${random_password.db.result}@${aws_db_instance.main.address}:5432/taskapp?schema=public&sslmode=require&connection_limit=10"
}

resource "random_password" "jwt" {
  length  = 64
  special = false # avoids env-file and shell quoting surprises
}

resource "aws_ssm_parameter" "jwt_access_secret" {
  name   = "/${var.project}/${var.environment}/JWT_ACCESS_SECRET"
  type   = "SecureString"
  key_id = aws_kms_key.ssm.key_id
  value  = random_password.jwt.result
}

resource "aws_ssm_parameter" "s3_bucket" {
  name  = "/${var.project}/${var.environment}/S3_BUCKET"
  type  = "String"
  value = aws_s3_bucket.attachments.bucket
}

resource "aws_ssm_parameter" "cors_origins" {
  name  = "/${var.project}/${var.environment}/CORS_ORIGINS"
  type  = "String"
  value = "https://${var.domain_name}"
}
```

`SecureString` parameters are encrypted with the KMS key. The EC2 role has `kms:Decrypt` on that key and `ssm:GetParameter` on the `/taskapp/demo/*` path.

### 7.15 Outputs

```hcl
# infra/outputs.tf
output "app_url" {
  value = "https://${var.domain_name}"
}

output "alb_dns_name" {
  value = aws_lb.main.dns_name
}

output "instance_id" {
  value = aws_instance.app.id
}

output "attachment_bucket" {
  value = aws_s3_bucket.attachments.bucket
}

output "rds_endpoint" {
  value     = aws_db_instance.main.endpoint
  sensitive = true
}

output "ecr_api_repository_url" {
  value = aws_ecr_repository.api.repository_url
}

output "ecr_web_repository_url" {
  value = aws_ecr_repository.web.repository_url
}
```

### 7.16 Terraform commands

Bootstrap the state bucket once:

```bash
cd infra/bootstrap
cp terraform.tfvars.example terraform.tfvars
# edit the region/project/environment if needed
terraform init
terraform fmt
terraform validate
terraform plan -out=bootstrap.tfplan
terraform apply bootstrap.tfplan
```

Configure and apply the main stack:

```bash
cd ..
cp backend.hcl.example backend.hcl
# edit bucket and region to match the bootstrap output
cp terraform.tfvars.example terraform.tfvars
# edit domain_name, hosted_zone_name, alert_email and github_repository

terraform init -backend-config=backend.hcl
terraform fmt -recursive
terraform validate
terraform plan -out=tfplan
terraform apply tfplan

terraform output
terraform state list
terraform state show aws_db_instance.main
```

Later changes:

```bash
cd infra
terraform plan
terraform apply
```

Destroy the demo:

```bash
cd infra
terraform destroy
```

`terraform destroy` can fail if RDS deletion protection is enabled, the S3 bucket is not empty and `force_destroy` is false, or ECR still contains images. The demo settings use `force_destroy`/`force_delete` outside `prod`, no RDS deletion protection, and no final snapshot, so teardown is intended to be clean.

## 8. Deployment runbook

### 8.1 Prerequisites

- AWS CLI v2 authenticated with a non-root identity.
- Terraform >= 1.10.
- Docker Desktop running.
- A registered domain and a Route 53 hosted zone (or an ACM certificate created manually).
- An alert email address.
- Permission to create VPC, EC2, RDS, S3, IAM, ECR, ALB, CloudWatch and SSM resources.

Verify:

```bash
aws sts get-caller-identity
aws configure get region
terraform version
docker version
```

### 8.2 First deploy

**Step 1 ? Bootstrap Terraform state**

Follow Section 7.2 and Section 7.16. The bootstrap stack creates the encrypted S3 bucket used by the main stack backend. Copy the example files and edit them before applying:

```bash
cd infra/bootstrap
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform fmt
terraform validate
terraform plan -out=bootstrap.tfplan
terraform apply bootstrap.tfplan
```

**Step 2 ? Create the infrastructure**

```bash
cd ..
cp backend.hcl.example backend.hcl
cp terraform.tfvars.example terraform.tfvars
# edit domain_name, hosted_zone_name, alert_email and github_repository

terraform init -backend-config=backend.hcl
terraform fmt -recursive
terraform validate
terraform plan -out=tfplan
terraform apply tfplan
```

The first boot installs Docker, writes `/opt/taskapp/api.env` from SSM, and tries to pull the initial images. ECR is empty on the first pass, so the pull can fail harmlessly; the instance still becomes ready for SSM.

**Step 3 ? Capture outputs**

```bash
cd ..   # from infra to the repository root
ECR_REGISTRY=$(terraform -chdir=infra output -raw ecr_registry)
INSTANCE_ID=$(terraform -chdir=infra output -raw instance_id)
GIT_SHA=$(git rev-parse --short HEAD)

API_REPO="$ECR_REGISTRY/taskapp-demo-api"
WEB_REPO="$ECR_REGISTRY/taskapp-demo-web"
MIGRATOR_REPO="$ECR_REGISTRY/taskapp-demo-migrator"
```

Adjust the repository names if you changed `project` or `environment` from the defaults `taskapp` and `demo`.

**Step 4 ? Build and push images**

```bash
aws ecr get-login-password --region eu-central-1 \
  | docker login --username AWS --password-stdin "$ECR_REGISTRY"

docker build -f Dockerfile.api --target runner -t "$API_REPO:$GIT_SHA" .
docker push "$API_REPO:$GIT_SHA"

docker build -f Dockerfile.api --target migrator -t "$MIGRATOR_REPO:$GIT_SHA" .
docker push "$MIGRATOR_REPO:$GIT_SHA"

docker build -f Dockerfile.web --target runner \
  --build-arg API_ORIGIN=http://api:4200 \
  -t "$WEB_REPO:$GIT_SHA" .
docker push "$WEB_REPO:$GIT_SHA"
```

The GitHub Actions deploy workflow performs the same three builds and pushes automatically after a successful CI run on `main`.

**Step 5 ? Deploy through SSM**

```bash
COMMAND_ID=$(aws ssm send-command \
  --instance-ids "$INSTANCE_ID" \
  --document-name AWS-RunShellScript \
  --comment "Deploy TaskApp $GIT_SHA" \
  --parameters "commands=[\"/opt/taskapp/deploy.sh $GIT_SHA\"]" \
  --query Command.CommandId \
  --output text)

aws ssm wait command-executed \
  --command-id "$COMMAND_ID" \
  --instance-id "$INSTANCE_ID"

aws ssm get-command-invocation \
  --command-id "$COMMAND_ID" \
  --instance-id "$INSTANCE_ID" \
  --query "{Status:Status,Output:StandardOutputContent,Error:StandardErrorContent}" \
  --output json
```

`/opt/taskapp/deploy.sh` updates `IMAGE_TAG`, logs in to ECR, pulls the API and web images, runs the migrator image (`prisma migrate deploy`), runs the idempotent seed, and starts both containers.

**Step 6 ? Verify**

```bash
curl -I "https://app.example.com/login"
curl -s "https://app.example.com/api/v1/health"
aws logs tail /taskapp/demo/api --follow
aws logs tail /taskapp/demo/web --follow
```

Then in a browser:

1. Log in with the demo credentials.
2. Create a task.
3. Upload an attachment.
4. Download it.
5. Delete it and confirm the S3 object is gone.
6. Refresh the page and confirm the session survives.

Check alarms:

```bash
aws cloudwatch describe-alarms \
  --state-value ALARM \
  --query "MetricAlarms[].{Name:AlarmName,State:StateValue}" \
  --output table
```

### 8.3 Application update

1. Build and push a new image with a new Git SHA.
2. Run `/opt/taskapp/deploy.sh <new-sha>` through SSM.
3. Verify the health endpoint and logs.
4. If something fails, run `/opt/taskapp/deploy.sh <previous-sha>`.

The migration step runs before the new containers start. If a migration fails, the deploy script stops and the old containers keep running.

### 8.4 Database migration safety

Before a risky migration:

```bash
aws rds create-db-snapshot \
  --db-instance-identifier taskapp-demo-db \
  --db-snapshot-identifier taskapp-demo-pre-migration-$(date +%Y%m%d%H%M)
```

Then run `prisma migrate deploy`. Check status:

```bash
cd /opt/taskapp
set -a && . ./.env && set +a
docker run --rm --env-file /opt/taskapp/api.env \
  "$ECR_REGISTRY/$MIGRATOR_REPO:$IMAGE_TAG" npx prisma migrate status
```

Rules:

- Never run `prisma migrate dev` against RDS.
- Never rely on app startup to run migrations.
- Keep migrations backward-compatible during rolling deploys.
- Test the migration against a restored snapshot first for destructive changes.

### 8.5 Destroy

```bash
cd infra
terraform destroy
```

If destroy fails:

- RDS deletion protection: set it to `false` and apply, then destroy.
- S3 bucket not empty: `force_destroy = true` for the demo, or empty the bucket.
- ECR images: add `force_delete = true` to the demo repositories, or delete images.
- ALB/ENI leftovers: wait for the load balancer to finish deleting.

After destroy, confirm in the console that no billable EC2, RDS, ALB, EIP or NAT resources remain.

---

## 9. CI/CD with GitHub Actions

### 9.1 Why OIDC instead of access keys

GitHub Actions can assume an AWS role through OpenID Connect. No `AWS_ACCESS_KEY_ID` secret is stored in GitHub. The trust policy limits which repository, branch and environment can assume the role.

### 9.2 Create the OIDC provider and role

Terraform can manage these, or you can create them once:

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com
```

Trust policy for the deploy role:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {
      "Federated": "arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com"
    },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": {
        "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
      },
      "StringLike": {
        "token.actions.githubusercontent.com:sub": "repo:your-org/TaskApp:ref:refs/heads/main"
      }
    }
  }]
}
```

Permissions for the deploy role:

- `ecr:GetAuthorizationToken`
- `ecr:BatchCheckLayerAvailability`
- `ecr:InitiateLayerUpload`
- `ecr:UploadLayerPart`
- `ecr:CompleteLayerUpload`
- `ecr:PutImage`
- `ssm:SendCommand`
- `ssm:GetCommandInvocation`
- `ec2:DescribeInstances` (optional, for resolving the instance)

Scope `ssm:SendCommand` to the instance ARN and the `AWS-RunShellScript` document.

### 9.3 CI workflow

The actual workflow is `.github/workflows/ci.yml`. It runs on pull requests and pushes to `main`:

- **test:** `npm ci`, `npm run build:shared`, `npm run typecheck`, `npm run test`, `npm run build`.
- **terraform:** `terraform fmt -check -recursive infra`, then `terraform init -backend=false` and `terraform validate` in `infra` and `infra/bootstrap`.
- **containers:** builds the API `runner`, API `migrator` and web `runner` images without pushing, which catches Dockerfile regressions.

The core steps look like this:

```yaml
name: ci

on:
  pull_request:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run build:shared
      - run: npm run typecheck
      - run: npm run test
      - run: npm run build

  terraform:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: 1.10.5
      - run: terraform fmt -check -recursive infra
      - working-directory: infra
        run: |
          terraform init -backend=false -input=false
          terraform validate
      - working-directory: infra/bootstrap
        run: |
          terraform init -backend=false -input=false
          terraform validate
```

### 9.4 Deploy workflow

The actual workflow is `.github/workflows/deploy.yml`. It runs after a successful CI run on `main` (and can be dispatched manually). It:

1. Assumes the Terraform-managed GitHub OIDC role using the repository secret `AWS_DEPLOY_ROLE_ARN`.
2. Logs in to ECR and builds/pushes the API, migrator and web images tagged with the short Git SHA.
3. Finds the running instance by the `Project=taskapp` and `Environment=demo` tags.
4. Sends `/opt/taskapp/deploy.sh <sha>` through SSM Run Command, waits for completion, and fails the job if the command does not succeed.

No AWS access keys are stored in GitHub. The role trust policy is restricted to the configured repository and `main` branch.

```yaml
name: deploy

on:
  workflow_run:
    workflows: [ci]
    types: [completed]
    branches: [main]
  workflow_dispatch:

permissions:
  id-token: write
  contents: read

jobs:
  deploy:
    if: >
      github.event_name == 'workflow_dispatch' ||
      github.event.workflow_run.conclusion == 'success'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_DEPLOY_ROLE_ARN }}
          aws-region: eu-central-1
      # build and push images, then call /opt/taskapp/deploy.sh through SSM
```

For learning, run Terraform locally. Running Terraform apply from CI requires state access, locking and broader permissions; add that only after the manual flow is comfortable.

---

## 10. Security checklist

> Items marked `[x]` are implemented in the repository or Terraform configuration. Items left `[ ]` are account-level actions or live-verification steps that require an AWS account and a deployed stack.

### Identity and access

- [ ] Root account has MFA and is not used for daily work.
- [ ] Humans use IAM Identity Center or federated access.
- [x] No long-lived AWS access keys in `.env`, GitHub secrets or Docker images.
- [x] EC2 uses an instance profile.
- [x] GitHub Actions uses OIDC.
- [x] IAM policies are scoped to specific buckets, parameters and log groups.
- [x] `ssm:SendCommand` is restricted to the app instance and the shell document.

### Network

- [x] No inbound SSH from `0.0.0.0/0`.
- [x] App ports `3100` and `4200` accept traffic only from the ALB security group.
- [x] RDS accepts `5432` only from the app security group.
- [x] RDS is not publicly accessible.
- [x] ALB allows only `80` and `443` from the internet.
- [x] Egress is limited to what is needed: `443`, `5432`, DNS.

### Data

- [x] S3 Block Public Access is enabled.
- [x] S3 encryption is enabled.
- [x] S3 versioning and lifecycle rules are configured.
- [x] RDS storage encryption is enabled.
- [x] RDS automated backups are enabled.
- [x] Secrets are in SSM Parameter Store or Secrets Manager.
- [x] Presigned URLs are short-lived and never logged.
- [x] File type and size are validated.
- [x] Attachment objects are deleted when their rows are deleted.
- [ ] Database snapshots are tested.

### Application

- [x] HTTPS only; HTTP redirects to HTTPS.
- [x] Refresh cookie is `httpOnly`, `Secure`, `SameSite=Lax`.
- [x] Access token stays in memory.
- [x] CORS origins are explicit.
- [x] Rate limiting is enabled on auth endpoints.
- [x] Zod validation covers all request bodies and query parameters.
- [x] Errors do not leak stack traces or secrets.
- [x] Helmet/security headers are enabled.
- [ ] Dependencies are scanned and updated.

### Containers and host

- [x] Images are tagged with Git SHAs, not `latest`.
- [x] Images run as a non-root user.
- [x] Images are scanned on push.
- [x] No secrets are baked into images.
- [x] EC2 root volume is encrypted.
- [x] IMDSv2 is required and the hop limit is correct.
- [ ] OS security updates are applied.
- [ ] Docker daemon access is limited to trusted users.

### Observability and cost

- [x] CloudWatch log retention is set.
- [x] Alarms exist for 5xx, CPU, RDS storage and status checks.
- [ ] SNS email subscription is confirmed.
- [x] AWS Budgets alarm is configured.
- [ ] The demo stack is destroyed when not in use.

### Never do these

- Never commit `.env`, `.tfstate`, `.tfvars` with secrets, or private keys.
- Never open port `22` to the world.
- Never make RDS public for convenience.
- Never make the S3 bucket public.
- Never use `s3:*` or `Resource: "*"` for application permissions.
- Never run `prisma migrate dev` in production.
- Never store pre-signed URLs in the database or logs.
- Never deploy `latest` and assume you know what is running.

## 11. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| ALB returns `502 Bad Gateway` | Target is not listening, wrong port, or security group blocks ALB | Check `docker compose ps`, the container port, the target group port, and the app SG rule from the ALB SG |
| ALB returns `503 Service Unavailable` | No healthy targets | Check target group health in the console; fix the health check path and container health |
| ALB returns `504 Gateway Timeout` | API is slow or blocked on the database | Check API logs, RDS CPU/connections, and the ALB idle timeout |
| Health check fails but container is running | Wrong path or app bound to `127.0.0.1` | Bind to `0.0.0.0`; verify `curl` from the instance to `localhost:4200/api/v1/health` |
| `docker compose` says permission denied | User not in `docker` group | `sudo usermod -aG docker ec2-user`, then log out and back in |
| SSM instance not listed | Missing instance profile, agent stopped, or no outbound `443` | Attach `AmazonSSMManagedInstanceCore`; check `/var/log/amazon/ssm/amazon-ssm-agent.log` |
| SSM `TargetNotConnected` | Agent cannot reach SSM endpoints | Check IGW/NAT/VPC endpoints and DNS; restart the agent |
| Prisma `P1001` | Cannot reach the database | Check RDS endpoint, DB SG, app SG egress, subnet routing, and `sslmode=require` |
| Prisma `P1017` | Server closed the connection | Check connection limits, idle timeouts, and RDS logs; reduce `connection_limit` |
| Prisma migration fails with SSL | RDS requires SSL but URL lacks it | Add `sslmode=require` to `DATABASE_URL` |
| S3 `403 SignatureDoesNotMatch` on upload | `Content-Type` differs from the signed value | Send the same `Content-Type` used when creating the pre-signed URL |
| S3 `403 AccessDenied` | IAM policy, bucket policy, or expired URL | Check the role policy, object prefix, URL expiry, and clock skew |
| Browser CORS error on S3 upload | Bucket CORS missing or wrong origin | Add the exact web origin, `PUT`/`GET`/`HEAD`, and `content-type` |
| Pre-signed URL works in curl but not browser | CORS preflight blocked | Fix bucket CORS; check the browser network tab for `OPTIONS` |
| Login works, session disappears | Cookie not stored | Verify HTTPS, `Secure`, `SameSite`, domain/path, and that ALB forwards `Set-Cookie` |
| API works via ALB but Next rewrite points to localhost | `API_ORIGIN` wrong | In Compose, use `http://api:4200`; in AWS path routing, the rewrite is bypassed |
| `NEXT_PUBLIC_API_BASE_URL` change has no effect | Public env is baked at build time | Rebuild the web image with the new build arg |
| Container cannot find AWS credentials | IMDS hop limit too low | Set `http_put_response_hop_limit = 2` and restart the container |
| ECR `no basic auth credentials` | Not logged in or wrong registry | Run `aws ecr get-login-password ... | docker login ...` |
| Terraform state lock stuck | Previous apply crashed | Check the lock ID; use `terraform force-unlock <lock-id>` only after confirming no apply is running |
| Terraform wants to replace EC2 after a small change | User data or AMI changed | This is expected with `user_data_replace_on_change`; plan for downtime or use an ASG |
| CloudWatch has no container logs | `awslogs` driver cannot authenticate or wrong region/group | Check the instance role, log group name, region, and `docker inspect` logging config |
| EC2 disk full | Old images and logs | `docker system prune -af`, increase EBS, set log rotation |
| Build runs out of memory on EC2 | Next.js build on a small instance | Build in GitHub Actions or locally, push to ECR, and pull on EC2 |
| RDS storage alarm | Data growth or logs | Increase storage, enable autoscaling, clean up old data |
| ALB 5xx after deploy | New image unhealthy or migration failed | Check `docker compose logs`, target health, and the deploy script output |

### Debugging order

1. Is the target healthy in the ALB target group?
2. Is the container running and listening on the expected port?
3. Does `curl` from the instance work?
4. Do the security groups allow the path?
5. Is the database reachable and migrated?
6. Are the logs showing an application error?
7. Is the issue only in the browser (CORS, cookies, mixed content)?

Work from the outside in, but verify each layer independently.

---

## 12. Cost awareness

Approximate order of magnitude for a small demo in `eu-central-1`. Always confirm with the AWS Pricing Calculator; prices change.

| Resource | Approximate monthly cost |
|---|---|
| EC2 `t3.small` on-demand | ~$15 |
| 30 GB gp3 EBS | ~$2.40 |
| Public IPv4 / Elastic IP | ~$3.60 |
| ALB | ~$16 + LCU charges |
| RDS `db.t4g.micro` | ~$12–15 |
| RDS 20 GB gp3 + backups | ~$3–5 |
| S3 (a few GB) | < $1 |
| CloudWatch Logs (a few GB) | ~$1–5 |
| ECR (a few GB) | < $1 |
| Route 53 hosted zone | ~$0.50 |
| ACM certificate | Free |
| NAT Gateway (if used) | ~$32 + data; avoid for the demo |
| Data transfer out | ~$0.09/GB after the free allowance |

A realistic demo budget is roughly **$50–75/month** if left running. Destroy the stack when you are not using it.

Cost controls:

- Set an AWS Budgets alarm at a low threshold, e.g. $50.
- Use `t3.small`, `db.t4g.micro`, and single-AZ RDS.
- Avoid a NAT Gateway; keep EC2 in a public subnet and RDS private.
- Set CloudWatch log retention to 14 days.
- Use ECR lifecycle policies.
- Stop or terminate EC2 and RDS when idle; `terraform destroy` is cleanest.
- Remember that stopped RDS still incurs storage costs.
- Check for unattached EIPs and idle ALBs, which still cost money.

---

## 13. Learning exercises

Do these in order. Each one teaches a concept you will use in the real deployment.

1. **Manual S3 pre-signed URL**
   - Create a private bucket.
   - Upload a file with `aws s3 cp`.
   - Generate a URL with `aws s3 presign s3://bucket/file --expires-in 120`.
   - Open it, wait two minutes, and confirm it expires.

2. **Terraform only the bucket**
   - Write a 30-line Terraform config for one S3 bucket.
   - Run `init`, `plan`, `apply`, `destroy`.
   - Read the plan carefully and explain every line.

3. **Read a replacement plan**
   - Change an attribute that forces replacement, e.g. the bucket name.
   - Observe `-/+` in the plan.
   - Explain why Terraform cannot update it in place.

4. **IAM Policy Simulator**
   - Simulate `s3:PutObject` with and without the attachment prefix.
   - Explain why the resource ARN matters.

5. **Break the S3 policy**
   - Remove `s3:PutObject` from the role.
   - Try an upload and read the 403.
   - Restore the permission.

6. **CORS failure**
   - Remove the bucket CORS rule.
   - Try a browser upload and inspect the `OPTIONS` preflight.
   - Add the rule back and compare.

7. **SSM port forwarding**
   - Forward local `5433` to RDS through EC2.
   - Connect with `psql` or Prisma Studio.
   - Confirm no port `22` is open.

8. **CloudWatch Logs Insights**
   - Query for `level = "error"` in the last hour.
   - Query request counts in 5-minute bins.

9. **Add an alarm**
   - Add an RDS free-storage alarm and an SNS email subscription.
   - Confirm the subscription email.
   - Lower the threshold temporarily to trigger it.

10. **Terraform drift**
    - Change a tag in the console.
    - Run `terraform plan` and observe the drift.
    - Apply to reconcile it.

11. **Terraform import**
    - Create a bucket manually.
    - Write a matching resource block.
    - Run `terraform import` and then `terraform plan`.
    - Fix the configuration until the plan is clean.

12. **Second environment**
    - Add a `staging` workspace or a separate `environment` value.
    - Use different bucket, RDS and log names.
    - Explain how state separation prevents accidental cross-environment changes.

13. **GitHub OIDC**
    - Create the OIDC provider and deploy role.
    - Push an image from GitHub Actions without storing AWS keys.
    - Tighten the trust policy to `main` only.

14. **RDS restore**
    - Take a snapshot.
    - Restore it to a new instance.
    - Point a local Prisma Studio session at it through SSM port forwarding.

15. **S3 lifecycle**
    - Add a rule that expires old object versions.
    - Upload, overwrite and delete objects.
    - Observe versioning and lifecycle behavior.

16. **Virus scanning (advanced)**
    - Add GuardDuty Malware Protection for S3 or a Lambda/ClamAV scan.
    - Quarantine infected objects and mark the attachment `FAILED`.

17. **WAF (advanced)**
    - Put AWS WAF in front of the ALB.
    - Add a managed rule set and a rate-based rule.
    - Test a blocked request.

18. **Autoscaling (advanced)**
    - Replace the single instance with an Auto Scaling group.
    - Register instances in the target groups.
    - Add a rolling deploy and health-check grace period.

---

## 14. Glossary

| Term | Meaning |
|---|---|
| ACM | AWS Certificate Manager; issues and renews TLS certificates |
| ALB | Application Load Balancer; HTTP-aware reverse proxy |
| ARN | Amazon Resource Name; unique resource identifier |
| AZ | Availability Zone; isolated data center group in a region |
| CORS | Browser rule that allows a web origin to call another origin |
| EBS | Elastic Block Store; network disk for EC2 |
| ECR | Elastic Container Registry; private Docker registry |
| EIP | Elastic IP; static public IPv4 address |
| IAM | Identity and Access Management |
| IMDS | Instance Metadata Service; provides temporary credentials |
| IaC | Infrastructure as Code |
| NAT Gateway | Managed outbound internet gateway for private subnets |
| Pre-signed URL | Time-limited signed S3 URL for one action |
| RDS | Relational Database Service |
| Route 53 | AWS DNS service |
| S3 | Simple Storage Service; object storage |
| SG | Security group; stateful virtual firewall |
| SNS | Simple Notification Service; pub/sub notifications |
| SSM | Systems Manager; includes Session Manager, Parameter Store and Run Command |
| Target group | Set of targets behind an ALB with health checks |
| Terraform state | Mapping between configuration and real resources |
| VPC | Virtual Private Cloud; isolated network |
| WAF | Web Application Firewall |

---

## 15. Implementation roadmap

### Current status

| Area | Status |
|---|---|
| Local TaskApp (API, web, PostgreSQL, tests) | Complete |
| S3 attachment model, API and UI | Complete; verified against LocalStack |
| API and web Dockerfiles | Complete; images built and smoke-tested |
| Production Compose file | Complete |
| Terraform network, security, S3, IAM, ECR | Complete; `fmt` and `validate` pass |
| Terraform EC2, ALB, RDS, SSM, CloudWatch | Complete; `fmt` and `validate` pass |
| First AWS deployment | Pending AWS credentials and a Route 53 zone |
| GitHub Actions CI/CD | Complete; first live OIDC deploy pending |
| Hardening, WAF, autoscaling | Optional / advanced |

### Phase 1 ? Attachments without AWS

- [x] Add `Attachment` model and migration.
- [x] Add `FileStorage` interface and an in-memory fake.
- [x] Implement `AttachmentService` and repository.
- [x] Add upload, complete, list, download and delete endpoints.
- [x] Add shared DTOs and Zod schemas.
- [x] Add frontend API client, hook and UI.
- [x] Test with LocalStack.
- [x] Add API and web tests.

### Phase 2 ? Containers

- [x] Add `Dockerfile.api` with `migrator` target.
- [x] Add `Dockerfile.web` with Next standalone output.
- [x] Add `docker-compose.prod.yml`.
- [x] Add `.dockerignore`.
- [x] Run both containers locally against PostgreSQL and LocalStack.
- [x] Verify health checks and logs.
- [x] Rebuild and re-verify the full stack on 2026-11-28: migrations, seed, login, task CRUD, direct-to-S3 upload, completion, listing, pre-signed download and deletion all passed.

### Phase 3 ? Terraform foundation

- [x] Add the bootstrap module for the S3 state bucket.
- [x] Add provider, variables and backend.
- [x] Add VPC, public/private subnets and IGW.
- [x] Add security groups with no public SSH.
- [x] Add S3 bucket, public access block, encryption, versioning and CORS.
- [x] Add IAM role, instance profile and least-privilege policy.
- [x] Add ECR repositories and lifecycle policies.
- [x] Run `terraform fmt` and `terraform validate`.
- [ ] Run `terraform plan` against AWS and review every resource.

### Phase 4 ? Compute and data

- [x] Add EC2 instance, EIP and user data.
- [x] Add SSM parameters and KMS key.
- [x] Add RDS instance, subnet group and parameter group.
- [x] Add ALB, target groups, ACM and Route 53.
- [x] Add CloudWatch log groups and alarms.
- [ ] Apply the stack and deploy the first image.
- [ ] Run migrations and seed data on AWS.
- [ ] Verify login, tasks and attachments through HTTPS.

### Phase 5 ? Operations

- [ ] Confirm CloudWatch logs for API and web on AWS.
- [ ] Confirm alarms and SNS email.
- [ ] Confirm SSM shell access and RDS port forwarding.
- [ ] Confirm `terraform destroy` cleans up.
- [x] Add GitHub Actions CI.
- [x] Add GitHub Actions deploy with OIDC.
- [x] Add AWS Budgets alarm.

### Definition of done

- [ ] The app is reachable only through HTTPS on the ALB.
- [ ] The API and web containers are healthy on AWS.
- [ ] RDS is private and reachable only from the app security group.
- [ ] S3 is private and attachments use short-lived pre-signed URLs in AWS.
- [ ] No inbound SSH is open.
- [x] No AWS access keys exist in the repo, images or GitHub.
- [ ] Logs and alarms are visible in CloudWatch.
- [ ] A fresh `terraform apply` and `terraform destroy` both succeed.
- [x] The README and this guide explain how to deploy and tear down.
- [ ] The demo can be shown end-to-end in under five minutes.

### Suggested next step

Run `terraform plan` with an authenticated AWS identity, review every resource, then apply the stack and push the first SHA-tagged images. Use `infra/README.md` and Section 8 above. After the live smoke test, mark the remaining Phase 4/5 items complete and record the real URL in this guide.

---

## Where to read more

- Terraform language and AWS provider: <https://developer.hashicorp.com/terraform>
- AWS S3 pre-signed URLs: <https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html>
- AWS IAM best practices: <https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html>
- SSM Session Manager: <https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager.html>
- RDS for PostgreSQL: <https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_PostgreSQL.html>
- CloudWatch Logs: <https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/WhatIsCloudWatchLogs.html>
- Next.js standalone output: <https://nextjs.org/docs/app/api-reference/config/next-config-js/output>
- Prisma migrations: <https://www.prisma.io/docs/orm/prisma-migrate>

---

*This guide is intentionally detailed because it is both a learning resource and the implementation blueprint for this repository. Update the checklists as each phase is completed.*







