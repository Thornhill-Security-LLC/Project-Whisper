backend-install:
	cd backend && pip install -r requirements.txt -r requirements-dev.txt

backend-test:
	cd backend && pytest

backend-lint:
	cd backend && ruff check .

backend-migrate:
	cd backend && alembic -c alembic.ini upgrade head

backend-smoke:
	curl -sS http://localhost:8000/health
	curl -sS http://localhost:8000/health/db

db-migrate: backend-migrate

up:
	docker compose up --build

down:
	docker compose down
