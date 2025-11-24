.PHONY: env compose-up compose-dev compose-down compose-logs deploy update migrate test lint

env:
	@test -f .env || (cp .env.example .env && echo "Created .env. Please edit it before running services.")

# Start all services (migrations run automatically via depends_on)
compose-up: env
	@echo "Starting services (migrations will run automatically)..."
	docker compose up -d
	@echo ""
	@echo "Checking migration status..."
	@docker compose logs migrations
	@echo ""
	@echo "Services started. Check status with: docker compose ps"
	@echo "View logs with: docker compose logs -f [service]"

compose-dev: env
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up

compose-down:
	docker compose down

compose-logs:
	docker compose logs -f

# Run migrations explicitly (useful for troubleshooting)
migrate: env
	@echo "Running database migrations..."
	docker compose up -d postgres
	@echo "Waiting for postgres to be healthy..."
	@timeout 30 bash -c 'until docker compose exec -T postgres pg_isready -U $${POSTGRES_USER:-pokerbot} -d $${POSTGRES_DB:-pokerbot} >/dev/null 2>&1; do sleep 1; done' || (echo "Postgres health check timeout" && exit 1)
	docker compose run --rm migrations
	@echo ""
	@echo "Migration logs:"
	@docker compose logs migrations

deploy: env
	./deploy/first-deploy.sh

update: env
	./deploy/update.sh

test:
	pytest pokerkit telegram_poker_bot/tests

lint:
	ruff check pokerkit telegram_poker_bot
	black --check pokerkit telegram_poker_bot
