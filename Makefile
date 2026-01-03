backend-install:
	cd backend && pip install -r requirements.txt -r requirements-dev.txt

backend-test:
	cd backend && ruff check . && pytest

db-migrate:
	cd backend && alembic upgrade head

up:
	docker compose up --build

down:
	docker compose down
