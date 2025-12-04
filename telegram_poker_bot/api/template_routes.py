"""Template CRUD API routes."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status, Response
from sqlalchemy.ext.asyncio import AsyncSession

from telegram_poker_bot.shared.database import get_db
from telegram_poker_bot.shared.models import TableTemplate, TableTemplateType
from telegram_poker_bot.shared.types import (
    TableTemplateCreateRequest,
    TableTemplateUpdateRequest,
    TableTemplateResponse,
)
from telegram_poker_bot.shared.services import table_service
from telegram_poker_bot.shared.services.rbac_middleware import require_admin


router = APIRouter()


def _serialize_template(template: TableTemplate) -> TableTemplateResponse:
    return TableTemplateResponse(
        id=template.id,
        name=template.name,
        table_type=template.table_type,
        has_waitlist=template.has_waitlist,
        config=template.config_json or {},
        created_at=template.created_at.isoformat() if getattr(template, "created_at", None) else None,
        updated_at=template.updated_at.isoformat() if getattr(template, "updated_at", None) else None,
    )


@router.get("/table-templates")
async def list_table_templates(
    table_type: Optional[TableTemplateType] = Query(None),
    variant: Optional[str] = Query(None),
    has_waitlist: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """List table templates with optional filtering and pagination."""

    templates, total = await table_service.list_table_templates(
        db,
        table_type=table_type,
        variant=variant,
        has_waitlist=has_waitlist,
        page=page,
        per_page=per_page,
    )
    return {
        "templates": [_serialize_template(t) for t in templates],
        "page": page,
        "per_page": per_page,
        "total": total,
    }


@router.post(
    "/table-templates",
    status_code=status.HTTP_201_CREATED,
)
async def create_table_template(
    payload: TableTemplateCreateRequest,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_admin),
):
    """Create a new table template (admin only)."""

    try:
        template = await table_service.create_table_template(db, payload=payload)
        await db.commit()
    except ValueError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return _serialize_template(template)


@router.put("/table-templates/{template_id}")
async def update_table_template(
    template_id: int,
    payload: TableTemplateUpdateRequest,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_admin),
):
    """Update an existing table template (admin only)."""

    try:
        template = await table_service.update_table_template(db, template_id, payload)
        await db.commit()
    except ValueError as exc:
        await db.rollback()
        message = str(exc)
        status_code = status.HTTP_404_NOT_FOUND if "not found" in message else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=status_code, detail=message) from exc

    return _serialize_template(template)


@router.delete("/table-templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_table_template(
    template_id: int,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_admin),
):
    """Delete a table template (admin only)."""

    try:
        await table_service.delete_table_template(db, template_id)
        await db.commit()
    except ValueError as exc:
        await db.rollback()
        message = str(exc)
        if "not found" in message:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=message) from exc
        if "existing tables" in message or "depend" in message:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=message) from exc
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message) from exc

    return Response(status_code=status.HTTP_204_NO_CONTENT)
