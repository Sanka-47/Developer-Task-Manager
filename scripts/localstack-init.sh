#!/bin/sh
set -eu

# Runs inside the LocalStack container when it becomes ready. Keeping the
# bucket creation here means `docker compose up -d` gives developers a working
# attachment backend without extra manual steps.
awslocal s3 mb s3://taskapp-attachments 2>/dev/null || true
awslocal s3api put-bucket-acl --bucket taskapp-attachments --acl private
awslocal s3api put-bucket-cors --bucket taskapp-attachments --cors-configuration '{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "PUT", "HEAD"],
      "AllowedOrigins": ["http://localhost:3100", "http://localhost:3101"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3000
    }
  ]
}'
echo "LocalStack S3 bucket taskapp-attachments is ready"
