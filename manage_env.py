#!/usr/bin/env python3
"""Environment management script for the Occupancy ML API."""

import os
import sys
import argparse
from pathlib import Path
from typing import Dict, Any

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent / "src"))

from occupancy_ml.config import get_all_config, validate_config


def show_config():
    """Display current configuration."""
    config = get_all_config()
    
    print("🔧 Current Configuration:")
    print("=" * 50)
    
    for section, settings in config.items():
        print(f"\n📋 {section.upper()}:")
        for key, value in settings.items():
            if key == "api_key" and value:
                print(f"  {key}: {'*' * len(str(value))}")
            else:
                print(f"  {key}: {value}")


def validate_environment():
    """Validate current environment configuration."""
    print("🔍 Validating Environment Configuration...")
    print("=" * 50)
    
    issues = validate_config()
    
    if not issues:
        print("✅ All configuration is valid!")
        return True
    else:
        print("❌ Configuration issues found:")
        for issue in issues:
            print(f"  • {issue}")
        return False


def show_env_vars():
    """Show all relevant environment variables."""
    print("🌍 Environment Variables:")
    print("=" * 50)
    
    env_vars = [
        "OCC_MODEL_DIR",
        "MODEL_VALIDATION_ENABLED",
        "MODEL_RELOAD_ON_ERROR",
        "KAFKA_BOOTSTRAP_SERVERS",
        "KAFKA_TOPIC",
        "KAFKA_GROUP_ID",
        "API_HOST",
        "API_PORT",
        "LOG_LEVEL",
        "MAX_PREDICTION_BATCH_SIZE",
        "PREDICTION_TIMEOUT_SECONDS",
        "DEBUG",
        "ENABLE_CORS",
        "ENABLE_METRICS",
        "METRICS_PORT",
        "API_KEY",
        "ENABLE_RATE_LIMITING",
        "RATE_LIMIT_PER_MINUTE"
    ]
    
    for var in env_vars:
        value = os.environ.get(var, "Not set")
        if var == "API_KEY" and value != "Not set":
            value = "*" * len(value)
        print(f"  {var}: {value}")


def create_env_file(env_type: str = "development"):
    """Create environment file from template."""
    template_files = {
        "development": "env.development",
        "production": "env.production",
        "docker": "env.docker"
    }
    
    if env_type not in template_files:
        print(f"❌ Unknown environment type: {env_type}")
        print(f"Available types: {', '.join(template_files.keys())}")
        return False
    
    template_file = Path(template_files[env_type])
    target_file = Path(".env")
    
    if not template_file.exists():
        print(f"❌ Template file not found: {template_file}")
        return False
    
    if target_file.exists():
        print(f"⚠️  .env file already exists. Backing up to .env.backup")
        target_file.rename(".env.backup")
    
    # Copy template to .env
    with open(template_file, 'r') as src, open(target_file, 'w') as dst:
        dst.write(src.read())
    
    print(f"✅ Created .env file from {template_file}")
    print(f"📝 Edit .env file to customize your settings")
    
    return True


def main():
    """Main CLI interface."""
    parser = argparse.ArgumentParser(
        description="Environment management for Occupancy ML API",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python manage_env.py config          # Show current configuration
  python manage_env.py validate       # Validate configuration
  python manage_env.py env-vars       # Show environment variables
  python manage_env.py create dev     # Create development .env file
  python manage_env.py create prod    # Create production .env file
        """
    )
    
    parser.add_argument(
        "command",
        choices=["config", "validate", "env-vars", "create"],
        help="Command to execute"
    )
    
    parser.add_argument(
        "env_type",
        nargs="?",
        choices=["development", "production", "docker"],
        help="Environment type for create command"
    )
    
    args = parser.parse_args()
    
    if args.command == "config":
        show_config()
    elif args.command == "validate":
        validate_environment()
    elif args.command == "env-vars":
        show_env_vars()
    elif args.command == "create":
        if not args.env_type:
            print("❌ Environment type required for create command")
            print("Available types: development, production, docker")
            sys.exit(1)
        create_env_file(args.env_type)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
