import hashlib
from uuid import UUID

from app.services.evidence_storage import (
    GcsEvidenceStorage,
    LocalEvidenceStorage,
    _sanitize_filename,
    build_object_key,
)


def test_sanitize_filename_strips_paths_and_controls() -> None:
    filename = 'folder/sub/report" \n.pdf'
    assert _sanitize_filename(filename) == "report_.pdf"


def test_sanitize_filename_falls_back_when_empty() -> None:
    filename = "///"
    assert _sanitize_filename(filename) == "evidence.bin"


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
    stored = storage.store_file(
        UUID("33333333-3333-3333-3333-333333333333"),
        UUID("44444444-4444-4444-4444-444444444444"),
        "report.pdf",
        file_bytes,
        "application/pdf",
    )

    assert stored["sha256"] == expected_sha
    assert stored["size_bytes"] == len(file_bytes)
    assert stored["content_type"] == "application/pdf"
    stored_path = tmp_path / stored["object_key"]
    assert stored_path.exists()
    assert stored_path.read_bytes() == file_bytes


def test_gcs_signed_url_uses_sanitized_filename_and_ttl() -> None:
    class FakeBlob:
        def __init__(self) -> None:
            self.kwargs: dict[str, object] = {}

        def generate_signed_url(self, **kwargs: object) -> str:
            self.kwargs = kwargs
            return "https://signed.example.com/evidence/key"

    class FakeBucket:
        def __init__(self) -> None:
            self.last_object_key: str | None = None
            self.blob_instance = FakeBlob()

        def blob(self, object_key: str) -> FakeBlob:
            self.last_object_key = object_key
            return self.blob_instance

    class FakeClient:
        def __init__(self) -> None:
            self.last_bucket: str | None = None
            self.bucket_instance = FakeBucket()

        def bucket(self, bucket_name: str) -> FakeBucket:
            self.last_bucket = bucket_name
            return self.bucket_instance

    storage = GcsEvidenceStorage.__new__(GcsEvidenceStorage)
    storage.bucket_name = "evidence-bucket"
    storage.client = FakeClient()

    url = storage.generate_signed_download_url(
        "evidence/key",
        'folder/Report "Q1".pdf',
        None,
        120,
    )

    assert url == "https://signed.example.com/evidence/key"
    fake_blob = storage.client.bucket_instance.blob_instance
    assert storage.client.last_bucket == "evidence-bucket"
    assert storage.client.bucket_instance.last_object_key == "evidence/key"
    assert fake_blob.kwargs["expiration"] == 120
    assert fake_blob.kwargs["response_type"] == "application/octet-stream"
    assert (
        fake_blob.kwargs["response_disposition"]
        == 'attachment; filename="Report_Q1.pdf"'
    )
