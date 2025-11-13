# Deployment Playbook

This directory contains scripted tooling and configuration for running the Telegram Poker Bot stack in production.

## Prerequisites
- Docker Engine 24+ with the Compose plugin (`docker compose`)
- Bash 5.x
- Git CLI
- A populated `.env` file in the repository root (copy from `.env.example` and customise)

> The scripts automatically abort if `.env` is missing. Populate it before proceeding.
>
> **ℹ️ Environment File Structure:** For detailed information about .env files, see `../ENV_FILES.md`. 
> **TL;DR:** You only need ONE `.env` file in the repository root for Docker deployments.

## Files
- `first-deploy.sh` – bootstrap a fresh host, build images, run migrations, and start the stack
- `update.sh` – pull the latest Git changes, rebuild, re-run migrations, and restart services
- `lib/common.sh` – shared helpers used by both scripts
- `nginx/default.conf` – reference Nginx reverse proxy configuration
- `.gitignore` – ignores TLS assets placed in `deploy/nginx/ssl/`

## Environment Variables

The scripts rely on these keys in `.env`:

| Variable | Purpose | Default |
| --- | --- | --- |
| `DEPLOY_GIT_REMOTE` | Git remote name used for updates | `origin` |
| `DEPLOY_GIT_BRANCH` | Target branch for deploys | `main` |
| `NGINX_SSL_CERT_PATH` | Host path containing TLS material mounted into the nginx container | `./deploy/nginx/ssl` |

All application/service configuration is also read from `.env`. Review the file carefully before deploying.

## First-Time Deployment

```bash
./deploy/first-deploy.sh            # builds images and starts postgres/redis/bot/api/frontend
./deploy/first-deploy.sh --with-nginx
# via Makefile helper
make deploy
```

The script performs:
1. Sanity checks for Docker, Git, and the `.env` file  
2. `docker compose pull` (skippable via `--skip-pull`)  
3. `docker compose build --pull`  
4. `docker compose up -d postgres redis`  
5. Alembic migrations (`docker compose --profile ops run --rm migrations`)  
6. `docker compose up -d [--profile nginx] --remove-orphans`  

## Rolling Updates

```bash
./deploy/update.sh
./deploy/update.sh --with-nginx --prune-images
# via Makefile helper
make update
```

This script hard-resets the repository to `${DEPLOY_GIT_REMOTE}/${DEPLOY_GIT_BRANCH}`, then rebuilds and restarts services. Flags allow you to skip pulls, builds, or migrations when appropriate.

## Scheduling Updates

The update script is idempotent and safe to run via cron/systemd. Example cron entry (runs every hour):

```
0 * * * * cd /opt/pokerbot && ./deploy/update.sh --skip-pull --prune-images >> /var/log/pokerbot-deploy.log 2>&1
```

Adjust cadence and options to suit your workflow.

## Useful Commands

- Check status: `docker compose ps`
- Tail logs: `docker compose logs -f api`
- Stop services: `docker compose down`
- Stop & remove volumes (danger): `docker compose down -v`

Add `--project-directory /path/to/repo` if you run the commands outside the repository root.

## Nginx

`deploy/nginx/default.conf` is a starting point. Copy it to your host configuration or mount it directly:

```
cp deploy/nginx/default.conf deploy/nginx/default.conf.local
docker compose --profile nginx up -d
```

Place certificates in `deploy/nginx/ssl/` (or change `NGINX_SSL_CERT_PATH`) before enabling the nginx profile.

## Developer Experience Extras

- `docker-compose.dev.yml` enables hot reload via volume mounts and `watchfiles`. Launch with:

  ```
  docker compose -f docker-compose.yml -f docker-compose.dev.yml up
  ```

- `docker-compose.yml` remains production friendly with persistent volumes and health checks.

## Troubleshooting

- **Containers restart repeatedly** – inspect logs with `docker compose logs --tail 200 <service>`  
- **Migrations fail** – ensure the database is reachable, then re-run `./deploy/update.sh --skip-pull --skip-build`  
- **Frontend cannot reach API** – verify `VITE_API_URL` in `.env` points to a public URL accessible by browsers

Open an issue or discussion with reproduction details if further help is needed.
