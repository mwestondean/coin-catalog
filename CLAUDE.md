# CLAUDE.md -- Coin Catalog

## Project

Coin submission and cataloguing app for Mexican coin collection management.
Primary user: Tish (non-technical, browser-only). Secondary: Weston (admin).

- Repo: https://github.com/mwestondean/coin-catalog
- Linear project: Coin Catalog (under WSW team)
- Design brief: `docs/design-brief.md`

## Stack

- Backend: FastAPI + PostgreSQL
- Frontend: React + TypeScript + Vite + shadcn/ui
- Auth: JWT
- Infra: Vultr Ubuntu, Nginx, Cloudflare
- Domain: https://www.turnip56.com
- Image storage: server filesystem, Nginx-served with auth check

## Project Structure

```
D:\Coins\coin-catalog\
├── platform/
│   ├── api/            # FastAPI backend
│   │   ├── api.py      # App setup + router registration ONLY
│   │   ├── routers/    # All endpoint logic lives here
│   │   └── graders/    # NGC (implemented), PCGS (stub)
│   ├── migrations/     # SQL migrations (NNN_description.sql)
│   └── docker-compose.yml
├── dashboard/          # React + shadcn frontend
│   └── src/
├── images/             # Coin photos (not in git)
└── docs/
```

## Conventions

- Date format: MM-DD-YYYY
- No em dashes in any output
- No PA- prefix (reserved for Policy Alerts)
- Coin ID format: `{denom}-{year}-{seq}` (e.g., 20c-1907-006)
- Sheldon scale for all grade references

## Database

- PostgreSQL (Dockerized, port 5432)
- Migrations in `platform/migrations/`, zero-padded 3-digit numbering
- Before creating a migration, check existing files including untracked

## API Architecture

Same pattern as ACC: modular routers.
- `api.py` = app setup + router registration ONLY
- All endpoints in `platform/api/routers/*.py`
- New domain = new router file, then register in api.py

## Grader Modules

- `platform/api/graders/ngc.py` -- fully implemented
- `platform/api/graders/pcgs.py` -- stub (NotImplementedError)
- Common interface: tier_for_coin, calculate_fees, export_form_csv, validate_description

## Reuse-First Rule

Before writing any bespoke component:
1. Check shadcn/ui registry
2. Check shadcn community registries
3. Search GitHub for existing implementations
4. Check official library examples
5. Only then write bespoke code, and document why in the commit

## Build & Dev

Everything runs in Docker. No `npm run dev`. No `npm run build`.

```bash
# Full rebuild
cd /d D:\Coins\coin-catalog\platform && docker compose down && docker compose build --no-cache && docker compose up -d

# Targeted rebuild
cd /d D:\Coins\coin-catalog\platform && docker compose build --no-cache <service> && docker compose up -d <service>

# Verify
docker ps --format "table {{.Names}}\t{{.Status}}"
```

## Linting

- Backend: ruff + black
- Frontend: eslint + prettier
- Must pass before commit
