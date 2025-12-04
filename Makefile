.PHONY: env compose-up compose-dev compose-down compose-logs deploy update migrate \
        test test-backend test-backend-unit test-backend-integration test-frontend \
        test-e2e test-api test-websocket test-analytics test-integration test-coverage \
        lint format

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

# Test targets - Phase 6 comprehensive test architecture
test:
	@echo "Running full test suite..."
	pytest telegram_poker_bot/tests -v

test-backend:
	@echo "Running all backend tests..."
	pytest telegram_poker_bot/tests/backend -v

test-backend-unit:
	@echo "Running backend unit tests..."
	pytest telegram_poker_bot/tests/backend/unit -v

test-backend-integration:
	@echo "Running backend integration tests..."
	pytest telegram_poker_bot/tests/backend/integration -v

test-integration:
	@echo "Running integration tests (all variants)..."
	pytest telegram_poker_bot/tests/integration -v

test-api:
	@echo "Running API contract tests..."
	pytest telegram_poker_bot/tests/api -v

test-websocket:
	@echo "Running WebSocket contract tests..."
	pytest telegram_poker_bot/tests/websocket -v

test-analytics:
	@echo "Running analytics tests..."
	pytest telegram_poker_bot/tests/analytics -v

test-runtime:
	@echo "Running runtime tests..."
	pytest telegram_poker_bot/tests/runtime -v

test-frontend:
	@echo "Running frontend tests..."
	cd telegram_poker_bot/frontend && npm test

test-e2e:
	@echo "Running E2E tests with Playwright..."
	cd telegram_poker_bot/frontend && npm run test:e2e

test-coverage:
	@echo "Running tests with coverage report..."
	pytest telegram_poker_bot/tests --cov=telegram_poker_bot --cov-report=html --cov-report=term

test-pokerkit:
	@echo "Running PokerKit tests..."
	pytest pokerkit/tests -v

lint:
	@echo "Running linters..."
	ruff check pokerkit telegram_poker_bot
	black --check pokerkit telegram_poker_bot

format:
	@echo "Formatting code..."
	black pokerkit telegram_poker_bot
	ruff check --fix pokerkit telegram_poker_bot
