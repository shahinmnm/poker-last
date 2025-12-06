"""Canonicalize auto_create configs to enforce canonical schema.

This migration removes invalid fields from auto_create configs and ensures
all required fields have proper defaults.

Canonical auto_create schema:
- enabled: boolean (required)
- min_tables: int (required)
- max_tables: int (required)
- on_startup_repair: boolean (required)
- allow_missing_runtime: boolean (required)

Invalid fields to remove:
- lobby_persistent (belongs in tables.lobby_persistent column)
- is_auto_generated (belongs in tables.is_auto_generated column)

Revision ID: 029_canonicalize_auto_create
Revises: 028_table_auto_gen_fields
Create Date: 2025-12-06
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


# revision identifiers, used by Alembic.
revision = "029_canonicalize_auto_create"
down_revision = "028_table_auto_gen_fields"
branch_labels = None
depends_on = None


def canonicalize_auto_create_dict(auto_create):
    """Canonicalize an auto_create config dictionary."""
    if not isinstance(auto_create, dict):
        return auto_create
    
    # Define canonical fields
    canonical_fields = {"enabled", "min_tables", "max_tables", "on_startup_repair", "allow_missing_runtime"}
    
    # Create new auto_create with only canonical fields
    new_auto_create = {
        k: v for k, v in auto_create.items() 
        if k in canonical_fields
    }
    
    # Insert defaults for missing required fields
    if "enabled" not in new_auto_create:
        new_auto_create["enabled"] = False
    if "min_tables" not in new_auto_create and new_auto_create.get("enabled"):
        new_auto_create["min_tables"] = 1
    if "max_tables" not in new_auto_create and new_auto_create.get("enabled"):
        new_auto_create["max_tables"] = 2
    if "on_startup_repair" not in new_auto_create:
        new_auto_create["on_startup_repair"] = True
    if "allow_missing_runtime" not in new_auto_create:
        new_auto_create["allow_missing_runtime"] = True
    
    return new_auto_create


def upgrade() -> None:
    """Canonicalize auto_create configs in all table templates."""
    connection = op.get_bind()
    
    # Fetch all templates with auto_create configs
    # Use text() for raw SQL to be database-agnostic
    result = connection.execute(
        sa.text("SELECT id, config_json FROM table_templates WHERE CAST(config_json AS text) LIKE '%auto_create%'")
    )
    
    templates_updated = 0
    
    for row in result:
        template_id = row[0]
        config_json = row[1]
        
        if not isinstance(config_json, dict):
            continue
        
        if "auto_create" not in config_json:
            continue
        
        # Canonicalize the auto_create block
        old_auto_create = config_json["auto_create"]
        new_auto_create = canonicalize_auto_create_dict(old_auto_create)
        
        # Only update if something changed
        if old_auto_create != new_auto_create:
            config_json["auto_create"] = new_auto_create
            
            # Update the template using parameter binding
            import json
            connection.execute(
                sa.text("UPDATE table_templates SET config_json = CAST(:config AS jsonb) WHERE id = :id"),
                {"config": json.dumps(config_json), "id": template_id}
            )
            templates_updated += 1
    
    print(f"Canonicalized auto_create configs for {templates_updated} template(s)")


def downgrade() -> None:
    """No downgrade - canonicalization is a cleanup operation."""
    # We cannot restore the old invalid fields as we don't know what they were
    pass
