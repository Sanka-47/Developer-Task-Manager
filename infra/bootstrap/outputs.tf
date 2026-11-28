output "state_bucket" {
  description = "S3 bucket that stores the Terraform state."
  value       = aws_s3_bucket.state.bucket
}

output "state_bucket_region" {
  description = "Region of the Terraform state bucket."
  value       = var.aws_region
}

output "backend_config" {
  description = "Values to pass to terraform init -backend-config."
  value = {
    bucket       = aws_s3_bucket.state.bucket
    key          = "taskapp/demo/terraform.tfstate"
    region       = var.aws_region
    encrypt      = true
    use_lockfile = true
  }
}
