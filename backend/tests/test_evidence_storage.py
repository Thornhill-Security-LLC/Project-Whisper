import hashlib
from uuid import UUID

from app.services.evidence_storage import (
    LocalEvidenceStorage,
    _sanitize_filename,
    build_object_key,
)


def test_sanitize_filename_strips_paths_and_controls() -> None:
    filename = 'folder/sub/report" \n.pdf'
    assert _sanitize_filename(filename) == "report_.pdf"


def test_build_object_key_uses_sha_and_sanitized_name() -> None:
    org_id = UUID("11111111-1111-1111-1111-111111111111")
    evidence_id = UUID("22222222-2222-2222-2222-222222222222")
    sha256 = "abc123"
    object_key = build_object_key(org_id, evidence_id, sha256, "folder/Report.pdf")
    assert (
        object_key
        == "evidence/11111111-1111-1111-1111-111111111111/"
        "22222222-2222-2222-2222-222222222222/"
        "abc123_Report.pdf"
    )


def test_local_storage_returns_sha_size_and_content_type(tmp_path) -> None:
    storage = LocalEvidenceStorage(root=str(tmp_path))
    file_bytes = b"evidence bytes"
    expected_sha = hashlib.sha256(file_bytes).hexdigest()
    object_key, sha256, size_bytes, content_type = storage.store_file(
        UUID("33333333-3333-3333-3333-333333333333"),
        UUID("44444444-4444-4444-4444-444444444444"),
        "report.pdf",
        file_bytes,
        "application/pdf",
    )

    assert sha256 == expected_sha
    assert size_bytes == len(file_bytes)
    assert content_type == "application/pdf"
    stored_path = tmp_path / object_key
    assert stored_path.exists()
    assert stored_path.read_bytes() == file_bytes
