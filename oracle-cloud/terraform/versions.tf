terraform {
  required_version = ">= 1.5.0"

  required_providers {
    oci = {
      source  = "oracle/oci"
      version = "~> 5.30"
    }
  }

  backend "s3" {
    bucket                      = "moodify-terraform-state"
    key                         = "production/oci/terraform.tfstate"
    region                      = "us-ashburn-1"
    endpoint                    = "https://<namespace>.compat.objectstorage.<region>.oraclecloud.com"
    skip_region_validation      = true
    skip_credentials_validation = true
    skip_metadata_api_check     = true
    force_path_style            = true
  }
}
