bucket         = "moodify-terraform-state"
key            = "dev/terraform.tfstate"
region         = "us-east-1"
encrypt        = true
dynamodb_table = "moodify-terraform-locks"
