locals {
  name_prefix = "${var.project}-${var.environment}"

  common_tags = merge(
    {
      Project     = var.project
      Environment = var.environment
      ManagedBy   = "terraform"
    },
    var.extra_tags,
  )

  # ALB and RDS both require at least two AZs.
  availability_zones = slice(data.aws_availability_zones.available.names, 0, 2)

  ecr_registry = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.aws_region}.amazonaws.com"

  ecr_repositories = {
    api      = "${local.name_prefix}-api"
    web      = "${local.name_prefix}-web"
    migrator = "${local.name_prefix}-migrator"
  }

  app_url       = "https://${var.domain_name}"
  log_group_api = "/${var.project}/${var.environment}/api"
  log_group_web = "/${var.project}/${var.environment}/web"

  web_port = 3100
  api_port = 4200
}
