# Moodify GCP Deployment Guide

Complete production-ready deployment guide for Moodify on Google Cloud Platform (GCP).

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

```
┌───────────────────────────────────────────────────────────────┐
│                    Google Cloud Platform                      │
├───────────────────────────────────────────────────────────────┤
│  Cloud CDN → Cloud Armor → Cloud Load Balancing               │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  GKE Cluster (Kubernetes)                              │   │
│  │  ├── Frontend Pods (React) x3                          │   │
│  │  ├── Backend Pods (Django) x3                          │   │
│  │  ├── AI/ML Pods (Flask) x2 (GPU-enabled)               │   │
│  │  └── Worker Pods (Celery) x2                           │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                               │
│  Data Layer:                                                  │
│  ├── Cloud Firestore - Document database                      │
│  ├── Memorystore Redis - Caching (HA mode)                    │
│  ├── Cloud Storage - Models, Assets, Logs                     │
│  └── Cloud SQL PostgreSQL (Optional) - Analytics              │
│                                                               │
│  Monitoring & Logging:                                        │
│  ├── Cloud Monitoring - Metrics, Dashboards                   │
│  ├── Cloud Logging - Centralized logs                         │
│  ├── Cloud Trace - Distributed tracing                        │
│  └── Error Reporting - Error tracking                         │
└───────────────────────────────────────────────────────────────┘
```

### Key GCP Services

| Service | Purpose | Configuration |
|---------|---------|---------------|
| **GKE** | Kubernetes orchestration | 2-10 nodes, autoscaling, GPU nodes |
| **Cloud Firestore** | NoSQL document database | Native mode, multi-region |
| **Memorystore Redis** | Managed Redis cache | Standard tier, HA, 5GB |
| **Cloud Storage** | Object storage | Multi-region, lifecycle policies |
| **Cloud CDN** | Content delivery | Global edge network |
| **Cloud Load Balancing** | Load balancing | Global HTTPS LB |
| **Artifact Registry** | Container images | Private repositories |
| **Cloud Monitoring** | Observability | Metrics, logs, traces |
| **Secret Manager** | Secrets storage | Encrypted credentials |
| **Cloud Armor** | WAF & DDoS protection | Rate limiting, geo-blocking |

## Prerequisites

### Required Tools

1. **gcloud CLI** (v450+)
   ```bash
   # Install gcloud CLI
   curl https://sdk.cloud.google.com | bash
   exec -l $SHELL

   # Initialize
   gcloud init

   # Authenticate
   gcloud auth login
   gcloud auth application-default login
   ```

2. **Terraform** (v1.5+)
   ```bash
   wget https://releases.hashicorp.com/terraform/1.5.0/terraform_1.5.0_linux_amd64.zip
   unzip terraform_1.5.0_linux_amd64.zip
   sudo mv terraform /usr/local/bin/
   ```

3. **kubectl** (v1.27+)
   ```bash
   gcloud components install kubectl
   ```

4. **Docker** (v24+)
   ```bash
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   ```

### GCP Project Requirements

- GCP Project with billing enabled
- Project owner or editor role
- APIs enabled:
  - Compute Engine API
  - Kubernetes Engine API
  - Container Registry API
  - Cloud Storage API
  - Cloud Firestore API
  - Memorystore for Redis API
  - Secret Manager API
  - Cloud Monitoring API
  - Cloud Logging API

```bash
# Enable required APIs
gcloud services enable \
  container.googleapis.com \
  compute.googleapis.com \
  storage-api.googleapis.com \
  firestore.googleapis.com \
  redis.googleapis.com \
  secretmanager.googleapis.com \
  monitoring.googleapis.com \
  logging.googleapis.com \
  artifactregistry.googleapis.com
```

### Estimated Costs

| Environment | Monthly Cost (USD) |
|-------------|-------------------|
| **Development** | $150 - $350 |
| **Staging** | $400 - $700 |
| **Production** | $1,200 - $2,500 |

*Costs vary based on traffic, data storage, and GPU usage*

## Infrastructure Setup

### Step 1: Clone Repository

```bash
git clone https://github.com/hoangsonww/Moodify-Emotion-Music-App.git
cd Moodify-Emotion-Music-App/gcp/terraform
```

### Step 2: Set GCP Project

```bash
export PROJECT_ID="your-gcp-project-id"
gcloud config set project $PROJECT_ID
```

### Step 3: Configure Variables

Create `terraform.tfvars`:

```hcl
# General
project_id  = "your-gcp-project-id"
region      = "us-central1"
environment = "production"

# Network
private_subnet_cidr = "10.0.0.0/20"
pods_cidr          = "10.4.0.0/14"
services_cidr      = "10.8.0.0/20"

# GKE
gke_machine_type      = "n1-standard-4"
gke_node_count        = 3
gke_min_nodes         = 2
gke_max_nodes         = 10
use_preemptible_nodes = false  # Set true for cost savings

# Redis
redis_memory_size_gb = 5

# Application Secrets
jwt_secret_key        = "CHANGE_ME_32_CHARACTER_SECRET"
spotify_client_id     = "YOUR_SPOTIFY_CLIENT_ID"
spotify_client_secret = "YOUR_SPOTIFY_CLIENT_SECRET"

# Monitoring
alert_email = "devops@moodify.com"
```

### Step 4: Initialize Terraform

```bash
# Create GCS bucket for state
gsutil mb gs://moodify-terraform-state

# Initialize Terraform
terraform init

# Validate configuration
terraform validate

# Plan deployment
terraform plan -out=tfplan
```

### Step 5: Deploy Infrastructure

```bash
# Apply infrastructure changes
terraform apply tfplan

# This will take 15-20 minutes
# Monitor progress in GCP Console
```

### Step 6: Configure kubectl

```bash
# Get GKE credentials
gcloud container clusters get-credentials \
  moodify-production-gke \
  --region us-central1 \
  --project $PROJECT_ID

# Verify connection
kubectl get nodes
kubectl cluster-info
```

## Application Deployment

### Step 1: Configure Docker for GCR

```bash
# Configure Docker authentication
gcloud auth configure-docker us-central1-docker.pkg.dev

# Set environment variables
export PROJECT_ID=$(gcloud config get-value project)
export REGION="us-central1"
export IMAGE_TAG="v1.0.0"
```

### Step 2: Build and Push Docker Images

```bash
# Build Backend
cd ../../backend
docker build -t moodify-backend:${IMAGE_TAG} .
docker tag moodify-backend:${IMAGE_TAG} \
  ${REGION}-docker.pkg.dev/${PROJECT_ID}/moodify-production-docker/backend:${IMAGE_TAG}
docker push ${REGION}-docker.pkg.dev/${PROJECT_ID}/moodify-production-docker/backend:${IMAGE_TAG}

# Build Frontend
cd ../frontend
docker build -t moodify-frontend:${IMAGE_TAG} .
docker tag moodify-frontend:${IMAGE_TAG} \
  ${REGION}-docker.pkg.dev/${PROJECT_ID}/moodify-production-docker/frontend:${IMAGE_TAG}
docker push ${REGION}-docker.pkg.dev/${PROJECT_ID}/moodify-production-docker/frontend:${IMAGE_TAG}

# Build AI/ML
cd ../ai_ml
docker build -t moodify-ai-ml:${IMAGE_TAG} .
docker tag moodify-ai-ml:${IMAGE_TAG} \
  ${REGION}-docker.pkg.dev/${PROJECT_ID}/moodify-production-docker/ai-ml:${IMAGE_TAG}
docker push ${REGION}-docker.pkg.dev/${PROJECT_ID}/moodify-production-docker/ai-ml:${IMAGE_TAG}
```

### Step 3: Create Kubernetes Secrets

```bash
# Get Redis host and port from Terraform output
REDIS_HOST=$(terraform output -raw redis_host)
REDIS_PORT=$(terraform output -raw redis_port)

# Create secrets
kubectl create secret generic moodify-secrets \
  --from-literal=FIRESTORE_PROJECT_ID="${PROJECT_ID}" \
  --from-literal=REDIS_HOST="${REDIS_HOST}" \
  --from-literal=REDIS_PORT="${REDIS_PORT}" \
  --from-literal=JWT_SECRET_KEY="your-jwt-secret" \
  --from-literal=SPOTIFY_CLIENT_ID="your-spotify-id" \
  --from-literal=SPOTIFY_CLIENT_SECRET="your-spotify-secret" \
  --namespace=moodify-production
```

### Step 4: Deploy Applications

```bash
cd ../gcp/kubernetes/production

# Create namespaces
kubectl apply -f namespaces.yaml

# Apply ConfigMaps
kubectl apply -f configmap.yaml

# Deploy applications
kubectl apply -f backend-deployment.yaml
kubectl apply -f frontend-deployment.yaml
kubectl apply -f ai-ml-deployment.yaml

# Deploy Ingress
kubectl apply -f ingress.yaml

# Verify deployments
kubectl get all -n moodify-production
```

## Monitoring and Logging

### Cloud Monitoring Dashboards

```bash
# View logs
gcloud logging read \
  "resource.type=k8s_container AND resource.labels.cluster_name=moodify-production-gke" \
  --limit 50 \
  --format json

# Create custom dashboard
gcloud monitoring dashboards create --config-from-file=dashboard.json
```

### Key Metrics

- Request latency (P50, P95, P99)
- Error rates
- CPU/Memory utilization
- Pod restarts
- Redis cache hit rate
- Firestore read/write ops

### Alerts

Configure alerts via Cloud Monitoring:
- High CPU (>80% for 5 min)
- High Memory (>85% for 5 min)
- Error rate >1%
- Response time >2s (P95)

## Backup and Disaster Recovery

### Automated Backups

**Firestore:**
```bash
# Enable automated backups
gcloud firestore databases update \
  --database=moodify-production-firestore \
  --backup-schedule=daily
```

**Cloud Storage:**
- Versioning enabled
- Cross-region replication
- Lifecycle management

**Redis:**
- Point-in-time recovery
- Automated snapshots

### Disaster Recovery

**RTO: 2 hours | RPO: 4 hours**

```bash
# Restore from backup
gcloud firestore import gs://moodify-backups/[BACKUP_ID]

# Redeploy application
kubectl rollout restart deployment -n moodify-production
```

## Scaling

### Horizontal Pod Autoscaling

```bash
# Scale deployment manually
kubectl scale deployment backend-deployment \
  --replicas=5 \
  -n moodify-production

# View HPA status
kubectl get hpa -n moodify-production
```

### Cluster Autoscaling

```bash
# Update node pool
gcloud container clusters update moodify-production-gke \
  --enable-autoscaling \
  --min-nodes=2 \
  --max-nodes=15 \
  --region=us-central1
```

## Security

### Network Security
- VPC with private subnets
- Cloud Armor for DDoS protection
- Identity-Aware Proxy (IAP) for admin access
- Binary Authorization for container security

### Application Security
- Workload Identity for service accounts
- Secret Manager for credentials
- TLS 1.3 for all communications
- Network policies in GKE

### Compliance
- Encryption at rest and in transit
- Audit logging enabled
- VPC Service Controls
- Data residency controls

## Cost Optimization

### Recommendations

1. **Use Preemptible Nodes** for non-critical workloads (save 60-80%)
2. **Enable Cluster Autoscaler** to match demand
3. **Use Committed Use Discounts** (save 30-50%)
4. **Cloud Storage lifecycle policies**
5. **Right-size instances** based on monitoring

### Cost Monitoring

```bash
# View costs
gcloud billing projects describe $PROJECT_ID

# Export billing data to BigQuery for analysis
gcloud beta billing accounts list
```

## Troubleshooting

### Common Issues

#### 1. Pods Not Starting
```bash
kubectl describe pod <pod-name> -n moodify-production
kubectl logs <pod-name> -n moodify-production
```

#### 2. Cannot Connect to GKE
```bash
gcloud container clusters get-credentials \
  moodify-production-gke \
  --region us-central1
```

#### 3. Image Pull Errors
```bash
# Verify Artifact Registry permissions
gcloud artifacts repositories describe moodify-production-docker \
  --location=us-central1
```

#### 4. High Costs
```bash
# Analyze costs
gcloud billing projects describe $PROJECT_ID
# Check for idle resources in Console
```

---

**Last Updated**: 2025-10-07
**Version**: 1.0.0
**Maintained by**: Son Nguyen
