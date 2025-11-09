.PHONY: env compose-up compose-dev compose-down compose-logs deploy update migrate test lint

env:
	@test -f .env || (cp .env.example .env && echo "Created .env. Please edit it before running services.")

compose-up: env
	docker compose up -d

compose-dev: env
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up

compose-down:
	docker compose down

compose-logs:
	docker compose logs -f

migrate: env
	docker compose --profile ops run --rm migrations

deploy: env
	./deploy/first-deploy.sh

update: env
	./deploy/update.sh

test:
	pytest pokerkit telegram_poker_bot/tests

lint:
	ruff check pokerkit telegram_poker_bot
	black --check pokerkit telegram_poker_bot
