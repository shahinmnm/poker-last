# Environment Files Guide

## Quick Answer

**For most users, you only need ONE `.env` file in the repository root.**

The additional `.env.example` files in subdirectories are provided for reference and specific use cases, but are **not required** for the application to function.

## File Structure Overview

```
poker-last/
├── .env                              # ✅ REQUIRED - Main configuration file
├── .env.example                      # Template for the main .env file
│
└── telegram_poker_bot/
    ├── .env.example                  # Optional: local development overrides
    ├── .env.local                    # Optional: your local overrides (gitignored)
    │
    └── frontend/
        ├── .env.example              # Optional: frontend-specific reference
        └── .env                      # Optional: frontend-only overrides (gitignored)
```

## Detailed Explanation

### 1. Root `.env` File (REQUIRED)

**Location:** `/poker-last/.env`  
**Created from:** `.env.example` in the same directory

This is the **primary and only required** environment file. It contains all configuration for:

- Database (PostgreSQL)
- Redis
- Telegram Bot
- Webhook configuration
- API settings
- Frontend build variables (VITE_*)
- Service ports
- Deployment settings

**Usage in Docker:**
All services in `docker-compose.yml` reference this file via:
```yaml
env_file:
  - ./.env
```

**Setup:**
```bash
# Copy the template
cp .env.example .env

# Edit with your values
nano .env  # or use your preferred editor
```

### 2. `telegram_poker_bot/.env.example` (OPTIONAL)

**Purpose:** Reference file for local development without Docker

This file is provided as a **template** for developers who want to run the bot service locally (outside Docker) with different settings than production. The comment at the top states:

> "This file is intended for local development overrides.  
> Copy the repository root .env.example for production defaults."

**When to use:**
- You're developing the bot service locally without Docker
- You want database/Redis URLs pointing to localhost instead of Docker service names
- You need different logging levels or feature flags during development

**How to use:**
```bash
cd telegram_poker_bot
cp .env.example .env.local
# Edit .env.local with your local development settings
```

**Note:** The application code will still read from the root `.env` file if this local file doesn't exist.

### 3. `telegram_poker_bot/frontend/.env.example` (OPTIONAL)

**Purpose:** Frontend-specific Vite configuration reference

This file contains **only** frontend build-time variables:
- `VITE_ALLOWED_HOSTS` - Allowed domains for Vite dev server
- `VITE_API_URL` - API endpoint for frontend requests
- `VITE_SUPPORTED_LANGS` - Language codes
- `VITE_DEFAULT_LANGUAGE` - Default language

**When to use:**
- You're developing the frontend with `npm run dev` locally
- You need different API URLs for local vs production frontend development
- You want to test with different language configurations

**How to use:**
```bash
cd telegram_poker_bot/frontend
cp .env.example .env
# Edit .env with your frontend development settings
```

**Important:** For Docker deployments, these VITE_* variables should be set in the **root `.env` file**, not here. The `docker-compose.yml` passes them to the frontend container:

```yaml
frontend:
  env_file: *backend-env-file  # Uses root .env
  environment:
    - VITE_API_URL=${VITE_API_URL:-http://localhost:8000}
    - VITE_BOT_USERNAME=${VITE_BOT_USERNAME:-@pokerbot}
```

## Recommended Workflow

### For Production Deployment (Docker)

1. **Only create the root `.env` file:**
   ```bash
   cp .env.example .env
   # Edit .env with your production values
   ```

2. **Deploy:**
   ```bash
   ./deploy/first-deploy.sh --with-nginx
   ```

That's it! You don't need any other `.env` files.

### For Local Development (Without Docker)

#### Backend Development:
```bash
# Root .env for shared config
cp .env.example .env

# Optional: Local overrides
cd telegram_poker_bot
cp .env.example .env.local
# Edit .env.local to point to localhost services
```

#### Frontend Development:
```bash
# Root .env for shared config
cp .env.example .env

# Optional: Frontend-specific settings
cd telegram_poker_bot/frontend
cp .env.example .env
# Edit .env with local dev server settings
```

### For Docker Development (Hot Reload)

```bash
# Only need root .env
cp .env.example .env
# Edit .env as needed

# Start with dev compose file
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

## Common Questions

### Q: Do I need to create all three .env files?

**A: No.** Only the root `.env` file is required. The others are optional and only needed for specific local development scenarios.

### Q: Which .env file takes precedence?

**A: It depends on how you run the application:**

- **Docker (production/dev):** Only the root `.env` is used
- **Local backend:** Root `.env` is primary, `telegram_poker_bot/.env.local` can override
- **Local frontend:** Frontend `.env` is used by Vite, but variables must also be in root `.env` for Docker builds

### Q: Why are VITE_* variables in the root .env?

**A:** The root `.env` file contains all configuration for Docker deployments. When the frontend container builds, it needs access to VITE_* variables. Docker Compose passes these from the root `.env` to the frontend build process.

### Q: Can I delete the .env.example files in subdirectories?

**A:** You can, but they're useful as templates and documentation. They're gitignored, so they won't affect your deployment. Keep them for reference.

### Q: I'm getting "undefined" for environment variables in the frontend

**A:** Check these:

1. VITE_* variables must be prefixed with `VITE_` to be exposed to the browser
2. In Docker: Set them in root `.env`
3. In local dev: Set them in `telegram_poker_bot/frontend/.env` OR root `.env`
4. Rebuild the frontend after changing .env files (`npm run build`)

## Summary

**Minimum requirement:** One `.env` file in the repository root.

**Optional files:** 
- `telegram_poker_bot/.env.local` - For local backend development
- `telegram_poker_bot/frontend/.env` - For local frontend development

All `.env` and `.env.local` files are gitignored to prevent committing sensitive data. Always use `.env.example` files as templates.
