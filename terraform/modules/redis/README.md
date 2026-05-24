# `terraform/modules/redis`

ElastiCache Redis replication group with TLS in-transit, AUTH token,
KMS-encrypted at-rest, automatic failover, snapshots, CloudWatch
slow + engine logs and a memory-pressure alarm.

## Usage

```hcl
module "redis" {
  source       = "../../modules/redis"
  project_name = "moodify"
  environment  = "production"
  vpc_id       = module.vpc.vpc_id
  subnet_ids   = module.vpc.private_subnet_ids
  allowed_security_group_ids = [module.eks.node_security_group_id]

  node_type                  = "cache.m5.large"
  num_cache_nodes            = 3
  automatic_failover_enabled = true
  snapshot_retention_d       = 14
  alarm_sns_topic_arns       = [module.monitoring.alarm_topic_arn]
}
```

## Notes

* `transit_encryption_enabled = true` forces clients to speak TLS to
  Redis. Application code must use `rediss://` (note the double `s`).
* AUTH token is 64 alphanumeric chars (ElastiCache disallows special
  characters in tokens).
* `maxmemory-policy = allkeys-lru` so the cache stays under quota on
  burst traffic.
* Snapshots run nightly in the 03:00 UTC window; maintenance window
  Sunday 05:00 UTC.
