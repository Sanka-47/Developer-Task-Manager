# TaskApp AWS infrastructure

Terraform for the demo stack:

```text
Route 53 -> ALB (HTTPS) -> EC2
                           |-- Next.js container :3100
                           |-- Express API container :4200 -> RDS PostgreSQL
                           |                                -> private S3 bucket
                           `-> CloudWatch Logs / alarms / SSM
```

## 1. Bootstrap remote state

The state bucket must exist before the main configuration can use the S3
backend. Run this once per account/region:

```bash
cd infra/bootstrap
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform fmt
terraform validate
terraform plan -out=bootstrap.tfplan
terraform apply bootstrap.tfplan
terraform output
```

Copy `../backend.hcl.example` to `../backend.hcl` and set the bucket name from
the bootstrap output. `backend.hcl` is ignored by Git.

## 2. Configure the main stack

```bash
cd ..   # from infra/bootstrap to infra
cp terraform.tfvars.example terraform.tfvars
# edit domain_name, hosted_zone_name, alert_email, github_repository
terraform init -backend-config=backend.hcl
terraform fmt -recursive
terraform validate
terraform plan -out=tfplan
terraform apply tfplan
```

The first apply creates ECR repositories but cannot start the application until
images are pushed. The EC2 user data installs Docker, the Compose plugin, the
AWS CLI, the SSM agent and writes `/opt/taskapp/api.env` from SSM SecureString
parameters. It skips the pull when the images do not exist yet.

## 3. Push the first images

Use the Git SHA as the image tag. The root `docker:build` command also uses the
short Git SHA for the local production-shaped stack.

Run these from the repository root:

```bash
cd ..   # from infra to the repository root
AWS_REGION=eu-central-1
TAG=$(git rev-parse --short HEAD)
REGISTRY=$(terraform -chdir=infra output -raw ecr_registry)
API_REPO=$(terraform -chdir=infra output -json ecr_repository_urls | jq -r .api)
WEB_REPO=$(terraform -chdir=infra output -json ecr_repository_urls | jq -r .web)
MIGRATOR_REPO=$(terraform -chdir=infra output -json ecr_repository_urls | jq -r .migrator)

aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "$REGISTRY"

docker build -f Dockerfile.api --target runner -t "$API_REPO:$TAG" .
docker push "$API_REPO:$TAG"

docker build -f Dockerfile.api --target migrator -t "$MIGRATOR_REPO:$TAG" .
docker push "$MIGRATOR_REPO:$TAG"

docker build -f Dockerfile.web --target runner \
  --build-arg API_ORIGIN=http://api:4200 \
  -t "$WEB_REPO:$TAG" .
docker push "$WEB_REPO:$TAG"
```

The `jq` command is used only to read the repository URL map. If you do not have
`jq`, read the values from `terraform -chdir=infra output` and set `API_REPO`,
`WEB_REPO` and `MIGRATOR_REPO` manually.

## 4. Deploy and seed

The first-boot script writes `/opt/taskapp/deploy.sh`. Run it through SSM:

```bash
INSTANCE_ID=$(terraform -chdir=infra output -raw instance_id)
TAG=$(git rev-parse --short HEAD)

aws ssm send-command \
  --instance-ids "$INSTANCE_ID" \
  --document-name AWS-RunShellScript \
  --comment "Deploy TaskApp $TAG" \
  --parameters "commands=[\"/opt/taskapp/deploy.sh $TAG\"]"
```

`deploy.sh` logs in to ECR, pulls the SHA-tagged images, runs the migrator, seeds
the idempotent demo data and starts the containers with CloudWatch `awslogs`
logging.

## 5. Verify

```bash
curl -I "https://app.example.com/login"
curl -s "https://app.example.com/api/v1/health"
aws logs tail /taskapp/demo/api --follow
aws logs tail /taskapp/demo/web --follow
```

Log in with `demo@taskapp.dev` / `Demo1234!`, then verify task CRUD, the
dashboard and attachment upload/download.

## 6. Destroy

```bash
cd infra
terraform destroy
```

Demo settings allow a clean destroy: RDS has no deletion protection and no
final snapshot, the S3 bucket uses `force_destroy` outside production, and ECR
repositories use `force_delete` outside production. The bootstrap state bucket
is intentionally retained; empty it manually if you also want to remove state
history.
