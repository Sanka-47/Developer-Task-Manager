variable "aws_region" {
  description = "AWS region for the demo stack."
  type        = string
  default     = "eu-central-1"
}

variable "project" {
  description = "Short project name used in resource names."
  type        = string
  default     = "taskapp"

  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.project))
    error_message = "project must contain only lowercase letters, numbers and hyphens."
  }
}

variable "environment" {
  description = "Environment name, for example demo."
  type        = string
  default     = "demo"

  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.environment))
    error_message = "environment must contain only lowercase letters, numbers and hyphens."
  }
}

variable "domain_name" {
  description = "Application hostname, for example app.example.com. The Route 53 zone must exist."
  type        = string
}

variable "hosted_zone_name" {
  description = "Route 53 public hosted zone, for example example.com."
  type        = string
}

variable "alert_email" {
  description = "Email address subscribed to CloudWatch and budget alarms. Empty disables the subscription."
  type        = string
  default     = ""
}

variable "monthly_budget_usd" {
  description = "Monthly AWS budget used for the demo cost alarm."
  type        = number
  default     = 50
}

variable "github_repository" {
  description = "GitHub repository in owner/name form for OIDC deploys. Empty skips the deploy role."
  type        = string
  default     = ""
}

variable "github_branch" {
  description = "Branch allowed to assume the GitHub Actions deploy role."
  type        = string
  default     = "main"
}

variable "image_tag" {
  description = "Container image tag used by the first-boot script. Use a Git SHA for real deployments."
  type        = string
  default     = "initial"
}

variable "seed_demo_data" {
  description = "Run the idempotent demo seed after migrations when images are available."
  type        = bool
  default     = true
}

variable "instance_type" {
  description = "EC2 instance type for the combined web/API host."
  type        = string
  default     = "t3.small"
}

variable "db_instance_class" {
  description = "RDS instance class."
  type        = string
  default     = "db.t4g.micro"
}

variable "db_name" {
  description = "PostgreSQL database name."
  type        = string
  default     = "taskapp"
}

variable "db_username" {
  description = "PostgreSQL master username."
  type        = string
  default     = "taskapp"
}

variable "db_backup_retention_days" {
  description = "RDS automated backup retention in days."
  type        = number
  default     = 7
}

variable "vpc_cidr" {
  description = "CIDR block for the demo VPC."
  type        = string
  default     = "10.20.0.0/16"
}

variable "s3_key_prefix" {
  description = "S3 prefix used by the API for attachment objects."
  type        = string
  default     = "attachments"
}

variable "log_retention_days" {
  description = "CloudWatch Logs retention."
  type        = number
  default     = 14
}

variable "allowed_http_cidrs" {
  description = "CIDRs allowed to reach ALB ports 80 and 443."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "extra_tags" {
  description = "Additional tags applied through the provider default_tags."
  type        = map(string)
  default     = {}
}
