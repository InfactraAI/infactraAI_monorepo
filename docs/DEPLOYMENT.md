# Deploying to EC2

Single-instance deployment: Docker Compose, automatic HTTPS via Caddy, MongoDB
in a container with an authenticated user and a named volume.

```
DNS  app.yourdomain.com ──► EC2 elastic IP
                              │
                      caddy :80 :443        automatic Let's Encrypt
                              │
                      frontend :80          nginx — SPA + API proxy
                              │
                      backend :3000         Express
                              │
                      mongodb               internal only, authenticated
```

---

## Before you start

**A real domain is not optional.** Google rejects OAuth redirect URIs that use
plain `http://` or a bare IP address, for anything other than `localhost`. Without
a DNS name and TLS, the Google Sheets connector cannot work in production.

**Instance size.** The Angular production build runs inside Docker and is
memory-hungry.

| Instance | Verdict |
|---|---|
| t3.micro (1 GB) | Build gets OOM-killed |
| t3.small (2 GB) | Works with swap; slow |
| **t3.medium (4 GB)** | **Recommended** |

Alternatively build images locally, push to ECR, and run a smaller instance.

---

## 1. Launch the instance

Amazon Linux 2023 or Ubuntu 22.04+, 20 GB gp3 root volume.

Security group inbound:

| Port | Source | Why |
|---|---|---|
| 22 | your IP only | SSH |
| 80 | 0.0.0.0/0 | HTTP, and Let's Encrypt's challenge |
| 443 | 0.0.0.0/0 | HTTPS |

Attach an **elastic IP** so the address survives a stop/start — otherwise your
DNS record and Google redirect URI both break on the next reboot.

Do **not** open 27017. Mongo is only reachable on the Docker network.

## 2. Hostname

You need a DNS name, not a bare IP — Google refuses OAuth redirect URIs on raw
addresses. There are two ways to get one.

### Option A — no domain purchase (POC / demo)

`sslip.io` is a public wildcard DNS service that resolves any IP encoded in the
hostname. Take your elastic IP, replace the dots with dashes, append `.sslip.io`:

```
elastic IP   13.234.56.78
APP_DOMAIN   13-234-56-78.sslip.io
```

Nothing else changes. Caddy obtains a real Let's Encrypt certificate for it, the
URL is publicly shareable, and Google accepts it as a redirect URI. Because the
name is derived from your elastic IP it stays stable across reboots.

> **One risk.** `sslip.io` is not on the Public Suffix List, so every user of it
> shares a single Let's Encrypt quota of 50 certificates per week. If that quota
> is exhausted when you deploy, certificate issuance fails and there is nothing
> you can do but wait or switch to Option B. It usually works; it is not
> guaranteed. Check Caddy's logs for `certificate obtained successfully`.

### Option B — a real domain

Register one (roughly ₹800/year), add an `A` record pointing at the elastic IP,
and set `APP_DOMAIN` to it. No caveats, and it is what you will need for real
customers anyway.

Either way, confirm it resolves to your instance before continuing — Caddy
cannot get a certificate until it does:

```bash
dig +short <your APP_DOMAIN>
```

## 3. Install Docker

```bash
sudo dnf install -y docker git && sudo systemctl enable --now docker && sudo usermod -aG docker $USER
```

Then install the compose plugin:

```bash
sudo mkdir -p /usr/local/lib/docker/cli-plugins && sudo curl -SL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-$(uname -m)" -o /usr/local/lib/docker/cli-plugins/docker-compose && sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
```

Log out and back in for the group change to apply.

## 4. Clone and configure

```bash
git clone <your-repo-url> infactra && cd infactra
```

Two env files, deliberately separate:

**`.env`** at the repo root — deployment settings read by compose:

```bash
cp .env.prod.example .env
```

Set `APP_DOMAIN` and a long random `MONGO_PASSWORD`.

**`apps/api/.env`** — application settings:

```bash
cp .env.example apps/api/.env
```

Generate the two secrets with `openssl rand -hex 32` and set `JWT_SECRET` and
`CRYPTO_SECRET`. Leave `MONGO_URI`, `FRONTEND_URL`, `API_BASE_URL` and both
redirect URIs alone — compose overrides them from `APP_DOMAIN`.

> `CRYPTO_SECRET` encrypts stored OAuth tokens. If it changes later, every
> existing connection becomes undecryptable and users must reconnect. Set it
> once and back it up.

## 5. Register the production redirect URIs

In the Google Cloud console → **Credentials** → your OAuth client, add:

```
https://app.yourdomain.com/google/callback
```

Keep the localhost entry alongside it — one client serves every environment.
Do the same for Azure if you use OneDrive, with `/onedrive/callback`.

While the consent screen is in **Testing**, only listed test users can connect.
Publish it to let real customers in.

## 6. Start

```bash
make prod-build
```

First run takes several minutes — it builds the Angular bundle and obtains a
certificate. Watch it:

```bash
make prod-logs
```

Caddy logs `certificate obtained successfully` once TLS is live.

## 7. Create the first organisation

**Fresh install** — register through the UI at `https://app.yourdomain.com`, or
seed demo organisations:

```bash
make prod-seed
```

**Migrating existing data** — dry run first:

```bash
make prod-migrate-dry
```

then apply:

```bash
make prod-migrate
```

## 8. Verify

```bash
curl -sI https://app.yourdomain.com | head -1 && curl -s https://app.yourdomain.com/health
```

Expect `HTTP/2 200` and `{"status":"ok"}`. Then sign in and check
**Configuration → Google Sheets** reports itself configured.

---

## Operating notes

**Updating.** `git pull && make prod-build` rebuilds and restarts. Data survives
in named volumes.

**Backups.** Everything durable is in three volumes: `mongo_data`,
`uploads_data`, `caddy_data`. Dump Mongo on a schedule:

```bash
docker compose exec -T mongodb mongodump --archive --username "$MONGO_USER" --password "$MONGO_PASSWORD" --authenticationDatabase admin > backup-$(date +%F).archive
```

Losing `caddy_data` only costs you a re-issued certificate; losing `mongo_data`
costs you everything.

**Logs** are capped at 10 MB × 3 files per container. Unbounded Docker logs
filling the root volume is the most common way a small instance dies.

**Mongo credentials** are applied only when the data volume is first created.
Changing `MONGO_PASSWORD` afterwards requires updating the user inside `mongosh`
— compose alone will not do it.

---

## Security posture

In place:

- HTTPS with automatic renewal; HSTS and hardening headers
- Mongo authenticated and unreachable from outside the Docker network
- `helmet` security headers on the API
- Rate limiting: 10 failed auth attempts / 15 min per IP, 30 invitations / hour,
  300 requests / min overall. `TRUST_PROXY_HOPS=2` makes client IPs accurate
  behind Caddy and nginx — without it every request looks like it came from the
  proxy and one attacker would exhaust everyone's allowance
- OAuth tokens encrypted at rest; client secrets never leave the server
- Tenant scope taken from the JWT, never from a request parameter

Still outstanding:

- No WAF or DDoS protection — consider CloudFront or ALB in front
- Single instance, so deploys mean brief downtime and there is no failover
- Uploads have no type or size limit and are served back from `/uploads`
- `POST /tally/connect` accepts an arbitrary host and port, letting an
  authenticated user probe the container network
- `xlsx@0.18.5` carries unpatched advisories on the npm-published line
- No error tracking or uptime monitoring

---

## Troubleshooting

| Symptom | Cause |
|---|---|
| Caddy loops on certificate errors | DNS not resolving yet, or 80/443 blocked. Check `dig` and the security group |
| `too many certificates already issued` | sslip.io's shared Let's Encrypt quota is exhausted. Wait, or move to a real domain |
| `redirect_uri_mismatch` from Google | The console URI must match `https://APP_DOMAIN/google/callback` exactly — no trailing slash |
| Build killed mid-`ng build` | Out of memory. Use t3.medium or add swap |
| `Session predates organisations` | Expected once after the multi-tenant change. Sign in again |
| Sheets screen says not configured | `GOOGLE_*` missing from `apps/api/.env`, or backend not restarted |
| Everything 429s | Rate limit with wrong client IPs. Confirm `TRUST_PROXY_HOPS=2` |
