from __future__ import annotations

import hashlib
import os
import re
import tempfile
from pathlib import Path
from uuid import UUID


class EvidenceStorageError(RuntimeError):
    pass


class EvidenceStorageCollision(EvidenceStorageError):
    pass


class LocalEvidenceStorage:
    def __init__(self, root: str | None = None) -> None:
        self.root = Path(root or os.getenv("EVIDENCE_LOCAL_ROOT", ".evidence_data"))

    def store_file(
        self,
        org_id: UUID,
        evidence_id: UUID,
        filename: str,
        file_bytes: bytes,
    ) -> tuple[str, str, int]:
        sha256 = hashlib.sha256(file_bytes).hexdigest()
        size_bytes = len(file_bytes)
        safe_name = _sanitize_filename(filename)
        object_key = f"evidence/{org_id}/{evidence_id}/{sha256}_{safe_name}"
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

        return object_key, sha256, size_bytes

    def open_file(self, object_key: str):
        target_path = self._resolve_path(object_key)
        return target_path.open("rb")

    def _resolve_path(self, object_key: str) -> Path:
        object_path = Path(object_key)
        if object_path.is_absolute() or ".." in object_path.parts:
            raise EvidenceStorageError("Invalid object key")
        return self.root / object_path


def _sanitize_filename(filename: str) -> str:
    base = Path(filename).name
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "_", base).strip("_")
    return cleaned or "file"
