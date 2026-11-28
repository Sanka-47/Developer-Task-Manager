resource "aws_security_group" "alb" {
  name        = "${local.name_prefix}-alb"
  description = "Public HTTP/HTTPS to the ALB"
  vpc_id      = aws_vpc.main.id

  ingress = []
  egress  = []

  tags = {
    Name = "${local.name_prefix}-alb"
  }
}

resource "aws_security_group" "app" {
  name        = "${local.name_prefix}-app"
  description = "EC2 application instance; no inbound SSH"
  vpc_id      = aws_vpc.main.id

  ingress = []
  egress  = []

  tags = {
    Name = "${local.name_prefix}-app"
  }
}

resource "aws_security_group" "db" {
  name        = "${local.name_prefix}-db"
  description = "PostgreSQL from the app security group only"
  vpc_id      = aws_vpc.main.id

  ingress = []
  egress  = []

  tags = {
    Name = "${local.name_prefix}-db"
  }
}

resource "aws_security_group_rule" "alb_https" {
  type              = "ingress"
  description       = "HTTPS from the internet"
  security_group_id = aws_security_group.alb.id
  from_port         = 443
  to_port           = 443
  protocol          = "tcp"
  cidr_blocks       = var.allowed_http_cidrs
}

resource "aws_security_group_rule" "alb_http" {
  type              = "ingress"
  description       = "HTTP redirect from the internet"
  security_group_id = aws_security_group.alb.id
  from_port         = 80
  to_port           = 80
  protocol          = "tcp"
  cidr_blocks       = var.allowed_http_cidrs
}

resource "aws_security_group_rule" "alb_to_web" {
  type                     = "egress"
  description              = "Next.js target"
  security_group_id        = aws_security_group.alb.id
  from_port                = local.web_port
  to_port                  = local.web_port
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.app.id
}

resource "aws_security_group_rule" "alb_to_api" {
  type                     = "egress"
  description              = "API target"
  security_group_id        = aws_security_group.alb.id
  from_port                = local.api_port
  to_port                  = local.api_port
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.app.id
}

resource "aws_security_group_rule" "app_web_from_alb" {
  type                     = "ingress"
  description              = "Next.js from ALB only"
  security_group_id        = aws_security_group.app.id
  from_port                = local.web_port
  to_port                  = local.web_port
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.alb.id
}

resource "aws_security_group_rule" "app_api_from_alb" {
  type                     = "ingress"
  description              = "API from ALB only"
  security_group_id        = aws_security_group.app.id
  from_port                = local.api_port
  to_port                  = local.api_port
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.alb.id
}

resource "aws_security_group_rule" "app_https_egress" {
  type              = "egress"
  description       = "HTTPS to S3, ECR, CloudWatch and SSM"
  security_group_id = aws_security_group.app.id
  from_port         = 443
  to_port           = 443
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
}

resource "aws_security_group_rule" "app_to_db" {
  type                     = "egress"
  description              = "PostgreSQL to RDS"
  security_group_id        = aws_security_group.app.id
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.db.id
}

resource "aws_security_group_rule" "app_dns_udp" {
  type              = "egress"
  description       = "DNS over UDP"
  security_group_id = aws_security_group.app.id
  from_port         = 53
  to_port           = 53
  protocol          = "udp"
  cidr_blocks       = [var.vpc_cidr]
}

resource "aws_security_group_rule" "app_dns_tcp" {
  type              = "egress"
  description       = "DNS over TCP"
  security_group_id = aws_security_group.app.id
  from_port         = 53
  to_port           = 53
  protocol          = "tcp"
  cidr_blocks       = [var.vpc_cidr]
}

resource "aws_security_group_rule" "db_from_app" {
  type                     = "ingress"
  description              = "PostgreSQL from app"
  security_group_id        = aws_security_group.db.id
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.app.id
}
