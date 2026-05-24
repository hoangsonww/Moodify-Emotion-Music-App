# `terraform/modules/vpc`

3-AZ AWS VPC with three subnet tiers (public, private, database), a
NAT gateway per AZ, an IGW, default-deny NACLs, VPC flow logs to
CloudWatch, and the right tags so the EKS module's load balancer
controller can place ALBs/NLBs automatically.

## Subnets

| Tier      | CIDR pattern | Purpose                                  |
| --------- | ------------ | ---------------------------------------- |
| Public    | `/24`         | NAT GWs + public ALBs (internet-facing) |
| Private   | `/22`         | EKS nodes + internal ALBs                |
| Database  | `/24`         | RDS / ElastiCache (no internet route)    |

## Usage

```hcl
module "vpc" {
  source       = "../../modules/vpc"
  project_name = "moodify"
  environment  = "production"
  cidr_block   = "10.0.0.0/16"
  azs          = ["us-east-1a", "us-east-1b", "us-east-1c"]
}
```

## Outputs

| Output                   | Purpose                                    |
| ------------------------ | ------------------------------------------ |
| `vpc_id`                 | EKS / RDS / Redis ingress                  |
| `private_subnet_ids`     | EKS node group placement                   |
| `public_subnet_ids`      | Internet-facing ALBs                       |
| `database_subnet_ids`    | RDS DB subnet group                        |
| `default_security_group_id` | Strip / harden separately                |

## Notes

* NAT gateway per AZ — pricey but survives AZ failures cleanly. Switch
  to a single NAT in dev (`single_nat = true`) to cut cost ~3×.
* VPC flow logs ship to CloudWatch with 30 day retention; rotate to
  S3 + Athena if you need longer-term forensics.
* `enable_dns_hostnames` + `enable_dns_support` both true so private
  service discovery works.
