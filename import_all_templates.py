#!/usr/bin/env python3
"""
Universal JSON Template Importer Script

This script automatically finds, parses, and uploads poker table template
definitions from local JSON files to a remote API endpoint.

Usage:
    python3 import_all_templates.py

Requirements:
    - Python 3.6+
    - requests library
    - PyJWT library
    - python-dotenv library
    - templates/ directory in the same location as this script
    - .env file with JWT_SECRET_KEY
"""

import json
import os
import sys
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List

try:
    import requests
except ImportError:
    print("❌ Error: 'requests' library is required but not installed.")
    print("Please install it with: pip install requests")
    sys.exit(1)

try:
    import jwt
except ImportError:
    print("❌ Error: 'PyJWT' library is required but not installed.")
    print("Please install it with: pip install PyJWT")
    sys.exit(1)

try:
    from dotenv import load_dotenv
except ImportError:
    print("❌ Error: 'python-dotenv' library is required but not installed.")
    print("Please install it with: pip install python-dotenv")
    sys.exit(1)


# Load environment variables from .env file
script_dir = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(script_dir, '.env')
load_dotenv(dotenv_path=env_path)

# Configuration
API_ENDPOINT = os.getenv(
    "POKER_API_ENDPOINT",
    "https://poker.shahin8n.sbs/api/table-templates"
)
TEMPLATES_DIR = "templates"

# JWT Configuration - must be loaded from environment
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
if not JWT_SECRET_KEY or JWT_SECRET_KEY.strip() == "":
    print("❌ Error: JWT_SECRET_KEY is not set in the .env file.")
    print("Please ensure your .env file contains a valid JWT_SECRET_KEY.")
    print("Example: JWT_SECRET_KEY=your_secret_key_here")
    sys.exit(1)

# Never print the secret key for security
JWT_ALGORITHM = "HS256"


def generate_admin_jwt() -> str:
    """
    Generate a JWT token for admin authentication.
    
    Returns:
        JWT token string with admin claims
    """
    now = datetime.now(timezone.utc)
    # Token expires in 24 hours (per requirements specification)
    expire = now + timedelta(hours=24)
    
    payload = {
        "sub": "admin-script",
        "token_type": "access",
        "role": "superadmin",
        "roles": ["superadmin"],
        "is_admin": True,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }
    
    token = jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return token


def scan_json_files(directory: str) -> List[str]:
    """
    Scan the templates directory for JSON files.

    Args:
        directory: Path to the templates directory

    Returns:
        List of JSON file paths
    """
    if not os.path.exists(directory):
        print(f"❌ Error: Templates directory '{directory}' not found.")
        print("Please create the directory in the same location as this script.")
        sys.exit(1)

    if not os.path.isdir(directory):
        print(f"❌ Error: '{directory}' is not a directory.")
        sys.exit(1)

    json_files = []
    for filename in os.listdir(directory):
        if filename.endswith('.json'):
            filepath = os.path.join(directory, filename)
            json_files.append(filepath)

    return json_files


def parse_json_file(filepath: str) -> List[Dict[str, Any]]:
    """
    Parse a JSON file and extract template objects.

    Handles both single objects and arrays of objects.

    Args:
        filepath: Path to the JSON file

    Returns:
        List of template objects
    """
    templates = []

    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)

        # Handle both single object and array of objects
        if isinstance(data, list):
            templates.extend(data)
        elif isinstance(data, dict):
            templates.append(data)
        else:
            print(f"⚠️  Warning: Unexpected JSON format in {os.path.basename(filepath)}")

    except json.JSONDecodeError as e:
        print(f"❌ Error parsing {os.path.basename(filepath)}: {e}")
    except Exception as e:
        print(f"❌ Error reading {os.path.basename(filepath)}: {e}")

    return templates


def normalize_template(template: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normalize legacy template structure into API payload format.
    
    Transforms legacy structures into canonical format:
    - Maps backend.template_name -> name
    - Maps backend.game_type -> table_type (cash -> CASH_GAME, tournament -> TOURNAMENT)
    - Ensures backend, ui_schema, and auto_create blocks exist
    """
    backend = template.get("backend", {})
    ui_schema = template.get("ui_schema") or template.get("ui") or {}

    # Extract name from backend.template_name or top-level name
    name = backend.get("template_name") or template.get("name") or "Unknown"
    
    # Map game_type to table_type
    raw_game_type = (backend.get("game_type") or "").lower()
    if raw_game_type == "cash":
        table_type = "CASH_GAME"
    elif raw_game_type == "tournament":
        table_type = "TOURNAMENT"
    elif raw_game_type:
        table_type = raw_game_type.upper()
    else:
        table_type = "CASH_GAME"  # Default

    # Build canonical config_json structure
    config_json = {
        "backend": backend,
        "ui_schema": ui_schema,
        "auto_create": {
            "min_tables": 1,
            "max_tables": 2,
            "lobby_persistent": True,
            "is_auto_generated": True,
        },
    }

    return {
        "name": name,
        "table_type": table_type,
        "config_json": config_json,
    }


def upload_template(template: Dict[str, Any], index: int, total: int, admin_token: str) -> bool:
    """
    Upload a single template to the API endpoint.

    Args:
        template: Template object to upload
        index: Current template index (1-based)
        total: Total number of templates
        admin_token: JWT token for authentication

    Returns:
        True if successful, False otherwise
    """
    normalized = normalize_template(template)
    template_name = normalized.get('name', 'Unknown')

    print(f"[{index}/{total}] Importing: {template_name}")

    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {admin_token}'
    }

    try:
        response = requests.post(
            API_ENDPOINT,
            json=normalized,
            headers=headers,
            timeout=30
        )

        # Check for success status codes
        if response.status_code in (200, 201):
            print("   ✅ Success")
            return True
        else:
            # Show detailed error message
            try:
                error_detail = response.text
            except Exception:
                error_detail = "No error details available"

            print(f"   ❌ Error {response.status_code}: {error_detail}")
            return False

    except requests.exceptions.RequestException as e:
        print(f"   ❌ Request failed: {e}")
        return False


def main():
    """Main execution function."""
    print("🚀 Starting Template Import Process\n")

    # Generate admin JWT token for authentication
    try:
        admin_token = generate_admin_jwt()
    except Exception as e:
        print(f"❌ Error generating JWT token: {e}")
        sys.exit(1)

    # Get the directory where the script is located
    script_dir = os.path.dirname(os.path.abspath(__file__))
    templates_path = os.path.join(script_dir, TEMPLATES_DIR)

    # Scan for JSON files
    json_files = scan_json_files(templates_path)

    if not json_files:
        print(f"⚠️  No JSON files found in '{TEMPLATES_DIR}' directory.")
        sys.exit(0)

    # Parse all JSON files and collect templates
    all_templates = []
    for filepath in sorted(json_files):
        filename = os.path.basename(filepath)
        print(f"📄 Reading file: {filename}")
        templates = parse_json_file(filepath)
        all_templates.extend(templates)

    print(f"\nLoaded total templates: {len(all_templates)}\n")

    if not all_templates:
        print("⚠️  No valid templates found to import.")
        sys.exit(0)

    # Upload each template
    success_count = 0
    failed_count = 0

    for index, template in enumerate(all_templates, start=1):
        if upload_template(template, index, len(all_templates), admin_token):
            success_count += 1
        else:
            failed_count += 1

    # Print summary report
    print("\n" + "-" * 32)
    print("Import completed.")
    print(f"Success: {success_count}")
    print(f"Failed:  {failed_count}")
    print("-" * 32)


if __name__ == "__main__":
    main()
