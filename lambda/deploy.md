# Deployment — code-lambda

Containerised Python Lambda exposed via a public Function URL.

```bash
cd lambda
export AWS_REGION=ap-south-1
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export ECR=$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/code-lambda
```

## 1. One-time setup

```bash
# ECR repository
aws ecr create-repository --region $AWS_REGION --repository-name code-lambda \
  --image-scanning-configuration scanOnPush=true

# Execution role
aws iam create-role --role-name code-lambda-exec-role \
  --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
aws iam attach-role-policy --role-name code-lambda-exec-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
sleep 10   # IAM propagation
```

## 2. Deploy

```bash
# Build (Lambda rejects OCI manifest indexes; both flags needed)
docker buildx build --platform linux/arm64 --provenance=false --output=type=docker \
  -t code-lambda .

# Test locally — abort if any fail
docker run --rm -d -p 9000:8080 --memory=1024m --name code-lambda-test code-lambda
./test_suite.sh && ./test_stdin.sh && ./test_stress.sh
docker stop code-lambda-test

# Push to ECR
aws ecr get-login-password --region $AWS_REGION \
  | docker login --username AWS --password-stdin $ECR
docker tag code-lambda:latest ${ECR}:latest
docker push ${ECR}:latest

# Create function
aws lambda create-function --region $AWS_REGION --function-name code-lambda \
  --package-type Image --code ImageUri=${ECR}:latest \
  --role arn:aws:iam::$AWS_ACCOUNT_ID:role/code-lambda-exec-role \
  --architectures arm64 --memory-size 1024 --timeout 20

# Function URL + public invoke (both permissions required since Oct 2025)
aws lambda create-function-url-config --region $AWS_REGION --function-name code-lambda \
  --auth-type NONE \
  --cors '{"AllowOrigins":["*"],"AllowMethods":["POST"],"AllowHeaders":["content-type"],"MaxAge":86400}'
aws lambda add-permission --region $AWS_REGION --function-name code-lambda \
  --statement-id FunctionUrlAllowPublicAccess \
  --action lambda:InvokeFunctionUrl --principal '*' --function-url-auth-type NONE
aws lambda add-permission --region $AWS_REGION --function-name code-lambda \
  --statement-id FunctionUrlAllowPublicInvoke \
  --action lambda:InvokeFunction --principal '*'

# Print URL — save as the frontend's VITE_LAMBDA_URL
aws lambda get-function-url-config --region $AWS_REGION --function-name code-lambda \
  --query FunctionUrl --output text
```

Smoke test:

```bash
URL=$(aws lambda get-function-url-config --region $AWS_REGION --function-name code-lambda --query FunctionUrl --output text)
curl -s -X POST -H 'Content-Type: application/json' $URL -d '{"is_warmup":true}'
curl -s -X POST -H 'Content-Type: application/json' $URL -d '{"language":"python","code":"print(1+1)"}'
```

## 3. Re-deploy

```bash
docker buildx build --platform linux/arm64 --provenance=false --output=type=docker -t code-lambda .
docker run --rm -d -p 9000:8080 --memory=1024m --name code-lambda-test code-lambda
./test_suite.sh && ./test_stdin.sh && ./test_stress.sh
docker stop code-lambda-test
docker tag code-lambda:latest ${ECR}:latest
docker push ${ECR}:latest
aws lambda update-function-code --region $AWS_REGION --function-name code-lambda \
  --image-uri ${ECR}:latest
```

## Notes

- **Region.** Function URLs aren't supported in `ap-south-2`, `ap-southeast-4`, `eu-south-2`, `eu-central-2`, `il-central-1`, `me-central-1`.
- **Memory.** Don't drop below 1024 MB — `javac` cold start trips `COMPILE_TIME_LIMIT_EXCEEDED` on smaller sizes.
- **Concurrency cap** (`put-function-concurrency --reserved-concurrent-executions 10`) is optional. Fresh AWS accounts have an account-wide limit of 10 anyway, so reserving is redundant until you raise the quota.
