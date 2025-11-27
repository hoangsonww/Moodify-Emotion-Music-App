# Moodify Deployment Architecture

Comprehensive visual documentation of the Moodify deployment architecture using Mermaid diagrams.

## Table of Contents

- [Overall Architecture](#overall-architecture)
- [Blue-Green Deployment Flow](#blue-green-deployment-flow)
- [Canary Deployment Flow](#canary-deployment-flow)
- [Traffic Management](#traffic-management)
- [CI/CD Pipeline](#cicd-pipeline)
- [Rollback Procedures](#rollback-procedures)
- [Infrastructure Components](#infrastructure-components)
- [Security Architecture](#security-architecture)

## Overall Architecture

### High-Level System Architecture

```mermaid
graph TB
    subgraph Users["Users & Clients"]
        WEB[Web Browsers]
        MOBILE[Mobile Apps]
        API_CLIENT[API Clients]
    end

    subgraph CDN["CDN & Load Balancing"]
        CDN_LAYER[CloudFront / CDN]
        LB[Load Balancer]
    end

    subgraph K8S["Kubernetes Cluster"]
        subgraph Ingress["Ingress Layer"]
            NGINX[NGINX Ingress<br/>Controller]
            ISTIO[Istio Gateway]
        end

        subgraph ServiceMesh["Service Mesh Layer"]
            VS[Virtual Services]
            DR[Destination Rules]
        end

        subgraph Deployments["Application Layer"]
            BLUE[Blue Environment<br/>Stable Production]
            GREEN[Green Environment<br/>Candidate Release]
            CANARY[Canary Deployment<br/>Progressive Rollout]
        end

        subgraph Support["Supporting Services"]
            HPA[Horizontal Pod<br/>Autoscaler]
            PDB[Pod Disruption<br/>Budget]
            NP[Network Policies]
        end
    end

    subgraph Data["Data Layer"]
        MONGO[(MongoDB<br/>Primary Database)]
        REDIS[(Redis<br/>Cache & Sessions)]
        S3[(S3<br/>Object Storage)]
    end

    subgraph Monitoring["Observability Layer"]
        PROM[Prometheus<br/>Metrics]
        GRAF[Grafana<br/>Dashboards]
        FLUENTBIT[Fluent Bit<br/>Logs]
        ELK[ELK Stack<br/>Log Analysis]
    end

    subgraph External["External Services"]
        SPOTIFY[Spotify API]
        AUTH[Auth Providers]
    end

    WEB --> CDN_LAYER
    MOBILE --> CDN_LAYER
    API_CLIENT --> LB
    CDN_LAYER --> LB
    LB --> NGINX
    LB --> ISTIO

    NGINX --> VS
    ISTIO --> VS

    VS --> BLUE
    VS -.-> GREEN
    VS -.->|10-100%| CANARY

    BLUE --> MONGO
    BLUE --> REDIS
    BLUE --> S3
    GREEN --> MONGO
    GREEN --> REDIS
    CANARY --> MONGO
    CANARY --> REDIS

    BLUE --> PROM
    GREEN --> PROM
    CANARY --> PROM

    PROM --> GRAF
    BLUE --> FLUENTBIT
    GREEN --> FLUENTBIT
    CANARY --> FLUENTBIT
    FLUENTBIT --> ELK

    BLUE --> SPOTIFY
    BLUE --> AUTH

    HPA -.->|Scales| BLUE
    HPA -.->|Scales| GREEN
    HPA -.->|Scales| CANARY

    PDB -.->|Protects| BLUE
    PDB -.->|Protects| GREEN

    style Users fill:#E74C3C,stroke:#922B21,color:#fff
    style CDN fill:#F39C12,stroke:#9A7D0A,color:#fff
    style Ingress fill:#3498DB,stroke:#21618C,color:#fff
    style BLUE fill:#4A90E2,stroke:#2E5C8A,color:#fff
    style GREEN fill:#50C878,stroke:#2E7D4E,color:#fff
    style CANARY fill:#FFD700,stroke:#B8860B,color:#000
    style Data fill:#9B59B6,stroke:#6C3483,color:#fff
    style Monitoring fill:#16A085,stroke:#0E6655,color:#fff
    style External fill:#E67E22,stroke:#A04000,color:#fff
```

## Blue-Green Deployment Flow

### Complete Blue-Green Deployment Process

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant CI as CI/CD Pipeline
    participant Blue as Blue Environment
    participant Green as Green Environment
    participant LB as Load Balancer
    participant Monitor as Monitoring
    participant User as End Users

    Dev->>CI: Push code to master
    CI->>CI: Run tests & security scans
    CI->>CI: Build Docker images

    Note over CI,Green: Check current active environment
    CI->>LB: Query active environment
    LB-->>CI: Blue is active

    Note over Green: Deploy to Green (inactive)
    CI->>Green: Deploy new version
    Green->>Green: Initialize containers
    Green->>Green: Run migrations
    Green->>Green: Health checks
    Green-->>CI: Deployment successful

    Note over CI,Green: Validation Phase
    CI->>Green: Run smoke tests
    Green-->>CI: Tests passed
    CI->>Monitor: Check metrics
    Monitor-->>CI: Green healthy

    Note over LB: Traffic Switch
    CI->>LB: Switch traffic: Blue → Green
    LB->>Green: Route 100% traffic
    LB->>User: Serve from Green

    Note over Blue: Keep as backup
    Blue->>Blue: Remain running (standby)

    Note over Monitor: Post-deployment monitoring
    Monitor->>Green: Collect metrics
    Monitor->>CI: Verify deployment success

    alt Deployment Successful
        CI->>Dev: Notify success
        Note over Blue: Can be scaled down later
    else Issues Detected
        CI->>LB: Rollback: Green → Blue
        LB->>Blue: Route 100% traffic
        CI->>Dev: Notify rollback
    end
```

### Blue-Green State Transitions

```mermaid
stateDiagram-v2
    [*] --> BlueActive: Initial State

    BlueActive --> DeployingGreen: New release
    DeployingGreen --> GreenTesting: Deployment complete
    GreenTesting --> GreenActive: Tests passed
    GreenTesting --> BlueActive: Tests failed (rollback)

    GreenActive --> DeployingBlue: New release
    DeployingBlue --> BlueTesting: Deployment complete
    BlueTesting --> BlueActive: Tests passed
    BlueTesting --> GreenActive: Tests failed (rollback)

    BlueActive --> [*]: Shutdown
    GreenActive --> [*]: Shutdown

    note right of BlueActive
        Blue serving traffic
        Green on standby
    end note

    note right of GreenActive
        Green serving traffic
        Blue on standby
    end note
```

## Canary Deployment Flow

### Progressive Canary Rollout

```mermaid
sequenceDiagram
    participant CI as CI/CD Pipeline
    participant Stable as Stable (90%)
    participant Canary as Canary (10%)
    participant LB as Load Balancer
    participant Monitor as Monitoring
    participant Alert as Alerting

    Note over CI: Deploy Canary Version
    CI->>Canary: Deploy v2.0.0-canary
    Canary->>Canary: Initialize pods
    Canary-->>CI: Ready

    Note over LB: Stage 1: 10% Traffic
    CI->>LB: Set weights: Stable=90%, Canary=10%
    LB->>Stable: 90% requests
    LB->>Canary: 10% requests

    loop Monitor for 5 minutes
        Monitor->>Canary: Check metrics
        Monitor->>Monitor: Error rate < 5%?
        Monitor->>Monitor: Latency P95 < 2s?
    end

    alt Metrics Good
        Note over LB: Stage 2: 25% Traffic
        CI->>LB: Set weights: Stable=75%, Canary=25%
        LB->>Stable: 75% requests
        LB->>Canary: 25% requests

        loop Monitor for 5 minutes
            Monitor->>Canary: Check metrics
        end

        alt Metrics Good
            Note over LB: Stage 3: 50% Traffic
            CI->>LB: Set weights: Stable=50%, Canary=50%

            loop Monitor for 5 minutes
                Monitor->>Canary: Check metrics
            end

            alt Metrics Good
                Note over LB: Stage 4: 100% Traffic
                CI->>LB: Set weights: Stable=0%, Canary=100%
                CI->>Stable: Update to v2.0.0
                CI->>Canary: Scale down canary
                Note over CI: Canary promoted to stable
            else Metrics Bad
                CI->>LB: Rollback to 0%
                Alert->>CI: Alert triggered
            end
        else Metrics Bad
            CI->>LB: Rollback to 10%
            Alert->>CI: Alert triggered
        end
    else Metrics Bad
        CI->>LB: Set weight: Canary=0%
        CI->>Canary: Scale down
        Alert->>CI: Canary failed
    end
```

### Canary Deployment State Machine

```mermaid
stateDiagram-v2
    [*] --> Deploying: Start canary
    Deploying --> Health_Check: Pods ready
    Health_Check --> Traffic_10: Health OK
    Health_Check --> Failed: Health failed

    Traffic_10 --> Monitoring_10: Set 10% traffic
    Monitoring_10 --> Traffic_25: Metrics OK (5 min)
    Monitoring_10 --> Rollback: Error rate high

    Traffic_25 --> Monitoring_25: Set 25% traffic
    Monitoring_25 --> Traffic_50: Metrics OK (5 min)
    Monitoring_25 --> Rollback: Error rate high

    Traffic_50 --> Monitoring_50: Set 50% traffic
    Monitoring_50 --> Traffic_100: Metrics OK (5 min)
    Monitoring_50 --> Rollback: Error rate high

    Traffic_100 --> Promoting: Set 100% traffic
    Promoting --> Completed: Update stable

    Rollback --> [*]: Canary removed
    Failed --> [*]: Deployment failed
    Completed --> [*]: Success

    note right of Monitoring_10
        Check:
        - Error rate < 5%
        - P95 latency < 2s
        - No pod restarts
    end note
```

## Traffic Management

### Istio Traffic Routing

```mermaid
graph TB
    subgraph Client["Client Requests"]
        REQ[HTTP Requests]
    end

    subgraph Gateway["Istio Gateway"]
        IG[Ingress Gateway<br/>Port 443/80]
    end

    subgraph VirtualService["Virtual Service Rules"]
        VS[backend-vs]

        subgraph Rules["Routing Rules"]
            R1[Header-based<br/>X-Canary: true]
            R2[Weight-based<br/>Stable: 90%<br/>Canary: 10%]
        end
    end

    subgraph DestinationRules["Destination Rules"]
        DR[backend-dr]

        subgraph Subsets["Service Subsets"]
            SS1[Subset: stable<br/>Blue/Green]
            SS2[Subset: canary<br/>Canary pods]
        end

        subgraph Policies["Traffic Policies"]
            LB[Load Balancer:<br/>LEAST_REQUEST]
            CB[Circuit Breaker:<br/>Max Conn: 1000]
            RT[Retries:<br/>3 attempts]
        end
    end

    subgraph Services["Kubernetes Services"]
        SVC_STABLE[backend-service<br/>Stable pods]
        SVC_CANARY[backend-canary-service<br/>Canary pods]
    end

    subgraph Pods["Pod Endpoints"]
        BLUE[Blue Pods<br/>3-15 replicas]
        GREEN[Green Pods<br/>3-15 replicas]
        CANARY[Canary Pods<br/>1-5 replicas]
    end

    REQ --> IG
    IG --> VS

    VS --> R1
    VS --> R2

    R1 -->|X-Canary=true| DR
    R2 -->|90%| DR
    R2 -->|10%| DR

    DR --> SS1
    DR --> SS2

    SS1 --> SVC_STABLE
    SS2 --> SVC_CANARY

    SVC_STABLE --> BLUE
    SVC_STABLE -.-> GREEN
    SVC_CANARY --> CANARY

    LB -.->|Applies to| SVC_STABLE
    LB -.->|Applies to| SVC_CANARY
    CB -.->|Protects| SVC_STABLE
    RT -.->|Applies to| SVC_STABLE

    style Client fill:#E74C3C,stroke:#922B21,color:#fff
    style Gateway fill:#3498DB,stroke:#21618C,color:#fff
    style VirtualService fill:#F39C12,stroke:#9A7D0A,color:#fff
    style DestinationRules fill:#16A085,stroke:#0E6655,color:#fff
    style Services fill:#9B59B6,stroke:#6C3483,color:#fff
    style BLUE fill:#4A90E2,stroke:#2E5C8A,color:#fff
    style GREEN fill:#50C878,stroke:#2E7D4E,color:#fff
    style CANARY fill:#FFD700,stroke:#B8860B,color:#000
```

### NGINX Ingress Canary Routing

```mermaid
graph TB
    subgraph Requests["Incoming Requests"]
        ALL[All Traffic]
    end

    subgraph Ingress["NGINX Ingress Controller"]
        NGINX[Ingress Controller]

        subgraph MainIngress["Main Ingress"]
            MAIN[backend-ingress<br/>Weight: 90%]
        end

        subgraph CanaryIngress["Canary Ingress"]
            CAN[backend-ingress-canary<br/>Weight: 10%]

            subgraph Annotations["Canary Annotations"]
                ANN1[canary: true]
                ANN2[canary-weight: 10]
                ANN3[canary-by-header:<br/>X-Canary]
                ANN4[canary-by-cookie:<br/>canary-user]
            end
        end
    end

    subgraph Services["Services"]
        SVC_MAIN[backend-service<br/>Stable Backend]
        SVC_CAN[backend-canary-service<br/>Canary Backend]
    end

    subgraph Backends["Backend Pods"]
        STABLE[Stable Pods<br/>v1.0.0<br/>3-15 replicas]
        CANARY_PODS[Canary Pods<br/>v1.1.0<br/>1-5 replicas]
    end

    ALL --> NGINX

    NGINX -->|90% by weight| MAIN
    NGINX -->|10% by weight| CAN
    NGINX -->|X-Canary header| CAN
    NGINX -->|canary-user cookie| CAN

    MAIN --> SVC_MAIN
    CAN --> SVC_CAN

    SVC_MAIN --> STABLE
    SVC_CAN --> CANARY_PODS

    ANN1 -.-> CAN
    ANN2 -.-> CAN
    ANN3 -.-> CAN
    ANN4 -.-> CAN

    style Requests fill:#E74C3C,stroke:#922B21,color:#fff
    style MainIngress fill:#4A90E2,stroke:#2E5C8A,color:#fff
    style CanaryIngress fill:#FFD700,stroke:#B8860B,color:#000
    style STABLE fill:#50C878,stroke:#2E7D4E,color:#fff
    style CANARY_PODS fill:#F39C12,stroke:#9A7D0A,color:#fff
```

## CI/CD Pipeline

### Complete Pipeline Architecture

```mermaid
graph TB
    subgraph Source["Source Control"]
        GIT[Git Repository<br/>GitHub/GitLab]
        HOOK[Webhook Trigger]
    end

    subgraph Jenkins["Jenkins Master"]
        PIPELINE[Pipeline Orchestrator]

        subgraph Stages["Pipeline Stages"]
            S1[Initialize & Checkout]
            S2[Pre-build Checks]
            S3[Build & Test]
            S4[Security Scanning]
            S5[Build Images]
            S6[Deploy Staging]
            S7[Approval Gate]
            S8[Deploy Production]
            S9[Verification]
        end
    end

    subgraph Security["Security Tools"]
        SONAR[SonarQube<br/>SAST]
        SNYK[Snyk<br/>Dependencies]
        TRIVY[Trivy<br/>Containers]
        GITLEAKS[GitLeaks<br/>Secrets]
    end

    subgraph Registry["Container Registry"]
        DOCKER[Docker Registry<br/>ECR/GCR/ACR]
    end

    subgraph K8S["Kubernetes Cluster"]
        STAGING[Staging Namespace]
        PROD[Production Namespace]
    end

    subgraph Notifications["Notifications"]
        SLACK[Slack Alerts]
        EMAIL[Email Reports]
    end

    GIT -->|Push/PR| HOOK
    HOOK --> PIPELINE

    PIPELINE --> S1
    S1 --> S2
    S2 --> S3
    S3 --> S4

    S4 --> SONAR
    S4 --> SNYK
    S4 --> GITLEAKS

    SONAR --> S5
    SNYK --> S5
    GITLEAKS --> S5

    S5 --> TRIVY
    TRIVY --> DOCKER
    DOCKER --> S6

    S6 --> STAGING
    STAGING --> S7

    S7 -->|Approved| S8
    S7 -->|Rejected| SLACK

    S8 --> PROD
    PROD --> S9

    S9 --> SLACK
    S9 --> EMAIL

    PIPELINE -.->|All stages| SLACK

    style Source fill:#E74C3C,stroke:#922B21,color:#fff
    style Jenkins fill:#4A90E2,stroke:#2E5C8A,color:#fff
    style Security fill:#9B59B6,stroke:#6C3483,color:#fff
    style Registry fill:#F39C12,stroke:#9A7D0A,color:#fff
    style K8S fill:#50C878,stroke:#2E7D4E,color:#fff
    style Notifications fill:#16A085,stroke:#0E6655,color:#fff
```

### Deployment Decision Tree

```mermaid
graph TD
    START[Code Merged to Master] --> BUILD{Build & Test<br/>Successful?}

    BUILD -->|No| NOTIFY_FAIL[Notify Team]
    BUILD -->|Yes| SECURITY{Security Scans<br/>Passed?}

    SECURITY -->|No| FIX[Create Security Issues]
    SECURITY -->|Yes| STAGE[Deploy to Staging]

    STAGE --> STAGE_TEST{Staging Tests<br/>Passed?}
    STAGE_TEST -->|No| NOTIFY_FAIL
    STAGE_TEST -->|Yes| APPROVE{Manual<br/>Approval?}

    APPROVE -->|Rejected| NOTIFY_REJECT[Notify Rejection]
    APPROVE -->|Approved| STRATEGY{Deployment<br/>Strategy?}

    STRATEGY -->|Blue-Green| BG[Blue-Green Deployment]
    STRATEGY -->|Canary| CANARY[Canary Deployment]
    STRATEGY -->|Rolling| ROLLING[Rolling Update]

    BG --> BG_DEPLOY[Deploy to Inactive Env]
    BG_DEPLOY --> BG_TEST{Health Checks<br/>Passed?}
    BG_TEST -->|No| ROLLBACK_BG[Keep Current Active]
    BG_TEST -->|Yes| BG_SWITCH[Switch Traffic]
    BG_SWITCH --> VERIFY

    CANARY --> C_DEPLOY[Deploy Canary 10%]
    C_DEPLOY --> C_10{Metrics OK<br/>@ 10%?}
    C_10 -->|No| ROLLBACK_C[Remove Canary]
    C_10 -->|Yes| C_25[Increase to 25%]
    C_25 --> C_25_OK{Metrics OK<br/>@ 25%?}
    C_25_OK -->|No| ROLLBACK_C
    C_25_OK -->|Yes| C_50[Increase to 50%]
    C_50 --> C_50_OK{Metrics OK<br/>@ 50%?}
    C_50_OK -->|No| ROLLBACK_C
    C_50_OK -->|Yes| C_100[Promote to 100%]
    C_100 --> VERIFY

    ROLLING --> R_UPDATE[Rolling Update]
    R_UPDATE --> VERIFY

    VERIFY{Production<br/>Verification?}
    VERIFY -->|Failed| AUTO_ROLLBACK[Auto Rollback]
    VERIFY -->|Passed| SUCCESS[Deployment Success]

    AUTO_ROLLBACK --> NOTIFY_FAIL
    ROLLBACK_BG --> NOTIFY_FAIL
    ROLLBACK_C --> NOTIFY_FAIL
    SUCCESS --> TAG[Create Release Tag]
    TAG --> NOTIFY_SUCCESS[Notify Success]

    style START fill:#4A90E2,stroke:#2E5C8A,color:#fff
    style SUCCESS fill:#27AE60,stroke:#1E8449,color:#fff
    style NOTIFY_SUCCESS fill:#27AE60,stroke:#1E8449,color:#fff
    style NOTIFY_FAIL fill:#E74C3C,stroke:#922B21,color:#fff
    style AUTO_ROLLBACK fill:#E74C3C,stroke:#922B21,color:#fff
    style ROLLBACK_BG fill:#E74C3C,stroke:#922B21,color:#fff
    style ROLLBACK_C fill:#E74C3C,stroke:#922B21,color:#fff
```

## Rollback Procedures

### Rollback Flow

```mermaid
sequenceDiagram
    participant Monitor as Monitoring
    participant Alert as Alert Manager
    participant Ops as Operations Team
    participant Script as Rollback Script
    participant K8S as Kubernetes
    participant LB as Load Balancer
    participant User as End Users

    Note over Monitor: Detect Issue
    Monitor->>Monitor: Error rate > 5%
    Monitor->>Monitor: P95 latency > 5s
    Monitor->>Alert: Trigger alert

    Alert->>Ops: Page on-call engineer
    Ops->>Ops: Assess severity

    alt Critical Issue (P0)
        Ops->>Script: Execute auto-rollback
        Note over Script: Immediate rollback
    else Major Issue (P1)
        Ops->>Ops: Manual decision
        Ops->>Script: Initiate rollback
    end

    Note over Script: Determine deployment type
    Script->>K8S: Check current deployment
    K8S-->>Script: Blue-Green / Canary / Rolling

    alt Blue-Green Rollback
        Script->>LB: Switch to previous environment
        LB->>K8S: Route to old environment
        Note over LB: Instant traffic switch
    else Canary Rollback
        Script->>LB: Set canary weight to 0%
        Script->>K8S: Scale down canary
        Note over Script: Remove canary deployment
    else Rolling Rollback
        Script->>K8S: kubectl rollout undo
        K8S->>K8S: Revert to previous revision
    end

    Note over K8S: Verify rollback
    K8S->>Monitor: Health checks
    Monitor-->>Script: Pods healthy

    Script->>User: Service restored
    Script->>Ops: Rollback complete

    Ops->>Ops: Create incident report
    Ops->>Alert: Update status page
```

### Rollback Decision Matrix

```mermaid
graph TD
    ISSUE[Issue Detected] --> SEVERITY{Severity<br/>Level?}

    SEVERITY -->|P0 - Critical| AUTO[Auto Rollback<br/>Immediate]
    SEVERITY -->|P1 - High| MANUAL[Manual Decision<br/>30 min SLA]
    SEVERITY -->|P2 - Medium| INVESTIGATE[Investigate First<br/>2 hr SLA]
    SEVERITY -->|P3 - Low| PLAN[Plan Fix<br/>Next Day]

    AUTO --> TYPE{Deployment<br/>Type?}
    MANUAL --> TYPE

    TYPE -->|Blue-Green| BG_ROLLBACK[Switch Service<br/>Selector]
    TYPE -->|Canary| CAN_ROLLBACK[Set Weight 0%<br/>Scale Down]
    TYPE -->|Rolling| ROLL_ROLLBACK[kubectl rollout<br/>undo]

    BG_ROLLBACK --> VERIFY[Verify Health]
    CAN_ROLLBACK --> VERIFY
    ROLL_ROLLBACK --> VERIFY

    VERIFY --> HEALTH{Health<br/>Restored?}

    HEALTH -->|Yes| SUCCESS[Rollback Success]
    HEALTH -->|No| ESCALATE[Escalate to<br/>Senior Engineers]

    SUCCESS --> REPORT[Create Incident<br/>Report]
    ESCALATE --> EMERGENCY[Emergency<br/>Procedures]

    INVESTIGATE --> FIX{Can Fix<br/>Forward?}
    FIX -->|Yes| DEPLOY[Deploy Fix]
    FIX -->|No| TYPE

    style ISSUE fill:#E74C3C,stroke:#922B21,color:#fff
    style AUTO fill:#E74C3C,stroke:#922B21,color:#fff
    style SUCCESS fill:#27AE60,stroke:#1E8449,color:#fff
    style ESCALATE fill:#E67E22,stroke:#A04000,color:#fff
    style EMERGENCY fill:#E74C3C,stroke:#922B21,color:#fff
```

## Infrastructure Components

### Kubernetes Resource Hierarchy

```mermaid
graph TB
    subgraph Cluster["Kubernetes Cluster"]
        subgraph Namespaces["Namespaces"]
            NS_PROD[moodify-production]
            NS_STAGE[moodify-staging]
            NS_MON[monitoring]
        end

        subgraph NS_PROD_Resources["Production Resources"]
            subgraph Workloads["Workloads"]
                DEPLOY_BLUE[Deployment:<br/>backend-blue]
                DEPLOY_GREEN[Deployment:<br/>backend-green]
                DEPLOY_CANARY[Deployment:<br/>backend-canary]
            end

            subgraph Services["Services"]
                SVC_MAIN[Service:<br/>backend-service]
                SVC_BLUE[Service:<br/>backend-blue-service]
                SVC_GREEN[Service:<br/>backend-green-service]
                SVC_CANARY[Service:<br/>backend-canary-service]
            end

            subgraph Config["Configuration"]
                CM[ConfigMap:<br/>moodify-config]
                SECRET[Secret:<br/>moodify-secrets]
            end

            subgraph Scaling["Auto-scaling"]
                HPA_BLUE[HPA:<br/>backend-blue-hpa]
                HPA_GREEN[HPA:<br/>backend-green-hpa]
                HPA_CANARY[HPA:<br/>backend-canary-hpa]
            end

            subgraph Protection["Protection"]
                PDB_BLUE[PDB:<br/>backend-blue-pdb]
                PDB_GREEN[PDB:<br/>backend-green-pdb]
            end
        end

        subgraph Ingress_Resources["Ingress"]
            ING_MAIN[Ingress:<br/>backend-ingress]
            ING_CANARY[Ingress:<br/>backend-ingress-canary]
        end

        subgraph Istio_Resources["Istio (Optional)"]
            VS[VirtualService:<br/>backend-vs]
            DR[DestinationRule:<br/>backend-dr]
            GW[Gateway:<br/>moodify-gateway]
        end
    end

    NS_PROD --> NS_PROD_Resources
    NS_PROD_Resources --> Workloads
    NS_PROD_Resources --> Services
    NS_PROD_Resources --> Config
    NS_PROD_Resources --> Scaling
    NS_PROD_Resources --> Protection

    DEPLOY_BLUE --> SVC_BLUE
    DEPLOY_GREEN --> SVC_GREEN
    DEPLOY_CANARY --> SVC_CANARY

    SVC_BLUE -.-> SVC_MAIN
    SVC_GREEN -.-> SVC_MAIN

    DEPLOY_BLUE --> CM
    DEPLOY_BLUE --> SECRET
    DEPLOY_GREEN --> CM
    DEPLOY_GREEN --> SECRET
    DEPLOY_CANARY --> CM
    DEPLOY_CANARY --> SECRET

    HPA_BLUE -.->|Scales| DEPLOY_BLUE
    HPA_GREEN -.->|Scales| DEPLOY_GREEN
    HPA_CANARY -.->|Scales| DEPLOY_CANARY

    PDB_BLUE -.->|Protects| DEPLOY_BLUE
    PDB_GREEN -.->|Protects| DEPLOY_GREEN

    ING_MAIN --> SVC_MAIN
    ING_CANARY --> SVC_CANARY

    VS --> SVC_MAIN
    VS --> SVC_CANARY
    DR --> VS
    GW --> VS

    style Namespaces fill:#E8E8E8,stroke:#888,color:#000
    style Workloads fill:#4A90E2,stroke:#2E5C8A,color:#fff
    style Services fill:#50C878,stroke:#2E7D4E,color:#fff
    style Config fill:#F39C12,stroke:#9A7D0A,color:#fff
    style Scaling fill:#9B59B6,stroke:#6C3483,color:#fff
    style Protection fill:#E74C3C,stroke:#922B21,color:#fff
```

## Security Architecture

### Multi-Layer Security Model

```mermaid
graph TB
    subgraph External["External Layer"]
        INTERNET[Internet Traffic]
    end

    subgraph WAF["WAF & DDoS Protection"]
        CLOUDFLARE[CloudFlare WAF]
        DDOS[DDoS Protection]
    end

    subgraph TLS["TLS Termination"]
        LB[Load Balancer<br/>TLS 1.3]
        CERT[cert-manager<br/>Let's Encrypt]
    end

    subgraph NetworkSec["Network Security"]
        NP[Network Policies<br/>Pod-to-Pod]
        ISTIO_MTLS[Istio mTLS<br/>Service-to-Service]
    end

    subgraph AppSec["Application Security"]
        subgraph PodSec["Pod Security"]
            NONROOT[Non-root User<br/>UID 1000]
            READONLY[Read-only<br/>Filesystem]
            NOCAP[Capabilities<br/>Dropped]
        end

        subgraph SecContext["Security Context"]
            NOPRIVESC[No Privilege<br/>Escalation]
            SECCOMP[Seccomp Profile]
            APPARMOR[AppArmor Profile]
        end
    end

    subgraph SecretMgmt["Secrets Management"]
        K8S_SECRET[Kubernetes Secrets<br/>Encrypted at Rest]
        VAULT[HashiCorp Vault<br/>Optional]
        CSI[Secrets Store CSI<br/>Cloud Providers]
    end

    subgraph Scanning["Security Scanning"]
        SAST[SAST<br/>SonarQube]
        DEPS[Dependencies<br/>Snyk]
        CONTAINERS[Containers<br/>Trivy]
        SECRETS[Secrets<br/>GitLeaks]
    end

    subgraph Monitoring_Sec["Security Monitoring"]
        AUDIT[Audit Logs<br/>K8s API]
        FALCO[Falco<br/>Runtime Security]
        PROM_SEC[Prometheus<br/>Security Metrics]
    end

    INTERNET --> CLOUDFLARE
    CLOUDFLARE --> DDOS
    DDOS --> LB
    CERT -.->|Issues Certs| LB

    LB --> NP
    NP --> ISTIO_MTLS

    ISTIO_MTLS --> PodSec
    ISTIO_MTLS --> SecContext

    PodSec --> K8S_SECRET
    SecContext --> K8S_SECRET

    K8S_SECRET -.-> VAULT
    K8S_SECRET -.-> CSI

    SAST -.->|Scans| PodSec
    DEPS -.->|Scans| PodSec
    CONTAINERS -.->|Scans| PodSec
    SECRETS -.->|Scans| K8S_SECRET

    AUDIT -.->|Monitors| NP
    FALCO -.->|Monitors| PodSec
    PROM_SEC -.->|Monitors| ISTIO_MTLS

    style External fill:#E74C3C,stroke:#922B21,color:#fff
    style WAF fill:#E67E22,stroke:#A04000,color:#fff
    style TLS fill:#F39C12,stroke:#9A7D0A,color:#fff
    style NetworkSec fill:#3498DB,stroke:#21618C,color:#fff
    style AppSec fill:#9B59B6,stroke:#6C3483,color:#fff
    style SecretMgmt fill:#16A085,stroke:#0E6655,color:#fff
    style Scanning fill:#E74C3C,stroke:#922B21,color:#fff
    style Monitoring_Sec fill:#95A5A6,stroke:#626567,color:#fff
```

### Security Scanning Pipeline

```mermaid
graph LR
    subgraph Code["Code Stage"]
        GIT[Git Commit]
    end

    subgraph PreBuild["Pre-build Scans"]
        GITLEAKS[GitLeaks<br/>Secret Detection]
        SONAR[SonarQube<br/>SAST]
    end

    subgraph BuildTime["Build-time Scans"]
        SNYK_DEP[Snyk<br/>Dependencies]
        SNYK_CODE[Snyk Code<br/>SAST]
    end

    subgraph ImageScans["Image Scans"]
        TRIVY[Trivy<br/>Container Scan]
        CLAIR[Clair<br/>Vulnerability DB]
    end

    subgraph Runtime["Runtime Security"]
        FALCO[Falco<br/>Behavior Monitoring]
        OPA[OPA Gatekeeper<br/>Policy Enforcement]
    end

    subgraph Results["Results"]
        PASS[Security Approved]
        FAIL[Block Deployment]
    end

    GIT --> GITLEAKS
    GIT --> SONAR

    GITLEAKS --> SNYK_DEP
    SONAR --> SNYK_DEP

    SNYK_DEP --> SNYK_CODE
    SNYK_CODE --> TRIVY

    TRIVY --> CLAIR
    CLAIR --> CHECK{All Scans<br/>Passed?}

    CHECK -->|Yes| PASS
    CHECK -->|No| FAIL

    PASS --> DEPLOY[Deploy to Cluster]
    DEPLOY --> FALCO
    DEPLOY --> OPA

    style Code fill:#4A90E2,stroke:#2E5C8A,color:#fff
    style PreBuild fill:#F39C12,stroke:#9A7D0A,color:#fff
    style BuildTime fill:#9B59B6,stroke:#6C3483,color:#fff
    style ImageScans fill:#E67E22,stroke:#A04000,color:#fff
    style Runtime fill:#16A085,stroke:#0E6655,color:#fff
    style PASS fill:#27AE60,stroke:#1E8449,color:#fff
    style FAIL fill:#E74C3C,stroke:#922B21,color:#fff
```

---

**Document Version**: 1.0
**Last Updated**: 2025-11-26
**Maintained by**: DevOps Team

This document provides comprehensive visual documentation of the Moodify deployment architecture using Mermaid diagrams. All diagrams are rendered automatically in Markdown-compatible viewers.
