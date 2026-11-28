# The bucket is supplied by backend.hcl so this file never contains an
# account-specific value. Create the bucket once with infra/bootstrap.
#
#   cd infra
#   terraform init -backend-config=backend.hcl
#
# use_lockfile gives S3-native state locking and requires Terraform >= 1.10.
terraform {
  backend "s3" {
    key          = "taskapp/demo/terraform.tfstate"
    region       = "eu-central-1"
    encrypt      = true
    use_lockfile = true
  }
}
