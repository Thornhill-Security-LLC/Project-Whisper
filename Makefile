backend-install:
	pip install -r backend/requirements.txt -r backend/requirements-dev.txt

backend-test:
	pytest backend/tests

db-migrate:
	alembic -c backend/alembic.ini upgrade head

up:
	docker compose up --build

down:
	docker compose down
