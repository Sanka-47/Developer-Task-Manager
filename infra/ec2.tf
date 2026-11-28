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

  associate_public_ip_address = false

  user_data = templatefile("${path.module}/user-data.sh.tftpl", {
    aws_region     = var.aws_region
    project        = var.project
    environment    = var.environment
    ecr_registry   = local.ecr_registry
    image_tag      = var.image_tag
    api_repo       = local.ecr_repositories["api"]
    web_repo       = local.ecr_repositories["web"]
    migrator_repo  = local.ecr_repositories["migrator"]
    log_group_api  = local.log_group_api
    log_group_web  = local.log_group_web
    seed_demo_data = var.seed_demo_data
    compose_file   = file("${path.module}/../deploy/docker-compose.aws.yml")
  })

  user_data_replace_on_change = true

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 2
  }

  root_block_device {
    volume_size = 30
    volume_type = "gp3"
    encrypted   = true
  }

  tags = {
    Name = "${local.name_prefix}-app"
    Role = "web-and-api"
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
    aws_ecr_repository.this,
    aws_db_instance.main,
  ]
}

resource "aws_eip" "app" {
  domain   = "vpc"
  instance = aws_instance.app.id

  tags = {
    Name = "${local.name_prefix}-app"
  }

  depends_on = [aws_internet_gateway.main]
}
