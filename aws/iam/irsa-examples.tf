# =============================================================================
# IRSA examples — least-privilege IAM roles bound to Kubernetes ServiceAccounts
# =============================================================================
# Drop these into aws/terraform/ (or include via a `module "irsa"` block) once
# the EKS cluster is up. Each role trusts the cluster's OIDC issuer + a single
# ServiceAccount.
# =============================================================================

variable "cluster_oidc_provider_arn" {
  description = "From terraform/modules/eks outputs.oidc_provider_arn"
  type        = string
}

variable "cluster_oidc_issuer_url" {
  description = "From terraform/modules/eks outputs.oidc_issuer_url"
  type        = string
}

locals {
  oidc_subject = replace(var.cluster_oidc_issuer_url, "https://", "")
}

# --- 1. external-secrets-operator -------------------------------------------
data "aws_iam_policy_document" "external_secrets_assume" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    effect  = "Allow"
    principals {
      type        = "Federated"
      identifiers = [var.cluster_oidc_provider_arn]
    }
    condition {
      test     = "StringEquals"
      variable = "${local.oidc_subject}:sub"
      values   = ["system:serviceaccount:moodify:external-secrets-sa"]
    }
    condition {
      test     = "StringEquals"
      variable = "${local.oidc_subject}:aud"
      values   = ["sts.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "external_secrets" {
  name               = "${var.project_name}-${var.environment}-external-secrets"
  assume_role_policy = data.aws_iam_policy_document.external_secrets_assume.json
}

data "aws_iam_policy_document" "external_secrets_policy" {
  statement {
    actions = [
      "secretsmanager:GetSecretValue",
      "secretsmanager:DescribeSecret",
      "secretsmanager:ListSecrets",
    ]
    resources = [
      "arn:aws:secretsmanager:${var.aws_region}:*:secret:moodify/*",
    ]
  }
}

resource "aws_iam_policy" "external_secrets" {
  name   = "${var.project_name}-${var.environment}-external-secrets"
  policy = data.aws_iam_policy_document.external_secrets_policy.json
}

resource "aws_iam_role_policy_attachment" "external_secrets" {
  role       = aws_iam_role.external_secrets.name
  policy_arn = aws_iam_policy.external_secrets.arn
}

output "external_secrets_role_arn" {
  description = "Annotate the SA: eks.amazonaws.com/role-arn=<this>"
  value       = aws_iam_role.external_secrets.arn
}

# --- 2. moodify-backend (S3 + Secrets read) ---------------------------------
data "aws_iam_policy_document" "backend_assume" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    effect  = "Allow"
    principals {
      type        = "Federated"
      identifiers = [var.cluster_oidc_provider_arn]
    }
    condition {
      test     = "StringEquals"
      variable = "${local.oidc_subject}:sub"
      values   = ["system:serviceaccount:moodify:moodify-backend-sa"]
    }
  }
}

resource "aws_iam_role" "backend" {
  name               = "${var.project_name}-${var.environment}-backend"
  assume_role_policy = data.aws_iam_policy_document.backend_assume.json
}

data "aws_iam_policy_document" "backend_policy" {
  statement {
    actions   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
    resources = ["arn:aws:s3:::${var.project_name}-${var.environment}-app/*"]
  }
  statement {
    actions   = ["s3:ListBucket"]
    resources = ["arn:aws:s3:::${var.project_name}-${var.environment}-app"]
  }
  statement {
    actions   = ["sqs:SendMessage", "sqs:ReceiveMessage", "sqs:DeleteMessage"]
    resources = ["arn:aws:sqs:${var.aws_region}:*:${var.project_name}-${var.environment}-*"]
  }
}

resource "aws_iam_policy" "backend" {
  name   = "${var.project_name}-${var.environment}-backend"
  policy = data.aws_iam_policy_document.backend_policy.json
}

resource "aws_iam_role_policy_attachment" "backend" {
  role       = aws_iam_role.backend.name
  policy_arn = aws_iam_policy.backend.arn
}

output "backend_role_arn" {
  description = "Annotate moodify-backend-sa with this ARN"
  value       = aws_iam_role.backend.arn
}

# --- 3. cluster-autoscaler ---------------------------------------------------
data "aws_iam_policy_document" "ca_assume" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    effect  = "Allow"
    principals {
      type        = "Federated"
      identifiers = [var.cluster_oidc_provider_arn]
    }
    condition {
      test     = "StringEquals"
      variable = "${local.oidc_subject}:sub"
      values   = ["system:serviceaccount:kube-system:cluster-autoscaler"]
    }
  }
}

resource "aws_iam_role" "cluster_autoscaler" {
  name               = "${var.project_name}-${var.environment}-cluster-autoscaler"
  assume_role_policy = data.aws_iam_policy_document.ca_assume.json
}

resource "aws_iam_role_policy" "cluster_autoscaler" {
  name = "${var.project_name}-${var.environment}-cluster-autoscaler"
  role = aws_iam_role.cluster_autoscaler.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "autoscaling:DescribeAutoScalingGroups",
        "autoscaling:DescribeAutoScalingInstances",
        "autoscaling:DescribeLaunchConfigurations",
        "autoscaling:DescribeTags",
        "autoscaling:SetDesiredCapacity",
        "autoscaling:TerminateInstanceInAutoScalingGroup",
        "ec2:DescribeLaunchTemplateVersions",
        "ec2:DescribeInstanceTypes",
        "ec2:DescribeImages",
        "eks:DescribeNodegroup",
      ]
      Resource = "*"
    }]
  })
}

output "cluster_autoscaler_role_arn" {
  value = aws_iam_role.cluster_autoscaler.arn
}

# --- Shared inputs -----------------------------------------------------------
variable "project_name" {
  type    = string
  default = "moodify"
}

variable "environment" {
  type = string
}

variable "aws_region" {
  type = string
}
