# Architecture

## System overview

```
┌──────────────────────────────────────────────────────────────────┐
│  Browser — Angular 20 SPA                                        │
│                                                                  │
│  ┌──────────┐ ┌──────────┐ ┌────────┐ ┌────────────────────┐   │
│  │Dashboard │ │  MIS     │ │  Team  │ │  Configuration     │   │
│  │Inventory │ │Reconcil. │ │ Ask AI │ │  Sheets/OneDrive   │   │
│  └──────────┘ └──────────┘ └────────┘ └────────────────────┘   │
│        │                                                         │
│  authGuard ── keeps the shell behind a token                    │
│  authInterceptor ── attaches Authorization: Bearer <jwt>        │
└────────────────────┬─────────────────────────────────────────────┘
                     │ HTTP/JSON — same origin, port 80
┌────────────────────▼─────────────────────────────────────────────┐
│  nginx                                                           │
│  ├── ^/(auth|company|org|google|onedrive|tally|uploads|health)(/|$)
│  │      → proxy → backend:3000                                   │
│  └── everything else → SPA (dev: proxy :4200, prod: static dist) │
└────────────────────┬─────────────────────────────────────────────┘
                     │
┌────────────────────▼─────────────────────────────────────────────┐
│  Express API                                                     │
│                                                                  │
│  middleware/                                                     │
│  ├── authenticate    verifies JWT → req.userId, req.orgId       │
│  ├── requireAdmin    gates organisation administration           │
│  └── errorHandler    central error → JSON                        │
│                                                                  │
│  modules/                                                        │
│  ├── auth        register (creates org) · login · reset          │
│  ├── org         members · invitations                           │
│  ├── company     organisation name + logo                        │
│  ├── google      OAuth · Picker · Sheets import                  │
│  ├── onedrive    OAuth · Excel import                            │
│  └── tally       XML connection test                             │
│                                                                  │
│  utils/                                                          │
│  ├── oauthState   signs/verifies short-lived OAuth state         │
│  ├── googleAuth   Google token exchange + refresh                │
│  ├── token        OneDrive token refresh                         │
│  ├── sheetsParser Sheets API → { columns, data }                 │
│  ├── fileParser   Excel → rows                                   │
│  ├── crypto       AES-256-CBC for tokens at rest                 │
│  └── mailer       best-effort SMTP, never throws                 │
│                                                                  │
│  jobs/tokenRefresh — cron every 5 min, refreshes OneDrive tokens │
└──────────────────────────┬───────────────────────────────────────┘
                           │
                  ┌────────▼────────┐    ┌──────────────────────┐
                  │   MongoDB 7     │    │  External services   │
                  │                 │    │                      │
                  │ Organizations   │    │  Google              │
                  │ Users           │    │  ├─ OAuth2           │
                  │ Invitations     │    │  ├─ Picker           │
                  │ FileData        │    │  └─ Sheets API       │
                  │ GoogleConnection│    │  Microsoft Graph     │
                  │ UserTokens      │    │  Tally ERP (XML)     │
                  └─────────────────┘    │  Gmail SMTP          │
                                         └──────────────────────┘
```

---

## Tenancy

An **Organization** is the tenant. Isolation rests on one rule:

> The organisation is read from the JWT and nowhere else.

```
register  →  Organization created, first user becomes ADMIN + owner
login     →  jwt.sign({ id, role, orgId })
request   →  authenticate verifies → req.orgId
query     →  Model.find({ orgId: req.orgId, … })
```

No controller reads an org or user id from a query string, body or header, so
altering a URL cannot reach another tenant's data. `authenticate` also rejects
tokens minted before organisations existed, since those carry no `orgId`.

### Scoping by collection

| Collection | Scope key | Notes |
|---|---|---|
| `Organization` | `_id` | The tenant itself |
| `User` | `orgId` | Email is unique install-wide — one account, one org |
| `Invitation` | `orgId` | Unique per `{orgId, email}` while pending |
| `FileData` | `{orgId, department}` | Unique `{orgId, fileName}` |
| `GoogleConnection` | `orgId` (unique) | One Google account per org |
| `UserToken` | `orgId` (unique) | OneDrive; `userId` records who authorised |

Connections belong to the organisation rather than the person, so a colleague
can sync data a teammate connected.

---

## Request lifecycle

```
Browser
  │  authInterceptor adds Authorization: Bearer <jwt>
  ▼
nginx  — path matches an API prefix? proxy : serve SPA
  ▼
authenticate  — jwt.verify → req.userId, req.userRole, req.orgId
  ▼                                    (401 if missing/invalid/no orgId)
requireAdmin  — only on org-management routes  (403 if not ADMIN)
  ▼
controller  — every query filtered by req.orgId
  ▼
JSON response
```

---

## OAuth: why state carries identity

Both integrations navigate the browser away to a consent screen, which drops the
`Authorization` header. Rather than pass a user id in the URL — forgeable, and the
source of the original cross-tenant hole — the API mints a short-lived signed
state token.

```
GET /google/auth-url          (authenticated)
  │  state = jwt.sign({ orgId, uid, purpose }, JWT_SECRET, 10m)
  │  → { url }
  ▼
SPA sets window.location = url
  ▼
Google consent  — user approves drive.file
  ▼
GET /google/callback?code=&state=      (public — no header possible)
  │  oauthState.verify('google-oauth', state) → { orgId, uid }
  │  exchange code → access + refresh tokens
  │  encrypt(tokens) → GoogleConnection { orgId }
  ▼
redirect → /google-sheets-config?google=connected
```

`purpose` prevents a state token from one flow being replayed into another.
The same shape backs OneDrive, keyed `onedrive-oauth`.

### Google Sheets import

```
GET /google/picker-config
  │  → { clientId, apiKey, appId, accessToken }   short-lived
  ▼
google.picker  — user picks a spreadsheet
  │  setAppId grants this app drive.file access to that one file
  ▼
GET /google/spreadsheets/:id/tabs
  │  one tab  → import straight away
  │  several  → ask which
  ▼
POST /google/sheets { spreadsheetId, department, sheetName }
  │  Sheets API values → row 1 becomes columns
  │  blank headers → "Column N", duplicates → suffixed
  │  FileData.deleteMany({ orgId, department })  then create
  ▼
Inventory screen renders res.columns / res.data
```

### Token refresh

Refresh credentials come from platform env, so refresh cannot fail for want of
per-tenant config.

```
Google    on demand — getValidAccessToken(orgId) refreshes inside a 5-min buffer
          invalid_grant → clear tokens, ask the user to reconnect

OneDrive  cron every 5 min — refresh any drive expiring within 5 min
          failures clear the access token and are persisted
```

`access_type=offline&prompt=consent` guarantees Google returns a refresh token
on every connect; without it one only arrives on first authorisation.

---

## Invitations

```
POST /org/invites            (ADMIN)
  │  token = randomBytes(32);  store SHA-256(token) only
  │  email the link, or return it if SMTP is unconfigured
  ▼
GET /org/invites/lookup?token=      (public)
  │  → { organizationName, email, role }
  ▼
POST /org/invites/accept { token, name, password }      (public)
  │  create User { orgId: invite.orgId }
  │  mark invitation accepted  → token is now dead
  │  → JWT, so the invitee lands signed in
```

Guards: the owner cannot be demoted or removed; an organisation cannot be left
without an admin; an email that already has an account cannot be invited.

---

## Data models

```
Organization  _id, name, logo, ownerId, active, timestamps

User          _id, orgId, name, email (unique), mobile, password (bcrypt,
              select:false), role USER|ADMIN, address, active,
              resetOtp, resetOtpExpiry

Invitation    _id, orgId, email, role, tokenHash, invitedBy,
              status pending|accepted|revoked, expiresAt, acceptedAt

FileData      _id, orgId, department, fileType, fileName,
              columns[String], data[Mixed]
              index {orgId, department} · unique {orgId, fileName}

GoogleConnection  orgId (unique), connectedByUserId, googleAccountId, email,
                  accessToken*, refreshToken*, expiry, scope,
                  sheets[{ spreadsheetId, title, sheetName, department,
                           lastSyncedAt, lastSyncStatus, rowCount }]

UserToken     orgId (unique), userId,
              oneDrives[{ accountId, email, department,
                          accessToken*, refreshToken*, expiry, active }]

* encrypted at rest with AES-256-CBC (utils/crypto)
```

---

## Frontend structure

```
apps/web/src/app/
├── core/
│   ├── guards/auth.guard.ts          token present, or redirect to /login
│   ├── interceptors/auth.interceptor  attaches the JWT; 401 → sign out
│   └── services/                      auth · team · google-sheets · onedrive · logo
├── features/
│   ├── auth/                          login · register · forgot
│   │   └── accept-invite/             public invitation landing
│   ├── team/                          members, roles, invitations
│   ├── google-sheets/                 connect + Picker + imported sheets
│   ├── onedrive/                      connect per department
│   ├── inventory/                     renders FileData
│   ├── hr/                            attendance · salary (localStorage)
│   ├── dashboard/ mis/ reconciliation/  static figures
│   ├── configuration/                 data-source catalogue
│   └── tally/ ask-ai/
└── shared/components/                 navbar · logo-dialog
```

### Routing

```
/accept-invite            public — invitee has no account yet
/**                       LoginComponent (catch-all)

/  ── TopNavbar shell, canActivate: authGuard
   ├── dashboard · mis · inventory · reconciliation
   ├── hr-ai/{attendance,salary}
   ├── configuration · tally-config · one-drive-config · google-sheets-config
   ├── team
   └── ask-fireai
```

> nginx's API regex ends in `(/|$)` so SPA routes like `/google-sheets-config`
> and `/tally-config` are not swallowed by the `/google` and `/tally` prefixes.

---

## Infrastructure

Both stacks publish only nginx on `:80`.

```
docker-compose.dev.yml            docker-compose.yml
  nginx      :80                    frontend  :80   multi-stage build
  frontend   ng serve, hot reload              stage 1 node:22 → ng build
  backend    nodemon, ./apps/api mounted       stage 2 nginx:alpine
  mongodb    volume mongo_data_dev    backend   node server.js
  mysql      unused                  mongodb   volume mongo_data
                                     mysql     unused
```

`backend` waits on `service_healthy` for both databases. MySQL is started and
gated on but nothing connects to it — see Known issues in the README.

---

## Security posture

Addressed:

- Every non-public route is authenticated; the SPA attaches the token and guards its shell
- Tenant scope comes from the JWT, never a parameter
- OAuth tokens encrypted at rest; OAuth state signed and purpose-tagged
- Client secrets stay server-side — never in a URL, never in the browser
- Invitation tokens stored only as hashes; single-use with expiry
- Passwords bcrypt-hashed at cost 12 and never emailed

Outstanding:

- No rate limiting on login, registration, password reset or invitations
- No `helmet` or security headers
- `POST /tally/connect` takes an arbitrary host and port, so an authenticated
  user can probe the container's network
- Uploads have no type or size limit and are served back from `/uploads`
- `xlsx@0.18.5` carries unpatched advisories on the npm-published line
