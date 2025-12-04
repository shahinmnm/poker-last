"""Introduce table templates and link tables to templates.

Revision ID: 021_table_templates
Revises: 020_referrals_promos
Create Date: 2025-03-12 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "021_table_templates"
down_revision = "020_referrals_promos"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()

    table_type_enum = postgresql.ENUM(
        "PERSISTENT",
        "EXPIRING",
        "PRIVATE",
        name="tabletemplatetype",
        create_type=False,
    )
    table_type_enum.create(bind, checkfirst=True)

    op.create_table(
        "table_templates",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("table_type", table_type_enum, nullable=False),
        sa.Column(
            "has_waitlist",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "config_json",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            onupdate=sa.func.now(),
        ),
    )

    op.add_column("tables", sa.Column("template_id", sa.Integer(), nullable=True))
    op.create_index("ix_tables_template_id", "tables", ["template_id"])
    op.create_foreign_key(
        "fk_tables_template_id_table_templates",
        "tables",
        "table_templates",
        ["template_id"],
        ["id"],
        ondelete="RESTRICT",
    )

    results = bind.execute(
        sa.text(
            """
            SELECT
                id,
                config_json,
                min_buy_in,
                is_persistent,
                game_variant,
                currency_type,
                is_public
            FROM tables
            """
        )
    ).mappings()

    for row in results:
        config_value = row["config_json"]
        template_config = dict(config_value) if isinstance(config_value, dict) else {}

        if row["min_buy_in"] is not None:
            template_config.setdefault("buy_in_min", int(row["min_buy_in"]))

        if row["game_variant"]:
            variant_value = (
                row["game_variant"].value
                if hasattr(row["game_variant"], "value")
                else row["game_variant"]
            )
            template_config.setdefault("game_variant", variant_value)

        if row["currency_type"]:
            currency_value = (
                row["currency_type"].value
                if hasattr(row["currency_type"], "value")
                else row["currency_type"]
            )
            template_config.setdefault("currency_type", currency_value)

        raw_has_waitlist = template_config.get("has_waitlist", False)
        if isinstance(raw_has_waitlist, str):
            has_waitlist = raw_has_waitlist.strip().lower() in {"true", "1", "yes", "y"}
        else:
            has_waitlist = bool(raw_has_waitlist)

        is_public = row["is_public"]
        is_persistent = row["is_persistent"]
        table_type_value = (
            "PRIVATE" if is_public is False else ("PERSISTENT" if is_persistent else "EXPIRING")
        )

        template_name = template_config.get("name") or f"Migrated Table {row['id']}"

        template_id = bind.execute(
            sa.text(
                """
                INSERT INTO table_templates (name, table_type, has_waitlist, config_json)
                VALUES (:name, :table_type, :has_waitlist, :config_json)
                RETURNING id
                """
            ),
            {
                "name": template_name,
                "table_type": table_type_value,
                "has_waitlist": has_waitlist,
                "config_json": template_config,
            },
        ).scalar_one()

        bind.execute(
            sa.text(
                """
                UPDATE tables
                SET template_id = :template_id
                WHERE id = :table_id
                """
            ),
            {"template_id": template_id, "table_id": row["id"]},
        )

    op.alter_column(
        "tables",
        "template_id",
        existing_type=sa.Integer(),
        nullable=False,
    )

    op.drop_column("tables", "currency_type")
    op.drop_column("tables", "game_variant")
    op.drop_column("tables", "is_persistent")
    op.drop_column("tables", "min_buy_in")
    op.drop_column("tables", "config_json")

    sa.Enum(name="gamevariant").drop(bind, checkfirst=True)


def downgrade() -> None:
    bind = op.get_bind()

    gamevariant_enum = sa.Enum(
        "no_limit_texas_holdem",
        "no_limit_short_deck_holdem",
        name="gamevariant",
    )
    gamevariant_enum.create(bind, checkfirst=True)

    op.add_column(
        "tables",
        sa.Column(
            "config_json",
            postgresql.JSONB(),
            nullable=True,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )
    op.add_column(
        "tables",
        sa.Column(
            "min_buy_in",
            sa.BigInteger(),
            nullable=False,
            server_default=sa.text("0"),
        ),
    )
    op.add_column(
        "tables",
        sa.Column(
            "is_persistent",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.add_column(
        "tables",
        sa.Column(
            "game_variant",
            gamevariant_enum,
            nullable=False,
            server_default="no_limit_texas_holdem",
        ),
    )
    op.add_column(
        "tables",
        sa.Column(
            "currency_type",
            sa.Enum(
                "REAL",
                "PLAY",
                name="currencytype",
                create_type=False,
            ),
            nullable=False,
            server_default="REAL",
        ),
    )

    bind.execute(
        sa.text(
            """
            UPDATE tables t
            SET
                config_json = COALESCE(tt.config_json, '{}'::jsonb),
                min_buy_in = COALESCE((tt.config_json ->> 'buy_in_min')::bigint, 0),
                is_persistent = CASE WHEN tt.table_type = 'PERSISTENT' THEN true ELSE false END,
                game_variant = COALESCE(tt.config_json ->> 'game_variant', 'no_limit_texas_holdem'),
                currency_type = COALESCE(tt.config_json ->> 'currency_type', 'REAL')
            FROM table_templates tt
            WHERE t.template_id = tt.id
            """
        )
    )

    op.drop_constraint(
        "fk_tables_template_id_table_templates",
        "tables",
        type_="foreignkey",
    )
    op.drop_index("ix_tables_template_id", table_name="tables")
    op.drop_column("tables", "template_id")

    op.drop_table("table_templates")
    op.execute("DROP TYPE IF EXISTS tabletemplatetype")
