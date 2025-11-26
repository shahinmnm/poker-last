# PokerKit Deployment Notes

These notes summarize what is required to run the PokerKit-powered stack on a VPS/Docker target.

## Dependencies
- Python 3.10+ is required; the Docker image uses Python 3.11-slim to stay within PokerKit's supported range.
- `pokerkit==0.6.4` is declared in the dependency lists and installed in the Docker image before the app code is copied, ensuring the engine is present for runtime tasks and migrations.

## Database migrations
Run the full Alembic chain before starting services:

- `001_initial_schema` – includes `hands.engine_state_json` (JSONB after `004`) and base gameplay tables.
- `009_add_seat_sitout_flag` – adds `seats.is_sitting_out_next_hand`.
- `010_add_hand_histories_table` and `011_add_hand_history_events` – persist hand histories and per-action events.
- `012_add_timeout_tracking` – adds `hands.timeout_tracking` JSONB for enforcing consecutive timeouts.

Apply migrations with `alembic upgrade head` (or the `migrations` service in `docker-compose.yml`). Skipping them will block hand startup because required columns will be missing.

### Breaking changes
- Hands created before the timeout tracking field or hand history tables existed will not have those fields populated; finish or archive in-flight games before upgrading.
- Existing tables without `engine_state_json` converted to JSONB (before `004`) must be migrated to allow PokerKit state persistence and queries.

## Runtime settings
Key environment variables with sensible defaults (from `telegram_poker_bot.shared.config.Settings`):
- `TURN_TIMEOUT_SECONDS` (default `25`): per-turn action timeout.
- `POST_HAND_DELAY_SECONDS` (default `20`): pause between hands.
- `RAKE_PERCENTAGE` (default `0.05`) and `MAX_RAKE_CAP` (default `500`, in smallest currency units): rake configuration applied during settlement.
- Other helpful defaults: `SMALL_BLIND=25`, `BIG_BLIND=50`, `DEFAULT_STARTING_STACK=10000`.

Set overrides in your `.env` or Docker Compose environment as needed.

## Observability guidance
- Action logging now includes `table_id`, `hand_no`, `user_id`, `action_type`, `street_index`, and `actor_index` when persisting hand history events. Use structured logging to filter on these fields when diagnosing gameplay issues.
- Avoid enabling `TRACE_ENGINE` unless debugging; it can be noisy during tight action loops.

## Deployment checklist
1. `alembic upgrade head`
2. `docker compose build`
3. `docker compose up -d`
4. (Optional but recommended) `pytest`

## Troubleshooting
- **Hands never start:** ensure migrations ran to completion, `pokerkit` is installed, and environment variables for DB/Redis are reachable.
- **Streets do not advance:** check logs for missing actions or actor index mismatches; verify `TURN_TIMEOUT_SECONDS` is not set to `0`.
- **Winners look wrong:** confirm rake settings and that `engine_state_json` is populated (no partial migrations); inspect `hand_history_events` for the expected sequence.
- **Timeouts not firing:** verify the timeout tracking column exists, `TURN_TIMEOUT_SECONDS` is set, and background workers/bot containers can reach Redis for scheduling.
