from __future__ import annotations

import os
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from starlette.background import BackgroundTask
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_gcs_signed_url_ttl_seconds
from app.core.auth import get_actor, require_actor_user
from app.core.tenant import assert_path_matches_tenant, require_tenant_context
from app.db.models import EvidenceItem, Organisation
from app.db.session import get_db
from app.schemas.evidence import (
    EvidenceCreate,
    EvidenceDownloadUrlOut,
    EvidenceOut,
)
from app.services.audit import emit_audit_event
from app.services.evidence_storage import (
    EvidenceStorageCollision,
    EvidenceStorageError,
    LocalEvidenceStorage,
    generate_gcs_signed_url,
    get_evidence_storage,
)

router = APIRouter(tags=["evidence"])


@router.post(
    "/organisations/{organisation_id}/evidence", response_model=EvidenceOut
)
def create_evidence_item(
    organisation_id: UUID,
    payload: EvidenceCreate,
    tenant_org_id: UUID = Depends(require_tenant_context),
    db: Session = Depends(get_db),
    actor: dict[str, UUID | str | None] = Depends(get_actor),
) -> EvidenceOut:
    assert_path_matches_tenant(organisation_id, tenant_org_id)

    organisation = db.get(Organisation, organisation_id)
    if not organisation:
        raise HTTPException(status_code=404, detail="Organisation not found")

    actor_user = require_actor_user(
        db, actor["actor_user_id"], organisation_id
    )

    evidence = EvidenceItem(
        organisation_id=organisation_id,
        title=payload.title,
        description=payload.description,
        evidence_type=payload.evidence_type,
        source=payload.source,
        external_uri=payload.external_uri,
        sha256=payload.sha256,
        content_type=payload.content_type,
        size_bytes=payload.size_bytes,
        created_by_user_id=actor_user.id,
    )
    db.add(evidence)

    emit_audit_event(
        db,
        organisation_id=organisation_id,
        actor_user_id=actor_user.id,
        actor_email=actor.get("actor_email"),
        action="evidence_item.created",
        entity_type="evidence_item",
        entity_id=evidence.id,
        metadata={"title": payload.title, "evidence_type": payload.evidence_type},
    )

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Write failed")

    db.refresh(evidence)
    return evidence


@router.get(
    "/organisations/{organisation_id}/evidence", response_model=list[EvidenceOut]
)
def list_evidence_items(
    organisation_id: UUID,
    tenant_org_id: UUID = Depends(require_tenant_context),
    db: Session = Depends(get_db),
) -> list[EvidenceOut]:
    assert_path_matches_tenant(organisation_id, tenant_org_id)

    rows = db.execute(
        select(EvidenceItem).where(
            EvidenceItem.organisation_id == organisation_id
        )
    ).scalars()

    return list(rows)


@router.post(
    "/organisations/{organisation_id}/evidence/upload",
    response_model=EvidenceOut,
)
async def upload_evidence_file(
    organisation_id: UUID,
    file: UploadFile = File(...),
    evidence_type: str = Form(...),
    title: str | None = Form(default=None),
    description: str | None = Form(default=None),
    source: str | None = Form(default=None),
    external_uri: str | None = Form(default=None),
    tenant_org_id: UUID = Depends(require_tenant_context),
    db: Session = Depends(get_db),
    actor: dict[str, UUID | str | None] = Depends(get_actor),
) -> EvidenceOut:
    assert_path_matches_tenant(organisation_id, tenant_org_id)

    organisation = db.get(Organisation, organisation_id)
    if not organisation:
        raise HTTPException(status_code=404, detail="Organisation not found")

    actor_user = require_actor_user(
        db, actor["actor_user_id"], organisation_id
    )

    filename = file.filename or "upload.bin"
    evidence_title = title or filename
    file_bytes = await file.read()

    evidence = EvidenceItem(
        organisation_id=organisation_id,
        title=evidence_title,
        description=description,
        evidence_type=evidence_type,
        source=source,
        external_uri=external_uri,
        created_by_user_id=actor_user.id,
    )
    db.add(evidence)
    db.flush()

    try:
        storage = get_evidence_storage()
    except EvidenceStorageError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    try:
        stored = storage.store_file(
            organisation_id,
            evidence.id,
            filename,
            file_bytes,
            file.content_type,
        )
    except EvidenceStorageCollision as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except EvidenceStorageError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    evidence.storage_backend = storage.backend
    evidence.object_key = stored["object_key"]
    evidence.original_filename = filename
    evidence.sha256 = stored["sha256"]
    evidence.size_bytes = stored["size_bytes"]
    evidence.content_type = stored["content_type"]
    evidence.uploaded_at = datetime.now(timezone.utc)

    emit_audit_event(
        db,
        organisation_id=organisation_id,
        actor_user_id=actor_user.id,
        actor_email=actor.get("actor_email"),
        action="evidence_item.uploaded",
        entity_type="evidence_item",
        entity_id=evidence.id,
        metadata={
            "sha256": stored["sha256"],
            "original_filename": filename,
            "size_bytes": stored["size_bytes"],
            "backend": storage.backend,
        },
    )

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Write failed")

    db.refresh(evidence)
    return evidence


@router.get(
    "/organisations/{organisation_id}/evidence/{evidence_id}/download"
)
def download_evidence_file(
    organisation_id: UUID,
    evidence_id: UUID,
    tenant_org_id: UUID = Depends(require_tenant_context),
    db: Session = Depends(get_db),
    actor: dict[str, UUID | str | None] = Depends(get_actor),
) -> StreamingResponse:
    assert_path_matches_tenant(organisation_id, tenant_org_id)
    actor_user = require_actor_user(
        db, actor["actor_user_id"], organisation_id
    )

    evidence = db.get(EvidenceItem, evidence_id)
    if evidence is None or evidence.organisation_id != organisation_id:
        raise HTTPException(status_code=404, detail="Evidence item not found")
    if not evidence.storage_backend or not evidence.object_key:
        raise HTTPException(
            status_code=404, detail="Evidence file not available"
        )
    if evidence.storage_backend != "local":
        if evidence.storage_backend == "gcs":
            raise HTTPException(
                status_code=409,
                detail="Evidence stored in GCS; use /download-url.",
            )
        raise HTTPException(
            status_code=409, detail="Evidence storage backend unsupported"
        )

    storage = LocalEvidenceStorage()
    try:
        file_handle = storage.open_file(evidence.object_key)
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=404, detail="Evidence file not available"
        ) from exc
    except EvidenceStorageError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    filename = (evidence.original_filename or f"{evidence.id}.bin").replace(
        '"', ""
    )
    headers = {
        "Content-Disposition": f'attachment; filename="{filename}"'
    }
    media_type = evidence.content_type or "application/octet-stream"

    if _should_emit_download_audit():
        emit_audit_event(
            db,
            organisation_id=organisation_id,
            actor_user_id=actor_user.id,
            actor_email=actor.get("actor_email"),
            action="evidence_item.downloaded",
            entity_type="evidence_item",
            entity_id=evidence.id,
            metadata={
                "sha256": evidence.sha256,
                "filename": evidence.original_filename,
            },
        )
        try:
            db.commit()
        except IntegrityError:
            db.rollback()

    return StreamingResponse(
        file_handle,
        media_type=media_type,
        headers=headers,
        background=BackgroundTask(file_handle.close),
    )


@router.get(
    "/organisations/{organisation_id}/evidence/{evidence_id}/download-url",
    response_model=EvidenceDownloadUrlOut,
)
def create_evidence_download_url(
    organisation_id: UUID,
    evidence_id: UUID,
    tenant_org_id: UUID = Depends(require_tenant_context),
    db: Session = Depends(get_db),
    actor: dict[str, UUID | str | None] = Depends(get_actor),
) -> EvidenceDownloadUrlOut:
    assert_path_matches_tenant(organisation_id, tenant_org_id)
    actor_user = require_actor_user(
        db, actor["actor_user_id"], organisation_id
    )

    evidence = db.get(EvidenceItem, evidence_id)
    if evidence is None or evidence.organisation_id != organisation_id:
        raise HTTPException(status_code=404, detail="Evidence item not found")
    if not evidence.storage_backend or not evidence.object_key:
        raise HTTPException(
            status_code=404, detail="Evidence file not available"
        )
    if evidence.storage_backend != "gcs":
        raise HTTPException(
            status_code=409, detail="Evidence stored locally; use /download."
        )

    try:
        storage = get_evidence_storage()
    except EvidenceStorageError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if storage.backend != "gcs":
        raise HTTPException(
            status_code=409, detail="Evidence stored locally; use /download."
        )

    ttl_seconds = get_gcs_signed_url_ttl_seconds()
    filename = evidence.original_filename or f"{evidence.id}.bin"
    bucket = storage.client.bucket(storage.bucket_name)
    url = generate_gcs_signed_url(
        bucket,
        evidence.object_key,
        filename,
        ttl_seconds,
    )

    emit_audit_event(
        db,
        organisation_id=organisation_id,
        actor_user_id=actor_user.id,
        actor_email=actor.get("actor_email"),
        action="evidence_item.download_url_generated",
        entity_type="evidence_item",
        entity_id=evidence.id,
        metadata={
            "ttl_seconds": ttl_seconds,
            "backend": evidence.storage_backend,
        },
    )
    try:
        db.commit()
    except IntegrityError:
        db.rollback()

    return EvidenceDownloadUrlOut(url=url, expires_in=ttl_seconds)


def _should_emit_download_audit() -> bool:
    value = os.getenv("EVIDENCE_DOWNLOAD_AUDIT", "0").lower()
    return value in {"1", "true", "yes", "on"}
