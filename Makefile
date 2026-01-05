backend-install:
	cd backend && pip install -r requirements.txt -r requirements-dev.txt

backend-test:
	cd backend && pytest

test-docker:
	docker compose run --rm backend-test

backend-lint:
	cd backend && ruff check .

backend-migrate:
	cd backend && alembic -c alembic.ini upgrade head

backend-smoke:
	curl -sS http://localhost:8000/health
	curl -sS http://localhost:8000/health/db

db-migrate: backend-migrate

up:
	docker compose up -d --build
	@echo "Stack is up. Next: make migrate"

down:
	docker compose down
	@echo "Stack is down. Next: make up"

logs:
	docker compose logs -f --tail 200

migrate:
	docker compose run --rm backend alembic -c alembic.ini upgrade head
	@echo "Migrations complete. Next: make health"

health:
	curl -sS http://localhost:8000/health
	curl -sS http://localhost:8000/health/db
	@echo "Health checks done. Next: make bootstrap"

routes:
	./scripts/dev_show_routes.sh

bootstrap:
	./scripts/dev_bootstrap.sh

upload:
	./scripts/dev_upload_evidence.sh

reset:
	./scripts/dev_reset.sh
