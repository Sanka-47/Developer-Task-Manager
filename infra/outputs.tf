output "app_url" {
  description = "Public HTTPS URL for the application."
  value       = local.app_url
}

output "alb_dns_name" {
  description = "ALB DNS name, useful before DNS has propagated."
  value       = aws_lb.main.dns_name
}

output "instance_id" {
  description = "EC2 instance ID for SSM commands."
  value       = aws_instance.app.id
}

output "elastic_ip" {
  description = "Elastic IP associated with the application instance."
  value       = aws_eip.app.public_ip
}

output "attachment_bucket" {
  description = "Private S3 bucket for task attachments."
  value       = aws_s3_bucket.attachments.bucket
}

output "rds_endpoint" {
  description = "Private RDS endpoint."
  value       = aws_db_instance.main.endpoint
  sensitive   = true
}

output "ecr_registry" {
  description = "ECR registry host."
  value       = local.ecr_registry
}

output "ecr_repository_urls" {
  description = "ECR repository URLs for the API, web and migration images."
  value = {
    api      = aws_ecr_repository.this["api"].repository_url
    web      = aws_ecr_repository.this["web"].repository_url
    migrator = aws_ecr_repository.this["migrator"].repository_url
  }
}

output "cloudwatch_log_groups" {
  description = "CloudWatch log group names used by the containers."
  value = {
    api = aws_cloudwatch_log_group.api.name
    web = aws_cloudwatch_log_group.web.name
  }
}

output "github_deploy_role_arn" {
  description = "Role ARN for GitHub Actions OIDC deployments."
  value       = try(aws_iam_role.github_deploy[0].arn, "")
}
