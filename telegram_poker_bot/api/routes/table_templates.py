"""Template CRUD API routes with UI schema validation."""

from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from telegram_poker_bot.shared.database import get_db
from telegram_poker_bot.shared.models import TableTemplate, TableTemplateType
from telegram_poker_bot.shared.types import (
    TableTemplateCreateRequest,
    TableTemplateUpdateRequest,
    TableTemplateResponse,
)
from telegram_poker_bot.shared.services import table_service
from telegram_poker_bot.shared.services.jwt_auth_service import (
    get_jwt_auth_service,
    JWTAuthService,
    TokenPayload,
)

router = APIRouter()
security = HTTPBearer(auto_error=False)


async def require_superadmin(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    jwt_service: JWTAuthService = Depends(get_jwt_auth_service),
) -> TokenPayload:
    """Require a superadmin access token with is_admin flag."""

    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing credentials")

    payload = jwt_service.verify_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    roles = set(payload.roles or [])
    if payload.role:
        roles.add(payload.role)

    if payload.token_type != "access" or "superadmin" not in roles or getattr(payload, "is_admin", False) is not True:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Superadmin access required",
        )
    return payload


def _serialize_template(template: TableTemplate) -> TableTemplateResponse:
    config_json = dict(template.config_json or {})
    try:
        config_json = table_service.validate_template_config(config_json)
    except ValueError:
        config_json = {
            "backend": config_json if isinstance(config_json, dict) else {},
            "ui_schema": table_service.DEFAULT_UI_SCHEMA,
        }

    return TableTemplateResponse(
        id=template.id,
        name=template.name,
        table_type=template.table_type,
        has_waitlist=getattr(template, "has_waitlist", False),
        is_active=getattr(template, "is_active", True),
        config_json=config_json,
        created_at=template.created_at.isoformat() if getattr(template, "created_at", None) else None,
        updated_at=template.updated_at.isoformat() if getattr(template, "updated_at", None) else None,
    )


@router.get("/table-templates")
async def list_table_templates(
    table_type: Optional[TableTemplateType] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _: TokenPayload = Depends(require_superadmin),
):
    """List table templates with pagination."""

    templates, total = await table_service.list_table_templates(
        db,
        table_type=table_type,
        variant=None,
        has_waitlist=None,
        page=page,
        per_page=per_page,
    )
    return {
        "templates": [_serialize_template(t) for t in templates],
        "page": page,
        "per_page": per_page,
        "total": total,
    }


@router.get("/table-templates/{template_id}")
async def get_table_template(
    template_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: TokenPayload = Depends(require_superadmin),
) -> TableTemplateResponse:
    template = await db.get(TableTemplate, template_id)
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    return _serialize_template(template)


@router.post("/table-templates", status_code=status.HTTP_201_CREATED)
async def create_table_template(
    payload: TableTemplateCreateRequest,
    db: AsyncSession = Depends(get_db),
    _: TokenPayload = Depends(require_superadmin),
) -> TableTemplateResponse:
    try:
        template = await table_service.create_table_template(db, payload=payload)
        await db.commit()
    except ValueError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return _serialize_template(template)


@router.put("/table-templates/{template_id}")
async def update_table_template(
    template_id: UUID,
    payload: TableTemplateUpdateRequest,
    db: AsyncSession = Depends(get_db),
    _: TokenPayload = Depends(require_superadmin),
) -> TableTemplateResponse:
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
    template_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: TokenPayload = Depends(require_superadmin),
) -> Response:
    try:
        await table_service.delete_table_template(db, template_id)
        await db.commit()
    except ValueError as exc:
        await db.rollback()
        message = str(exc)
        status_code = status.HTTP_404_NOT_FOUND if "not found" in message else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=status_code, detail=message) from exc

    return Response(status_code=status.HTTP_204_NO_CONTENT)
