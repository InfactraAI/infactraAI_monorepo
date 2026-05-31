# Architecture

## System overview

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser                                                        │
│                                                                 │
│  Angular 20 SPA                                                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │
│  │Dashboard │ │  MIS     │ │  HR AI   │ │  Configuration   │  │
│  │Inventory │ │Reconcil. │ │  AskAI   │ │  OneDrive/Tally  │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘  │
│        │                                                        │
│  ┌─────▼──────────────────────────────────────┐                │
│  │  core/services  (HTTP via Angular HttpClient)│               │
│  │  auth · onedrive · logo · api               │               │
│  └─────────────────┬───────────────────────────┘               │
└────────────────────│────────────────────────────────────────────┘
                     │ HTTP/JSON  (dev: :3000 / prod: :80 via nginx)
┌────────────────────▼────────────────────────────────────────────┐
│  nginx  (production only)                                       │
│  ├── /auth, /company, /onedrive, /tally  → proxy → backend:3000│
│  └── /  → serve Angular build (SPA fallback)                   │
└────────────────────┬────────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────────┐
│  Express API  (apps/api)                                        │
│                                                                 │
│  server.js  ──  app.js  ──  modules/                           │
│                             ├── auth        POST login/register │
│                             ├── company     GET/POST profile    │
│                             ├── onedrive    OAuth + file sync   │
│                             └── tally       XML connect         │
│                                                                 │
│  middleware/                                                    │
│  ├── authenticate.js   JWT Bearer token validation              │
│  └── errorHandler.js   Central error → JSON response           │
│                                                                 │
│  jobs/                                                          │
│  └── tokenRefresh.job  Cron every 5 min — refresh expiring     │
│                        OneDrive tokens automatically            │
│                                                                 │
│  utils/                                                         │
│  ├── token.js          getValidAccessToken + refreshAccessToken │
│  ├── fileParser.js     Download + parse Excel from OneDrive URL │
│  └── crypto.js         AES-256-CBC encrypt/decrypt              │
└──────┬────────────────────────────┬───────────────────────────-┘
       │                            │
┌──────▼──────┐           ┌─────────▼──────┐
│  MongoDB 7  │           │   MySQL 8      │
│             │           │                │
│  Users      │           │  (reserved for │
│  Companies  │           │   future SQL   │
│  FileData   │           │   reporting)   │
│  UserTokens │           └────────────────┘
│  Sessions   │
│  AzureConfig│
└─────────────┘
                  ┌───────────────────────────┐
                  │  External services        │
                  │                           │
                  │  Microsoft Graph API      │
                  │  ├── OAuth2 token flow    │
                  │  └── Files.Read (Excel)   │
                  │                           │
                  │  Tally ERP (local)        │
                  │  └── XML over HTTP :9000  │
                  │                           │
                  │  Gmail SMTP               │
                  │  └── Password reset email │
                  └───────────────────────────┘
```

---

## Request lifecycle

### Authenticated API request

```
Browser
  │  Authorization: Bearer <jwt>
  ▼
nginx (prod) / direct (dev)
  │
  ▼
app.js router
  │
  ▼
middleware/authenticate.js
  │  jwt.verify(token, JWT_SECRET)
  │  → attaches req.userId, req.userRole
  ▼
module controller
  │  business logic + DB queries
  ▼
JSON response
```

### OneDrive OAuth flow

```
User fills clientId / clientSecret / department in UI
  │
  ▼
GET /onedrive/login?clientId=&clientSecret=&redirectUri=&department=&userId=
  │  encodes params into base64 state
  │  redirects to Microsoft login
  ▼
Microsoft OAuth consent screen
  │  user logs in, grants Files.Read
  ▼
GET /onedrive/callback?code=&state=
  │  exchanges code for access_token + refresh_token
  │  calls /me to get accountId + email
  │  saves tokens to UserToken.oneDrives[]
  │  redirects to FRONTEND_URL?login=success
  ▼
GET /onedrive/files?userId=&department=
  │  getValidAccessToken() — refreshes if within 5-min buffer
  │  fetches root children from Graph API
  │  finds folder matching department name
  │  finds .xlsx file inside folder
  │  parseExcelFromUrl() — downloads + parses
  │  saves processed data to FileData collection
  ▼
GET /onedrive/getExcelInventoryHrData?department=
  │  reads from FileData (no Graph API call)
  ▼
Angular component renders table
```

### Token auto-refresh (cron)

```
Every 5 minutes:
  UserToken.find({})
    for each user → for each oneDrive
      if refreshToken exists AND expiry < 5 min away
        refreshAccessToken(userId, accountId)
          POST /oauth2/v2.0/token  (grant_type=refresh_token)
          update drive.accessToken, drive.expiry
        save user
```

---

## Data models

### User
```
_id, name, email (unique), mobile (unique), password (bcrypt, select:false),
role (USER|ADMIN), address, active, resetOtp, resetOtpExpiry
```

### Company
```
_id, name, logo (URL string), createdAt, updatedAt
```

### UserToken
```
userId (unique index)
oneDrives: [
  { accountId, email, department, accessToken, refreshToken, expiry, active }
]
```

### FileData
```
department, fileType, fileName (unique), columns: [String], data: [Mixed]
```

### AzureConfig
```
userId (unique), tenantId, clientId, clientSecret, redirectUri
```

### Session
```
sessionId (unique, TTL 1h), userId
(kept for legacy session-based flows; active auth uses JWT)
```

---

## Frontend architecture

```
apps/web/src/app/
│
├── core/                   Singleton services, provided in root
│   └── services/
│       ├── auth.service     login · register · forgot · reset · session
│       ├── logo.service     company profile · logo upload
│       ├── onedrive.service OneDrive OAuth redirect + data endpoints
│       └── api.service      generic connection endpoints
│
├── features/               One folder = one route/domain
│   ├── auth/               Login page (login · register · forgot · reset)
│   ├── dashboard/          Admin dashboard with KPI cards + bar chart
│   ├── mis/                P&L tabs, KPI cards, ratios
│   ├── hr/
│   │   ├── hr.ts           Parent with date picker + router-outlet
│   │   ├── attendance/     Editable attendance grid (localStorage backed)
│   │   └── salary/         Salary sheet with auto-calculation
│   ├── inventory/          OneDrive Excel → dynamic mat-table
│   ├── reconciliation/     Net Current Assets table
│   ├── configuration/      Data source selector (Tally, OneDrive, etc.)
│   ├── onedrive/           OneDrive OAuth config form
│   ├── tally/              Tally host/port connection form
│   └── ask-ai/             AI chat interface (stub)
│
└── shared/                 Reused across features
    ├── components/
    │   ├── navbar/         Top navigation bar + sidebar layout shell
    │   └── logo-dialog/    Company logo upload dialog (MatDialog)
    └── plugins/
        └── chart-plugin    Custom Chart.js vertical hover plugin
```

### Routing structure
```
/                     → redirect to /dashboard (guarded by TopNavbar layout)
/dashboard
/mis
/inventory
/hr-ai
  /hr-ai/attendance
  /hr-ai/salary
/reconciliation
/configuration
/tally-config
/one-drive-config
/ask-fireai
/**                   → LoginComponent (catch-all = login page)
```

---

## Infrastructure (Docker)

### Development

```
┌─────────────────────────────────────────────────────────┐
│  docker-compose.dev.yml                                 │
│                                                         │
│  frontend:4200  ←─ volume mount ./apps/web              │
│      ng serve --host 0.0.0.0 --poll 1000               │
│                                                         │
│  backend:3000   ←─ volume mount ./apps/api              │
│      nodemon server.js                                  │
│                                                         │
│  mongodb:27017  ←─ named volume mongo_data_dev          │
│  mysql:3306     ←─ named volume mysql_data_dev          │
│                                                         │
│  All ports exposed to host for direct access            │
└─────────────────────────────────────────────────────────┘
```

### Production

```
┌─────────────────────────────────────────────────────────┐
│  docker-compose.yml                                     │
│                                                         │
│  frontend:80                                            │
│      nginx multi-stage build:                           │
│      stage 1 — node:22 → ng build --configuration prod  │
│      stage 2 — nginx:alpine serves dist/                │
│      proxies /auth /company /onedrive /tally → backend  │
│                                                         │
│  backend:3000  (not exposed externally)                 │
│      node server.js                                     │
│      env_file: apps/api/.env                            │
│      override env: MONGO_URI, FRONTEND_URL, etc.        │
│                                                         │
│  mongodb, mysql  (internal only, healthchecks gated)    │
│                                                         │
│  backend depends_on: service_healthy for both DBs       │
└─────────────────────────────────────────────────────────┘
```

---

## 12-Factor compliance

| Factor | Implementation |
|---|---|
| **I. Codebase** | Single git repo, two apps under `apps/` |
| **II. Dependencies** | `package.json` per app, no global installs required |
| **III. Config** | All config via environment variables, `.env.example` as template |
| **IV. Backing services** | MongoDB and MySQL treated as attached resources via `MONGO_URI` / `DB_HOST` |
| **V. Build, release, run** | Docker multi-stage separates build from run; env injected at runtime not bake-time |
| **VI. Processes** | Stateless Node process; sessions stored in DB, uploads on named volume |
| **VII. Port binding** | App exports via `PORT` env; nginx binds externally |
| **VIII. Concurrency** | Scale by running multiple backend containers behind a load balancer |
| **IX. Disposability** | SIGTERM/SIGINT handlers drain connections before exit |
| **X. Dev/prod parity** | Same Docker images in both; `docker-compose.dev.yml` mirrors prod topology |
| **XI. Logs** | Logs written to stdout/stderr; Docker captures and streams them |
| **XII. Admin processes** | Token refresh runs as a cron job inside the same process; DB migrations would run as one-off containers |
