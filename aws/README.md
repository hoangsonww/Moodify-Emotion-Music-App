# Moodify AWS Deployment Guide

Complete production-ready deployment guide for Moodify on Amazon Web Services (AWS).

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Infrastructure Setup](#infrastructure-setup)
- [Application Deployment](#application-deployment)
- [Configuration](#configuration)
- [Monitoring and Logging](#monitoring-and-logging)
- [Backup and Disaster Recovery](#backup-and-disaster-recovery)
- [Scaling](#scaling)
- [Security](#security)
- [Cost Optimization](#cost-optimization)
- [Troubleshooting](#troubleshooting)

## Architecture Overview

The Moodify application is deployed on AWS using the following services:

```
┌──────────────────────────────────────────────────────────────┐
│                      AWS Cloud                               │
├──────────────────────────────────────────────────────────────┤
│  CloudFront CDN → WAF → Route53 → Application Load Balancer  │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐   │
│  │  EKS Cluster (Kubernetes)                             │   │
│  │  ├── Frontend Pods (React) x3                         │   │
│  │  ├── Backend Pods (Django) x3                         │   │
│  │  ├── AI/ML Pods (Flask) x2                            │   │
│  │  └── Worker Pods (Celery) x2                          │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
│  Data Layer:                                                 │
│  ├── DocumentDB (MongoDB Compatible) - 3 instances           │
│  ├── ElastiCache (Redis) - 3 node cluster                    │
│  ├── S3 Buckets - Models, Assets, Logs                       │
│  └── RDS PostgreSQL (Optional) - for analytics               │
│                                                              │
│  Monitoring & Logging:                                       │
│  ├── CloudWatch - Metrics, Logs, Alarms                      │
│  ├── X-Ray - Distributed Tracing                             │
│  └── SNS - Alert Notifications                               │
└──────────────────────────────────────────────────────────────┘
```

### Key AWS Services

| Service | Purpose | Configuration |
|---------|---------|---------------|
| **EKS** | Kubernetes orchestration | 2-10 nodes, autoscaling |
| **DocumentDB** | MongoDB-compatible database | 3 instances, r6g.large |
| **ElastiCache** | Redis caching | 3 nodes, r6g.large |
| **S3** | Object storage | Models, assets, backups |
| **CloudFront** | CDN | Global edge locations |
| **ALB** | Load balancing | Cross-AZ, health checks |
| **ECR** | Container registry | Private repositories |
| **CloudWatch** | Monitoring | Metrics, logs, alarms |
| **Secrets Manager** | Secret storage | Encrypted credentials |
| **WAF** | Web application firewall | DDoS, rate limiting |
| **Route53** | DNS management | Health checks, routing |

## Prerequisites

### Required Tools

1. **AWS CLI** (v2.13+)
   ```bash
   # Install AWS CLI
   curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
   unzip awscliv2.zip
   sudo ./aws/install

   # Configure AWS CLI
   aws configure
   ```

2. **Terraform** (v1.5+)
   ```bash
   # Install Terraform
   wget https://releases.hashicorp.com/terraform/1.5.0/terraform_1.5.0_linux_amd64.zip
   unzip terraform_1.5.0_linux_amd64.zip
   sudo mv terraform /usr/local/bin/
   ```

3. **kubectl** (v1.27+)
   ```bash
   # Install kubectl
   curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
   sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
   ```

4. **eksctl** (v0.150+)
   ```bash
   # Install eksctl
   curl --silent --location "https://github.com/weaveworks/eksctl/releases/latest/download/eksctl_$(uname -s)_amd64.tar.gz" | tar xz -C /tmp
   sudo mv /tmp/eksctl /usr/local/bin
   ```

5. **Docker** (v24+)
   ```bash
   # Install Docker
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   ```

### AWS Account Requirements

- AWS Account with admin access
- Service quotas increased for:
  - VPC (minimum 3)
  - Elastic IPs (minimum 3)
  - EKS clusters (minimum 1)
  - DocumentDB instances (minimum 3)
- Credit card on file for billing
- MFA enabled for root account

### Estimated Costs

| Environment | Monthly Cost (USD) |
|-------------|-------------------|
| **Development** | $200 - $400 |
| **Staging** | $500 - $800 |
| **Production** | $1,500 - $3,000 |

*Costs vary based on traffic and data storage*

## Infrastructure Setup

### Step 1: Clone Repository

```bash
git clone https://github.com/hoangsonww/Moodify-Emotion-Music-App.git
cd Moodify-Emotion-Music-App/aws/terraform
```

### Step 2: Configure Variables

Create `terraform.tfvars`:

```hcl
# General
aws_region  = "us-east-1"
environment = "production"

# VPC
vpc_cidr = "10.0.0.0/16"

# EKS
eks_cluster_version = "1.27"
eks_desired_nodes   = 3
eks_min_nodes       = 2
eks_max_nodes       = 10

# DocumentDB
docdb_instance_class = "db.r6g.large"
docdb_instance_count = 3

# ElastiCache
redis_node_type  = "cache.r6g.large"
redis_num_nodes  = 3

# Credentials (use AWS Secrets Manager in production)
db_master_username = "moodify_admin"
db_master_password = "CHANGE_ME_SECURE_PASSWORD"

# Application
jwt_secret_key        = "CHANGE_ME_32_CHARACTER_SECRET"
spotify_client_id     = "YOUR_SPOTIFY_CLIENT_ID"
spotify_client_secret = "YOUR_SPOTIFY_CLIENT_SECRET"

# Monitoring
alert_email = "devops@moodify.com"

# Domain (if using custom domain)
enable_custom_domain = true
domain_name          = "moodify.com"

# Security
enable_waf = true
```

### Step 3: Initialize Terraform

```bash
# Initialize Terraform
terraform init

# Validate configuration
terraform validate

# Plan deployment
terraform plan -out=tfplan

# Review the plan carefully
```

### Step 4: Deploy Infrastructure

```bash
# Apply infrastructure changes
terraform apply tfplan

# This will take 20-30 minutes
# Monitor progress in AWS Console
```

### Step 5: Configure kubectl

```bash
# Update kubeconfig for EKS
aws eks update-kubeconfig \
  --region us-east-1 \
  --name moodify-production-eks

# Verify connection
kubectl get nodes
kubectl get namespaces
```

## Application Deployment

### Step 1: Create Secrets

```bash
# Create Kubernetes secrets from AWS Secrets Manager
kubectl create secret generic moodify-secrets \
  --from-literal=MONGODB_URI="mongodb://username:password@docdb-endpoint:27017/moodify?ssl=true" \
  --from-literal=REDIS_URI="redis://redis-endpoint:6379/0" \
  --from-literal=JWT_SECRET_KEY="your-jwt-secret" \
  --from-literal=SPOTIFY_CLIENT_ID="your-spotify-id" \
  --from-literal=SPOTIFY_CLIENT_SECRET="your-spotify-secret" \
  --from-literal=AWS_ACCESS_KEY_ID="your-aws-key" \
  --from-literal=AWS_SECRET_ACCESS_KEY="your-aws-secret" \
  --namespace=moodify-production
```

### Step 2: Build and Push Docker Images

```bash
# Get ECR login credentials
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.us-east-1.amazonaws.com

# Set variables
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export AWS_REGION="us-east-1"
export IMAGE_TAG="v1.0.0"

# Build Backend
cd ../../backend
docker build -t moodify-backend:${IMAGE_TAG} .
docker tag moodify-backend:${IMAGE_TAG} ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/moodify-production-backend:${IMAGE_TAG}
docker push ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/moodify-production-backend:${IMAGE_TAG}

# Build Frontend
cd ../frontend
docker build -t moodify-frontend:${IMAGE_TAG} .
docker tag moodify-frontend:${IMAGE_TAG} ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/moodify-production-frontend:${IMAGE_TAG}
docker push ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/moodify-production-frontend:${IMAGE_TAG}

# Build AI/ML
cd ../ai_ml
docker build -t moodify-ai-ml:${IMAGE_TAG} .
docker tag moodify-ai-ml:${IMAGE_TAG} ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/moodify-production-ai-ml:${IMAGE_TAG}
docker push ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/moodify-production-ai-ml:${IMAGE_TAG}
```

### Step 3: Deploy to Kubernetes

```bash
cd ../aws/kubernetes/production

# Apply namespaces
kubectl apply -f namespaces.yaml

# Apply ConfigMaps
kubectl apply -f configmap.yaml

# Deploy applications
kubectl apply -f backend-deployment.yaml
kubectl apply -f frontend-deployment.yaml
kubectl apply -f ai-ml-deployment.yaml

# Deploy ingress
kubectl apply -f ingress.yaml

# Verify deployments
kubectl get deployments -n moodify-production
kubectl get pods -n moodify-production
kubectl get services -n moodify-production
```

### Step 4: Verify Deployment

```bash
# Check pod status
kubectl get pods -n moodify-production -w

# Check logs
kubectl logs -f deployment/backend-deployment -n moodify-production

# Check services
kubectl get svc -n moodify-production

# Get load balancer URL
kubectl get ingress -n moodify-production
```

## Configuration

### Environment Variables

Key environment variables are configured in `configmap.yaml`:

```yaml
# Backend
DJANGO_SETTINGS_MODULE: "backend.settings"
MONGODB_URI: "<from-secrets>"
REDIS_URI: "<from-secrets>"

# Frontend
REACT_APP_API_URL: "https://api.moodify.com"

# AI/ML
MODEL_PATH: "/models"
BATCH_SIZE: "16"
```

### Secrets Management

Use AWS Secrets Manager for sensitive data:

```bash
# Store secret
aws secretsmanager create-secret \
  --name moodify/production/db-password \
  --secret-string "your-secure-password"

# Retrieve secret
aws secretsmanager get-secret-value \
  --secret-id moodify/production/db-password \
  --query SecretString \
  --output text
```

### SSL/TLS Certificates

Use AWS Certificate Manager (ACM):

```bash
# Request certificate
aws acm request-certificate \
  --domain-name moodify.com \
  --subject-alternative-names www.moodify.com api.moodify.com \
  --validation-method DNS

# Validate certificate (update Route53 records)
# Certificate will be automatically validated after DNS propagation
```

## Monitoring and Logging

### CloudWatch Dashboards

Access pre-configured dashboards:

```bash
# Open CloudWatch Console
aws cloudwatch get-dashboard \
  --dashboard-name moodify-production
```

Key metrics monitored:
- CPU and memory utilization
- Request latency (P50, P95, P99)
- Error rates
- Database connections
- Cache hit rates

### Log Aggregation

```bash
# View application logs
aws logs tail /aws/moodify/production/backend --follow

# Query logs
aws logs filter-log-events \
  --log-group-name /aws/moodify/production/backend \
  --filter-pattern "ERROR" \
  --start-time $(date -d '1 hour ago' +%s)000
```

### Alerts

Configured CloudWatch Alarms:
- High CPU usage (>80% for 5 minutes)
- High memory usage (>85% for 5 minutes)
- Error rate >1%
- Response time >2s (P95)
- Failed health checks

Notifications sent via SNS to: `${alert_email}`

## Backup and Disaster Recovery

### Automated Backups

**DocumentDB:**
- Daily automatic backups
- Retention: 7 days
- Manual snapshots: monthly
- Point-in-time recovery enabled

**ElastiCache:**
- Daily snapshots
- Retention: 5 days

**S3:**
- Versioning enabled
- Cross-region replication to us-west-2
- Lifecycle policies for cost optimization

### Disaster Recovery Procedures

**RTO: 2 hours | RPO: 4 hours**

1. **Database Recovery:**
   ```bash
   # Restore from snapshot
   aws docdb restore-db-cluster-from-snapshot \
     --db-cluster-identifier moodify-production-restored \
     --snapshot-identifier <snapshot-id>
   ```

2. **Application Recovery:**
   ```bash
   # Redeploy from last known good state
   kubectl rollout undo deployment/backend-deployment -n moodify-production
   ```

3. **Full Stack Recovery:**
   ```bash
   # Re-apply Terraform
   cd aws/terraform
   terraform apply -var-file=backup.tfvars
   ```

## Scaling

### Horizontal Pod Autoscaling

Configured HPA for all services:

```yaml
minReplicas: 3
maxReplicas: 10
targetCPUUtilization: 70%
targetMemoryUtilization: 80%
```

### Cluster Autoscaling

EKS cluster scales based on:
- Pod resource requests
- Node utilization
- Custom metrics

```bash
# Check autoscaler status
kubectl -n kube-system logs -f deployment/cluster-autoscaler
```

### Manual Scaling

```bash
# Scale deployment
kubectl scale deployment backend-deployment \
  --replicas=5 \
  -n moodify-production

# Scale node group
aws eks update-nodegroup-config \
  --cluster-name moodify-production-eks \
  --nodegroup-name general \
  --scaling-config minSize=3,maxSize=15,desiredSize=5
```

## Security

### Network Security

- VPC with private subnets
- Security groups with least privilege
- NACLs for additional layer
- VPN/Bastion for admin access

### Application Security

- JWT authentication
- Rate limiting (100 req/min)
- Input validation
- SQL injection prevention
- XSS protection
- CSRF tokens

### Compliance

- Encryption at rest (AES-256)
- Encryption in transit (TLS 1.3)
- Audit logging enabled
- GDPR compliance measures

## Cost Optimization

### Recommendations

1. **Use Reserved Instances** for stable workloads (save 30-40%)
2. **Enable auto-scaling** to match demand
3. **Use Spot Instances** for non-critical workloads (save 70%)
4. **S3 Lifecycle policies** for old data
5. **CloudWatch Logs retention** - reduce to 7 days for non-critical logs
6. **Right-size instances** - monitor and adjust

### Cost Monitoring

```bash
# Get cost and usage
aws ce get-cost-and-usage \
  --time-period Start=2025-10-01,End=2025-10-31 \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --filter file://filters.json
```

## Troubleshooting

### Common Issues

#### 1. Pods Stuck in Pending

```bash
kubectl describe pod <pod-name> -n moodify-production
# Check: Insufficient resources, PVC issues, node selectors
```

#### 2. High Latency

```bash
# Check service mesh
kubectl top pods -n moodify-production

# Review CloudWatch metrics
# Enable X-Ray tracing for detailed analysis
```

#### 3. Database Connection Issues

```bash
# Test connectivity
kubectl run -it --rm debug \
  --image=busybox \
  --restart=Never \
  -- sh -c "nc -zv documentdb-endpoint 27017"
```

#### 4. Certificate Issues

```bash
# Check certificate status
aws acm describe-certificate \
  --certificate-arn <cert-arn>
```

---

**Last Updated**: 2025-10-07
**Version**: 1.0.0
**Maintained by**: Son Nguyen
