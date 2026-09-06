.PHONY: help dev dev-build prod prod-build prod-logs prod-seed prod-migrate \
        prod-migrate-dry down logs logs-be logs-fe clean shell-be shell-fe shell-db \
        install seed seed-fresh

COMPOSE_DEV  = docker compose -f docker-compose.dev.yml
COMPOSE_PROD = docker compose -f docker-compose.yml

# ──────────────────────────────────────────────────────────────────────────────
help:
	@echo ""
	@echo "  Infactra monorepo"
	@echo ""
	@echo "  Dev  (hot-reload, ports exposed to host):"
	@echo "    make dev            Start full dev stack"
	@echo "    make dev-build      Rebuild images then start dev"
	@echo ""
	@echo "  Production  (nginx on :80, detached):"
	@echo "    make prod           Start prod stack (needs ./.env)"
	@echo "    make prod-logs      Tail production logs"
	@echo "    make prod-migrate   Run the multi-tenant migration"
	@echo "    make prod-build     Rebuild then start prod"
	@echo ""
	@echo "  Utilities:"
	@echo "    make down           Stop all containers"
	@echo "    make logs           Tail all logs (dev)"
	@echo "    make logs-be        Tail backend logs (dev)"
	@echo "    make logs-fe        Tail frontend logs (dev)"
	@echo "    make clean          Remove containers, volumes, and local images"
	@echo "    make shell-be       sh into backend container"
	@echo "    make shell-fe       sh into frontend container"
	@echo "    make shell-db       mongosh into MongoDB"
	@echo "    make install        npm install in both apps (local dev without Docker)"
	@echo ""

# ──────────────────────────────────────────────────────────────────────────────
dev:
	$(COMPOSE_DEV) up -d

dev-build:
	$(COMPOSE_DEV) up -d --build

# ──────────────────────────────────────────────────────────────────────────────
prod:
	@test -f .env || { echo "Missing .env — cp .env.prod.example .env and edit it"; exit 1; }
	$(COMPOSE_PROD) up -d

prod-build:
	@test -f .env || { echo "Missing .env — cp .env.prod.example .env and edit it"; exit 1; }
	$(COMPOSE_PROD) up -d --build

prod-logs:
	$(COMPOSE_PROD) logs -f

prod-seed:
	$(COMPOSE_PROD) exec backend node scripts/seed.js

prod-migrate:
	$(COMPOSE_PROD) exec backend node scripts/migrate-multitenant.js

prod-migrate-dry:
	$(COMPOSE_PROD) exec backend node scripts/migrate-multitenant.js --dry-run

# ──────────────────────────────────────────────────────────────────────────────
down:
	$(COMPOSE_DEV) down 2>/dev/null; $(COMPOSE_PROD) down 2>/dev/null; true

logs:
	$(COMPOSE_DEV) logs -f

logs-be:
	$(COMPOSE_DEV) logs -f backend

logs-fe:
	$(COMPOSE_DEV) logs -f frontend

clean:
	$(COMPOSE_DEV)  down -v --rmi local 2>/dev/null; \
	$(COMPOSE_PROD) down -v --rmi local 2>/dev/null; true

# ──────────────────────────────────────────────────────────────────────────────
shell-be:
	$(COMPOSE_DEV) exec backend sh

shell-fe:
	$(COMPOSE_DEV) exec frontend sh

shell-db:
	$(COMPOSE_DEV) exec mongodb mongosh infactra_db

# ──────────────────────────────────────────────────────────────────────────────
install:
	cd apps/api && npm install
	cd apps/web && npm install

# ──────────────────────────────────────────────────────────────────────────────
seed:
	$(COMPOSE_DEV) exec backend node scripts/seed.js

seed-fresh:
	$(COMPOSE_DEV) exec backend node scripts/seed.js --fresh
