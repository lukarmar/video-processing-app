#!/bin/bash

# Wait for LocalStack to be ready
echo "Waiting for LocalStack to be ready..."
until curl -s http://localhost:4566/_localstack/health | grep -q '"s3": "available"'; do
  echo "Waiting for S3 service..."
  sleep 2
done

echo "LocalStack is ready. Creating AWS resources..."

# Set AWS CLI configuration for LocalStack
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=us-east-1
export AWS_ENDPOINT_URL=http://localhost:4566

# Create S3 bucket for video processing
echo "Creating S3 bucket: video-processing-bucket"
aws --endpoint-url=http://localhost:4566 s3 mb s3://video-processing-bucket

# Verify bucket creation
echo "Listing S3 buckets:"
aws --endpoint-url=http://localhost:4566 s3 ls

# Create SQS queue for video processing
echo "Creating SQS queue: video-processing-queue"
aws --endpoint-url=http://localhost:4566 sqs create-queue \
  --queue-name video-processing-queue \
  --attributes '{"VisibilityTimeoutSeconds":"300","MessageRetentionPeriod":"1209600"}'

# List SQS queues
echo "Listing SQS queues:"
aws --endpoint-url=http://localhost:4566 sqs list-queues

echo "AWS resources created successfully!"
