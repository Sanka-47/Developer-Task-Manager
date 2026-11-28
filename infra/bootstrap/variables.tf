variable "aws_region" {
  description = "AWS region for the Terraform state bucket."
  type        = string
  default     = "eu-central-1"
}

variable "project" {
  description = "Project name used in the state bucket name."
  type        = string
  default     = "taskapp"
}

variable "environment" {
  description = "Environment name used in the state bucket name."
  type        = string
  default     = "demo"
}
