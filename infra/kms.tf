resource "aws_kms_key" "secrets" {
  description             = "${local.name_prefix} SSM SecureString parameters"
  enable_key_rotation     = true
  deletion_window_in_days = 7

  tags = {
    Name    = "${local.name_prefix}-secrets"
    Purpose = "ssm-secure-strings"
  }
}

resource "aws_kms_alias" "secrets" {
  name          = "alias/${local.name_prefix}-secrets"
  target_key_id = aws_kms_key.secrets.key_id
}
