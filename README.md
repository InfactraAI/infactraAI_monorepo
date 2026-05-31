# Infactra

AI-powered financial intelligence platform. Connects Tally ERP, OneDrive Excel files, and HR data into unified dashboards — MIS, Inventory, Reconciliation, and HR Analytics.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Angular 20 · Angular Material · Chart.js |
| Backend | Node.js 22 · Express 4 · JWT auth |
| Primary DB | MongoDB 7 (Mongoose) |
| Secondary DB | MySQL 8 |
| File storage | Local disk (`uploads/`) via Multer |
| Integrations | Microsoft OneDrive (Graph API · OAuth2) · Tally ERP (XML/HTTP) |
| Serving (prod) | nginx (SPA + API reverse proxy) |
| Orchestration | Docker Compose · Make |

---

## Monorepo layout

```
infactra/
├── apps/
│   ├── api/                  Express backend
│   │   ├── server.js         Entry point — env, DB connect, graceful shutdown
│   │   └── src/
│   │       ├── app.js        Express app factory
│   │       ├── config/       Multer storage config
│   │       ├── middleware/   JWT authentication, central error handler
│   │       ├── models/       Mongoose schemas
│   │       ├── modules/      Domain modules (auth · company · onedrive · tally)
│   │       │   └── <domain>/
│   │       │       ├── <domain>.controller.js
│   │       │       └── <domain>.routes.js
│   │       ├── jobs/         Cron jobs (token auto-refresh)
│   │       └── utils/        Crypto helpers, Excel parser, token refresh
│   └── web/                  Angular frontend
│       └── src/app/
│           ├── core/         Services (auth, onedrive, logo, api)
│           ├── features/     One folder per page/domain
│           └── shared/       Navbar, logo dialog, Chart.js plugin
├── docker-compose.yml        Production stack
├── docker-compose.dev.yml    Development stack (hot-reload, ports exposed)
├── Makefile                  Single entry point for all commands
└── .env.example              Environment variable template
```

---

## Quickstart

### Prerequisites

- Docker Desktop ≥ 4.x
- Make

### 1. Configure environment

```bash
cp .env.example apps/api/.env
# Edit apps/api/.env — fill in JWT_SECRET, EMAIL_*, CLIENT_ID, CLIENT_SECRET
```

### 2. Start the full stack

```bash
# Development — hot reload, all ports exposed
make dev

# Production — nginx on :80, detached
make prod
```

That's it. One command starts MongoDB, MySQL, the API, and the frontend.

---

## Make commands

```
make dev            Start full dev stack (hot-reload)
make dev-build      Rebuild images then start dev

make prod           Start production stack (detached)
make prod-build     Rebuild images then start prod

make down           Stop all containers
make logs           Tail all logs
make logs-be        Tail backend logs only
make logs-fe        Tail frontend logs only
make clean          Remove containers, volumes, and local images

make shell-be       sh into backend container
make shell-fe       sh into frontend container
make shell-db       mongosh into MongoDB

make install        npm install both apps (local dev without Docker)
```

---

## Ports

| Mode | Service | Port |
|---|---|---|
| Dev | Angular dev server | `4200` |
| Dev | Express API | `3000` |
| Dev | MongoDB | `27017` |
| Dev | MySQL | `3306` |
| Prod | nginx (FE + API proxy) | `80` |

In production only port `80` is exposed. nginx proxies `/auth`, `/company`, `/onedrive`, `/tally`, `/uploads` to the backend container internally.

---

## API

Base URL (dev): `http://localhost:3000`  
Base URL (prod): `http://localhost` (proxied by nginx, no port needed)

See [`docs/postman_collection.json`](docs/postman_collection.json) — import into Postman for a ready-to-use collection with environment variables.

### Auth

| Method | Path | Description |
|---|---|---|
| `POST` | `/auth/login` | Login, returns JWT |
| `POST` | `/auth/register` | Register new admin user |
| `POST` | `/auth/forgotPassword` | Send password reset link |
| `POST` | `/auth/resetPassword` | Reset password using token |

### Company

| Method | Path | Description |
|---|---|---|
| `GET` | `/company/profile` | Get company name + logo URL |
| `POST` | `/company/update` | Update company name / logo URL |
| `POST` | `/company/upload-logo` | Upload logo file (`multipart/form-data`) |

### OneDrive

| Method | Path | Description |
|---|---|---|
| `GET` | `/onedrive/login` | Redirect to Microsoft OAuth |
| `GET` | `/onedrive/callback` | OAuth callback (Microsoft redirects here) |
| `GET` | `/onedrive/getOneDrives` | List connected drives for a user |
| `GET` | `/onedrive/files` | Sync Excel from OneDrive → MongoDB |
| `GET` | `/onedrive/getExcelInventoryHrData` | Read cached data from MongoDB |
| `GET` | `/onedrive/download/:id` | Stream file download |

### Tally

| Method | Path | Description |
|---|---|---|
| `POST` | `/tally/connect` | Test connection to a running Tally instance |

### Health

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Returns `{ status: "ok" }` |

---

## Environment variables

Copy `.env.example` to `apps/api/.env` and fill in the values below.

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | API port (default `3000`) |
| `JWT_SECRET` | **Yes** | Signing secret for JWT tokens |
| `MONGO_URI` | **Yes** | MongoDB connection string |
| `DB_HOST` | No | MySQL host (default `localhost`) |
| `DB_USER` | No | MySQL user |
| `DB_PASSWORD` | No | MySQL password |
| `DB_NAME` | No | MySQL database name |
| `EMAIL_USER` | No | Gmail address for transactional email |
| `EMAIL_PASS` | No | Gmail app password |
| `FRONTEND_URL` | **Yes** | Used for CORS and email links |
| `API_BASE_URL` | **Yes** | Used to build upload file URLs |
| `CLIENT_ID` | **Yes** | Azure app client ID (OneDrive OAuth) |
| `CLIENT_SECRET` | **Yes** | Azure app client secret |
| `TENANT_ID` | No | Azure tenant (default `common`) |
| `REDIRECT_URI` | **Yes** | OAuth callback URL registered in Azure |
| `CRYPTO_SECRET` | No | Key for AES encryption (defaults to `default_secret_key`) |

---

## Development without Docker

```bash
# Install dependencies
make install

# Start MongoDB locally (or use Atlas)
# Start MySQL locally

# Backend
cd apps/api
cp .env.example .env   # fill values
npm run dev            # nodemon

# Frontend (separate terminal)
cd apps/web
npx ng serve
```

---

## Project background

Infactra connects to a company's existing data sources (Tally ERP, OneDrive-hosted Excel sheets) and presents a CFO-level view: P&L MIS, inventory tracking, HR attendance and salary sheets, and balance reconciliation — without requiring any manual data entry.
