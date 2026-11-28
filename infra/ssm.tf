resource "random_password" "db" {
  length  = 32
  special = false
}

resource "random_password" "jwt" {
  length  = 64
  special = false
}

resource "aws_ssm_parameter" "database_url" {
  name   = "/${var.project}/${var.environment}/DATABASE_URL"
  type   = "SecureString"
  key_id = aws_kms_key.secrets.key_id
  value  = "postgresql://${var.db_username}:${urlencode(random_password.db.result)}@${aws_db_instance.main.address}:5432/${var.db_name}?schema=public&sslmode=require&connection_limit=10"

  tags = {
    Name = "${local.name_prefix}-database-url"
  }
}

resource "aws_ssm_parameter" "jwt_access_secret" {
  name   = "/${var.project}/${var.environment}/JWT_ACCESS_SECRET"
  type   = "SecureString"
  key_id = aws_kms_key.secrets.key_id
  value  = random_password.jwt.result

  tags = {
    Name = "${local.name_prefix}-jwt-secret"
  }
}

resource "aws_ssm_parameter" "s3_bucket" {
  name  = "/${var.project}/${var.environment}/S3_BUCKET"
  type  = "String"
  value = aws_s3_bucket.attachments.bucket

  tags = {
    Name = "${local.name_prefix}-s3-bucket"
  }
}

resource "aws_ssm_parameter" "cors_origins" {
  name  = "/${var.project}/${var.environment}/CORS_ORIGINS"
  type  = "String"
  value = local.app_url

  tags = {
    Name = "${local.name_prefix}-cors-origins"
  }
}
