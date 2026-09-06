# Infactra

Financial intelligence platform for finance teams. Connects Tally ERP, Google Sheets and
OneDrive Excel files into unified dashboards — MIS, Inventory, Reconciliation and HR analytics.

Multi-tenant: many organisations run on one deployment, each seeing only its own data.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Angular 20 · Angular Material · Chart.js |
| Backend | Node.js 22 · Express 4 · JWT auth |
| Database | MongoDB 7 (Mongoose) |
| File storage | Local disk (`uploads/`) via Multer |
| Integrations | Google Sheets (OAuth2 · Picker) · Microsoft OneDrive (Graph API · OAuth2) · Tally ERP (XML/HTTP) |
| Serving | nginx (SPA + API reverse proxy) |
| Orchestration | Docker Compose · Make |

---

## Quickstart

### Prerequisites

- Docker Desktop ≥ 4.x
- Make

### 1. Configure

```bash
cp .env.example apps/api/.env
```

Fill in at minimum `JWT_SECRET` and `CRYPTO_SECRET`. Generate both with:

```bash
openssl rand -hex 32
```

Everything else is optional — the app runs without email or any integration
configured, and each screen explains what is missing.

### 2. Start

```bash
make dev
```

One command starts MongoDB, the API, the Angular dev server and nginx.
The app is on **http://localhost**.

### 3. Create your first organisation

Either register through the UI (**Create account**), or seed two demo
organisations to see tenant isolation immediately:

```bash
make seed
```

| Organisation | Email | Password |
|---|---|---|
| Acme Exports Pvt Ltd | `admin@acme.test` | `Admin@123` |
| Acme Exports Pvt Ltd | `analyst@acme.test` | `User@123` |
| Northwind Traders | `admin@northwind.test` | `Admin@123` |

Sign in as each to confirm they see entirely separate data.

---

## Multi-tenancy

An **Organization** is the tenant. Every user belongs to exactly one, and every
record — datasets, integrations, branding — is scoped to it.

```
Organization  (name, logo, owner)
  ├── Users            one per person, role USER or ADMIN
  ├── FileData         imported rows, keyed {orgId, department}
  ├── GoogleConnection one Google account per org
  ├── UserToken        one OneDrive connection set per org
  └── Invitations      pending invites
```

**How isolation is enforced.** Registration creates an organisation and its owner.
Login mints a JWT carrying `orgId`. The `authenticate` middleware pins that to
`req.orgId`, and every query filters on it. No controller reads an organisation or
user id from a query string or request body, so changing a value in the URL cannot
reach another tenant's data.

Tokens issued before organisations existed carry no `orgId` and are rejected.

### Growing a team

An admin invites by email from **Team**. The invitee gets a link, sets their own
password, and lands signed in. Invitations are single-use, expire after 7 days, and
only the SHA-256 hash of the token is stored — the raw value exists solely in the link.

If SMTP is not configured, the API returns the invite link for the admin to share
manually, so the flow works without email.

---

## Data sources

| Source | Status | How it connects |
|---|---|---|
| **Google Sheets** | Working | OAuth + Google Picker. Two clicks, no credentials. |
| **OneDrive** | Working | OAuth. Reads the first workbook in a folder named after the department. |
| **Tally ERP** | Connection test only | XML over HTTP to a running Tally instance. |
| Others (BigQuery, Zoho, Salesforce, …) | Not implemented | Placeholder cards in Configuration. |

Imported rows land in `FileData` under a **department** (`inventory` or `hr`).
A department holds one dataset at a time — importing replaces what was there,
whichever source it came from.

### Setting up Google Sheets

One Google Cloud project serves the whole install. Users never handle a credential.

1. Create a project at [console.cloud.google.com](https://console.cloud.google.com)
2. Enable the **Google Sheets API** and the **Google Picker API**
3. Configure the OAuth consent screen (External is fine for testing)
4. Create an **OAuth client ID** → Web application
   - Authorised redirect URI: `http://localhost/google/callback`
5. Create an **API key** (used by the Picker)
6. Note your **project number** from the dashboard
7. Add to `apps/api/.env`:

```
GOOGLE_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost/google/callback
GOOGLE_API_KEY=...
GOOGLE_PROJECT_NUMBER=...
```

Restart the backend. **Configuration → Google Sheets** will now offer Connect.

The app requests the `drive.file` scope, which grants access only to files the user
explicitly picks. It is not a Google *restricted* scope, so no third-party security
assessment is required to ship it.

### Setting up OneDrive

Register an app in Azure, then set `CLIENT_ID`, `CLIENT_SECRET` and
`REDIRECT_URI=http://localhost/onedrive/callback`. As with Google, this is one
app for the whole install.

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
make clean          Remove containers, volumes and local images

make seed           Create demo organisations
make seed-fresh     Wipe users/orgs, then seed

make shell-be       sh into backend container
make shell-fe       sh into frontend container
make shell-db       mongosh into MongoDB

make install        npm install both apps (local dev without Docker)
```

---

## Migrating an existing install

If you have a database from before organisations existed, back it up, then:

```bash
cd apps/api
npm run migrate:dry
```

then apply it:

```bash
cd apps/api && npm run migrate
```

The migration folds all existing data into one organisation built from your old
`Company` record, backfills `orgId` everywhere, and replaces two stale unique
indexes. It is idempotent, so re-running is safe.

A **fresh** install does not need this — just `make seed` or register in the UI.

---

## Ports

Only nginx is published. Everything else talks over the internal Docker network.

| Mode | Service | URL |
|---|---|---|
| Dev | nginx → Angular dev server + API | `http://localhost` |
| Prod | nginx → built SPA + API | `http://localhost` |

nginx proxies `/auth`, `/company`, `/org`, `/google`, `/onedrive`, `/tally`,
`/uploads` and `/health` to the backend; everything else falls through to the SPA.

---

## API

Base URL: `http://localhost`

All endpoints require `Authorization: Bearer <jwt>` **except** those marked *public*.
The organisation is always read from the token, never from a parameter.

See [`docs/postman_collection.json`](docs/postman_collection.json) for a ready-to-use collection.

### Auth

| Method | Path | Description |
|---|---|---|
| `POST` | `/auth/register` | *Public.* Create an organisation and its first admin |
| `POST` | `/auth/login` | *Public.* Returns JWT + organisation |
| `POST` | `/auth/forgotPassword` | *Public.* Send reset link |
| `POST` | `/auth/resetPassword` | *Public.* Reset using token |

### Organisation & team

| Method | Path | Description |
|---|---|---|
| `GET` | `/org/members` | Members + pending invitations |
| `POST` | `/org/invites` | *Admin.* Invite by email |
| `POST` | `/org/invites/:id/resend` | *Admin.* Reissue the link |
| `DELETE` | `/org/invites/:id` | *Admin.* Revoke |
| `PATCH` | `/org/members/:id/role` | *Admin.* Set USER or ADMIN |
| `DELETE` | `/org/members/:id` | *Admin.* Remove a member |
| `GET` | `/org/invites/lookup?token=` | *Public.* Describe an invitation |
| `POST` | `/org/invites/accept` | *Public.* Accept; returns a JWT |

### Company profile

| Method | Path | Description |
|---|---|---|
| `GET` | `/company/profile` | Your organisation's name and logo |
| `POST` | `/company/update` | Update name / logo |
| `POST` | `/company/upload-logo` | Upload logo (`multipart/form-data`) |

### Google Sheets

| Method | Path | Description |
|---|---|---|
| `GET` | `/google/status` | Configured? connected? which sheets? |
| `GET` | `/google/auth-url` | Consent URL to navigate to |
| `GET` | `/google/callback` | *Public.* Google redirects here |
| `GET` | `/google/picker-config` | Short-lived token + keys for the Picker |
| `GET` | `/google/spreadsheets/:id/tabs` | Worksheet tabs |
| `POST` | `/google/sheets` | Import a sheet into a department |
| `POST` | `/google/sheets/:id/sync` | Re-pull |
| `DELETE` | `/google/sheets/:id` | Stop syncing, clear the data |
| `DELETE` | `/google/disconnect` | Revoke and forget the account |

### OneDrive

| Method | Path | Description |
|---|---|---|
| `GET` | `/onedrive/login?department=` | Consent URL to navigate to |
| `GET` | `/onedrive/callback` | *Public.* Microsoft redirects here |
| `GET` | `/onedrive/getOneDrives` | Connected accounts |
| `GET` | `/onedrive/files?department=` | Sync Excel → MongoDB |
| `GET` | `/onedrive/getExcelInventoryHrData?department=` | Read imported rows |
| `GET` | `/onedrive/download/:id?accountId=` | Stream a file |

### Tally

| Method | Path | Description |
|---|---|---|
| `POST` | `/tally/connect` | Test connection to a Tally instance |

### Health

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | *Public.* `{ status: "ok" }` |

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `JWT_SECRET` | **Yes** | Signs JWTs and OAuth state tokens |
| `CRYPTO_SECRET` | **Yes** | AES key for OAuth tokens at rest. Falls back to a known default if unset — set it |
| `MONGO_URI` | **Yes** | MongoDB connection string (compose overrides this) |
| `FRONTEND_URL` | **Yes** | CORS origin and the target for OAuth/email redirects |
| `API_BASE_URL` | **Yes** | Public base URL, used to build upload URLs |
| `PORT` | No | API port (default `3000`) |
| `EMAIL_USER` / `EMAIL_PASS` | No | Gmail address + **app password**. Without these, invites return a shareable link instead |
| `GOOGLE_CLIENT_ID` | No | Google OAuth client. Without it, the Sheets screen explains what's missing |
| `GOOGLE_CLIENT_SECRET` | No | Google OAuth secret |
| `GOOGLE_REDIRECT_URI` | No | Must match the URI registered in Google Cloud |
| `GOOGLE_API_KEY` | No | Browser key for the Picker |
| `GOOGLE_PROJECT_NUMBER` | No | GCP project number, required by the Picker for `drive.file` |
| `CLIENT_ID` / `CLIENT_SECRET` | No | Azure app for OneDrive |
| `TENANT_ID` | No | Azure tenant (default `common`) |
| `REDIRECT_URI` | No | OneDrive OAuth callback |
| `DB_*` | No | MySQL settings. Nothing reads these — see Known issues |

---

## Development without Docker

```bash
make install
```

Then, with Mongo running locally, in one terminal:

```bash
cd apps/api && npm run dev
```

and in another:

```bash
cd apps/web && npx ng serve
```

Without nginx the frontend serves on `:4200` and the API on `:3000`, so set
`API_URL` in `src/environments/environment.ts` to `http://localhost:3000`.

---

## Known issues

- **`make prod` fails to build.** `dashboard.less` is 9.46 kB against an 8 kB
  `anyComponentStyle` budget in `angular.json`, which fails the production build and
  therefore the frontend Docker image. Either raise the budget or trim the file.
- **MySQL is unused.** Both compose files start MySQL 8 and gate backend startup on
  its health, but no code connects to it and there is no driver in `package.json`.
- **Several screens are static.** Dashboard, MIS and Reconciliation render hardcoded
  figures. Ask AI matches questions with regexes and generates chart data randomly —
  there is no model behind it.
- **HR discards its data.** `hr.ts` fetches from OneDrive and then throws the result
  away; the attendance and salary grids are backed by browser `localStorage`.
- **Inherited branding.** The page title, favicon and some table contents still carry
  names from earlier deployments.
