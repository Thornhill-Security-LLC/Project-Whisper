from __future__ import annotations

import hashlib
import os
import re
import tempfile
from pathlib import Path
from uuid import UUID

from app.core.config import (
    get_evidence_storage_backend,
    get_gcs_bucket_name,
    get_gcp_project_id,
)


class EvidenceStorageError(RuntimeError):
    pass


class EvidenceStorageCollision(EvidenceStorageError):
    pass


class LocalEvidenceStorage:
    backend = "local"

    def __init__(self, root: str | None = None) -> None:
        self.root = Path(root or os.getenv("EVIDENCE_LOCAL_ROOT", ".evidence_data"))

    def store_file(
        self,
        org_id: UUID,
        evidence_id: UUID,
        filename: str,
        file_bytes: bytes,
        content_type: str | None = None,
    ) -> dict[str, str | int | None]:
        sha256 = hashlib.sha256(file_bytes).hexdigest()
        size_bytes = len(file_bytes)
        object_key = build_object_key(
            org_id, evidence_id, sha256, filename
        )
        target_path = self._resolve_path(object_key)
        target_path.parent.mkdir(parents=True, exist_ok=True)

        if target_path.exists():
            raise EvidenceStorageCollision("Evidence object already exists")

        with tempfile.NamedTemporaryFile(
            dir=target_path.parent, delete=False
        ) as temp_file:
            temp_file.write(file_bytes)
            temp_file.flush()
            os.fsync(temp_file.fileno())
            temp_name = temp_file.name

        try:
            if target_path.exists():
                raise EvidenceStorageCollision("Evidence object already exists")
            os.replace(temp_name, target_path)
        except Exception:
            if os.path.exists(temp_name):
                os.remove(temp_name)
            raise

        return {
            "object_key": object_key,
            "sha256": sha256,
            "size_bytes": size_bytes,
            "content_type": content_type,
        }

    def open_file(self, object_key: str):
        target_path = self._resolve_path(object_key)
        return target_path.open("rb")

    def generate_signed_download_url(
        self,
        object_key: str,
        filename: str,
        ttl_seconds: int,
    ) -> str:
        raise NotImplementedError("Signed URLs are not available for local storage.")

    def _resolve_path(self, object_key: str) -> Path:
        object_path = Path(object_key)
        if object_path.is_absolute() or ".." in object_path.parts:
            raise EvidenceStorageError("Invalid object key")
        return self.root / object_path


def _sanitize_filename(filename: str) -> str:
    base = Path(filename).name
    base = base.replace("/", "").replace("\\", "")
    base = base.replace('"', "").replace("'", "")
    base = re.sub(r"[\x00-\x1f\x7f]+", "", base)
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "_", base).strip("_")
    return cleaned or "evidence.bin"


def build_object_key(
    org_id: UUID, evidence_id: UUID, sha256: str, filename: str
) -> str:
    safe_name = _sanitize_filename(filename)
    return f"evidence/{org_id}/{evidence_id}/{sha256}_{safe_name}"


class GcsEvidenceStorage:
    backend = "gcs"

    def __init__(self, bucket_name: str, project_id: str | None = None) -> None:
        from google.cloud import storage

        self.bucket_name = bucket_name
        self.client = storage.Client(project=project_id)

    def store_file(
        self,
        org_id: UUID,
        evidence_id: UUID,
        filename: str,
        file_bytes: bytes,
        content_type: str | None = None,
    ) -> dict[str, str | int | None]:
        from google.api_core import exceptions as gcs_exceptions

        sha256 = hashlib.sha256(file_bytes).hexdigest()
        size_bytes = len(file_bytes)
        object_key = build_object_key(
            org_id, evidence_id, sha256, filename
        )

        bucket = self.client.bucket(self.bucket_name)
        blob = bucket.blob(object_key)
        try:
            blob.upload_from_string(
                file_bytes,
                content_type=content_type,
                if_generation_match=0,
            )
        except gcs_exceptions.PreconditionFailed as exc:
            raise EvidenceStorageCollision(
                "Evidence object already exists"
            ) from exc
        except gcs_exceptions.GoogleAPIError as exc:
            raise EvidenceStorageError("Failed to store evidence in GCS") from exc

        return {
            "object_key": object_key,
            "sha256": sha256,
            "size_bytes": size_bytes,
            "content_type": content_type,
        }

    def generate_signed_download_url(
        self,
        object_key: str,
        filename: str,
        ttl_seconds: int,
    ) -> str:
        safe_filename = _sanitize_filename(filename)
        response_disposition = (
            f'attachment; filename="{safe_filename}"'
        )
        blob = self.client.bucket(self.bucket_name).blob(object_key)
        return blob.generate_signed_url(
            version="v4",
            expiration=ttl_seconds,
            method="GET",
            response_disposition=response_disposition,
        )


def get_evidence_storage() -> LocalEvidenceStorage | GcsEvidenceStorage:
    backend = get_evidence_storage_backend()
    if backend == "gcs":
        bucket_name = get_gcs_bucket_name()
        if not bucket_name:
            raise EvidenceStorageError("GCS_BUCKET_NAME is required")
        return GcsEvidenceStorage(
            bucket_name=bucket_name,
            project_id=get_gcp_project_id(),
        )
    if backend != "local":
        raise EvidenceStorageError(
            f"Unsupported evidence storage backend: {backend}"
        )
    return LocalEvidenceStorage()
