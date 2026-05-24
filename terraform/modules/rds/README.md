# `terraform/modules/rds`

Managed Postgres on AWS RDS — KMS-encrypted, Multi-AZ-capable, with
Performance Insights, Enhanced Monitoring, and a low-storage
CloudWatch alarm wired to SNS.

## Usage

```hcl
module "rds" {
  source              = "../../modules/rds"
  project_name        = "moodify"
  environment         = "production"
  vpc_id              = module.vpc.vpc_id
  subnet_ids          = module.vpc.database_subnet_ids
  allowed_security_group_ids = [module.eks.node_security_group_id]

  instance_class      = "db.m5.large"
  multi_az            = true
  storage_gb          = 200
  backup_retention_d  = 30
  deletion_protection = true

  alarm_sns_topic_arns = [module.monitoring.alarm_topic_arn]
}
```

## Outputs

| Output             | Purpose                                                     |
| ------------------ | ----------------------------------------------------------- |
| `endpoint`         | `host:port` connection string                               |
| `address`          | hostname only                                               |
| `port`             | `5432`                                                      |
| `db_name`          | database name (default `moodify`)                           |
| `secret_arn`       | Secrets Manager ARN — `external-secrets` reads this in K8s   |
| `security_group_id`| SG ID — add as `allowed_security_group_ids` to app modules   |
| `kms_key_arn`      | KMS key ARN for backups / snapshots                          |

## Notes

* The module generates a 32-char master password with random_password
  and stores it in Secrets Manager (KMS-encrypted with the same key as
  the DB). Rotate via Secrets Manager rotation or your IdP of choice;
  `lifecycle.ignore_changes = [password]` keeps Terraform from
  re-rolling it on drift.
* Parameter group enables `pg_stat_statements` and logs slow queries
  > 500 ms. Tune `log_min_duration_statement` per env.
* Backups: 7d default, 30d in prod (per env's `backup_retention_d`).
  Final snapshot is taken automatically when `deletion_protection`
  is true.
* `apply_immediately = false` → most parameter changes wait for the
  next maintenance window. Override only in dev.
