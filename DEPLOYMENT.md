# Deployment Guide

This covers deploying Claim App to any server or cloud VM using Docker. It applies regardless of
provider — for provider-specific managed services (ECS, Cloud Run, Container Apps, etc.) see
[CLOUD_DEPLOYMENT.md](CLOUD_DEPLOYMENT.md). For fronting the app with Nginx Proxy Manager
specifically, see [NGINX_PROXY_MANAGER.md](NGINX_PROXY_MANAGER.md).

## Architecture

```
                    ┌────────────────────┐
 Internet ── HTTPS ─▶  reverse proxy      │   (Nginx Proxy Manager, Caddy, Traefik, or your
                    │  (not included)     │    cloud provider's load balancer / ingress)
                    └─────────┬──────────┘
                              │ HTTP, port 80
                    ┌─────────▼──────────┐
                    │  client container   │   nginx serving the built React app;
                    │  (port 80 internal) │   proxies /api and /uploads to `server`
                    └─────────┬──────────┘
                              │
                    ┌─────────▼──────────┐
                    │  server container   │   Node/Express API (port 4000 internal)
                    └─────────┬──────────┘
                              │
                    ┌─────────▼──────────┐        ┌──────────────────────┐
                    │  db (Postgres)      │        │  S3-compatible object │
                    │                      │        │  storage (optional)   │ ◀── claim attachments,
                    └────────────────────┘        └──────────────────────┘     branding logo
```

Only the `client` container needs to be reachable from your reverse proxy — it proxies API and
file requests to `server` internally, so the app is a single origin from the browser's
perspective (no CORS configuration needed in production).

## 1. Prerequisites

- Docker Engine 24+ and Docker Compose v2 (`docker compose version`)
- A Postgres 16 database — either the bundled `db` service, or a managed database (see
  [CLOUD_DEPLOYMENT.md](CLOUD_DEPLOYMENT.md))
- A domain name pointed at your server (for TLS)
- A reverse proxy that terminates TLS — this repo doesn't do TLS itself; see
  [NGINX_PROXY_MANAGER.md](NGINX_PROXY_MANAGER.md) or use your cloud provider's load balancer

## 2. Get the code onto the server

```bash
git clone <your-fork-or-repo-url> claim-app
cd claim-app
```

## 3. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env`:

| Variable | Required | Notes |
|---|---|---|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Yes (if using the bundled `db` service) | `POSTGRES_PASSWORD` has no default — the stack refuses to start without it |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | Yes | Generate with `openssl rand -base64 48`. Rotating either invalidates all sessions and any in-flight 2FA login challenges |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` | Recommended | Bootstraps the first admin account automatically on container start. See step 7 below |
| `STORAGE_DRIVER` | Yes | `local` (default) or `s3`. See [CLOUD_DEPLOYMENT.md](CLOUD_DEPLOYMENT.md) for `S3_*` variables |

If you're pointing at an external/managed Postgres instead of the bundled `db` service, remove
the `db` service from `docker-compose.prod.yml` and set `DATABASE_URL` directly in `.env`
instead of the `POSTGRES_*` variables (see [CLOUD_DEPLOYMENT.md](CLOUD_DEPLOYMENT.md) for
managed-database examples).

**Never commit `.env`.** It's already covered by `.gitignore`.

## 4. Create the shared proxy network

`docker-compose.prod.yml` expects an external Docker network named `proxy` that your reverse
proxy is also attached to, so it can reach the `client` container by name:

```bash
docker network create proxy
```

(If you're using Nginx Proxy Manager, attach its stack to this same network — see
[NGINX_PROXY_MANAGER.md](NGINX_PROXY_MANAGER.md).)

## 5. Build and start

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

This builds the `server` (Node/Express API) and `client` (static React app served by nginx)
images, starts Postgres, and runs database migrations automatically on `server` startup
(`prisma migrate deploy` — safe to run every restart; it's a no-op when already up to date).

Check it's healthy:

```bash
docker compose -f docker-compose.prod.yml logs -f server
# look for: "claim-app server listening on port 4000"

docker network connect proxy <your-reverse-proxy-container> # if not already attached
```

## 6. Point your reverse proxy at the `client` container

The `client` container listens on port 80 inside the `proxy` network under the name
`claimapp-prod-client-1` (or `<project>-client-1` if you changed the compose project name).
Configure your reverse proxy to forward your domain to that container on port 80. See
[NGINX_PROXY_MANAGER.md](NGINX_PROXY_MANAGER.md) for exact steps if you're using NPM.

## 7. Create your first admin user

The seed script (`npm run seed`) is meant for local development — it creates known
`password123` accounts, which you do **not** want in production.

Instead, set `ADMIN_EMAIL` and `ADMIN_PASSWORD` (and optionally `ADMIN_NAME`) in `.env` before
first starting the stack. The `server` container bootstraps that account as `ADMIN` automatically
on every start — including the very first one — so it's ready to log into as soon as
`docker compose -f docker-compose.prod.yml up -d --build` finishes. Check
`docker compose -f docker-compose.prod.yml logs server` for a line like
`Bootstrap: created ADMIN account admin@example.com.` to confirm it ran.

This is idempotent and safe to leave in `.env` indefinitely: it only creates the account once,
and won't overwrite the password if you change it later through the app. If the account already
exists with a different role, it's promoted to `ADMIN` instead of recreated.

From there, use the Users page (as the admin you just logged in as) to create everyone else
properly instead of writing more accounts by hand.

**If you forgot to set `ADMIN_EMAIL`/`ADMIN_PASSWORD` before first deploying**, add them to
`.env` and re-run `docker compose -f docker-compose.prod.yml up -d` — the bootstrap runs on every
container start, so this fixes it without a rebuild. Alternatively, register an account through
the running app (defaults to `EMPLOYEE`) and promote it manually:

```bash
docker compose -f docker-compose.prod.yml exec db \
  psql -U claimapp -d claimapp \
  -c "UPDATE \"User\" SET role = 'ADMIN' WHERE email = 'you@example.com';"
```
(substitute your actual `POSTGRES_USER`/`POSTGRES_DB` if you changed them from the `claimapp`
defaults — `$POSTGRES_USER`/`$POSTGRES_DB` won't expand correctly here since those live in
`.env`, which Compose reads but your shell doesn't, unless you first run
`set -a; source .env; set +a`)

## Environment variable reference

### Server (`server/.env.example`)

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | — | Postgres connection string |
| `JWT_SECRET` | — | Signs access tokens (and 2FA login-challenge tokens) |
| `JWT_REFRESH_SECRET` | — | Signs refresh tokens |
| `PORT` | `4000` | API port |
| `STORAGE_DRIVER` | `local` | `local` or `s3` |
| `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_FORCE_PATH_STYLE`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_BASE_URL`, `S3_PRESIGN_EXPIRY_SECONDS` | — | Only used when `STORAGE_DRIVER=s3` — see [CLOUD_DEPLOYMENT.md](CLOUD_DEPLOYMENT.md) |

SMTP (for email alerts) and application branding are **not** environment variables — they're
configured at runtime from the Admin UI (Email Settings / Branding pages) and stored in the
database, so they survive redeploys without touching `.env`.

## Updating to a new version

```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

Migrations run automatically on `server` container start. If a migration is destructive or
you want to review it first, run it manually before deploying the new image:

```bash
docker compose -f docker-compose.prod.yml run --rm server npx prisma migrate deploy
```

## Backups

**Database:**
```bash
docker compose -f docker-compose.prod.yml exec db \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > backup-$(date +%F).sql.gz
```
Restore with `gunzip -c backup-*.sql.gz | docker compose -f docker-compose.prod.yml exec -T db psql -U "$POSTGRES_USER" "$POSTGRES_DB"`.

**Uploaded files:**
- If `STORAGE_DRIVER=local`: back up the `claimapp-prod_claimapp_uploads` Docker volume (e.g. `docker run --rm -v claimapp-prod_claimapp_uploads:/data -v $(pwd):/backup alpine tar czf /backup/uploads-$(date +%F).tar.gz /data`).
- If `STORAGE_DRIVER=s3`: rely on your bucket provider's versioning/replication (recommended — see [CLOUD_DEPLOYMENT.md](CLOUD_DEPLOYMENT.md)).

Automate both on a schedule (cron, systemd timer, or your cloud provider's snapshot feature).

## Production checklist

- [ ] `JWT_SECRET` / `JWT_REFRESH_SECRET` are long, random, and not the values from `.env.example`
- [ ] `POSTGRES_PASSWORD` is strong and not reused elsewhere
- [ ] TLS is terminated in front of the app (see [NGINX_PROXY_MANAGER.md](NGINX_PROXY_MANAGER.md)) — don't expose port 4000 or 80 directly to the internet
- [ ] The bundled `db` service (or your managed database) is **not** exposed on a public port
- [ ] The seeded `password123` demo accounts are not present (don't run `npm run seed` in production)
- [ ] Database backups are scheduled and you've tested a restore at least once
- [ ] Email alerts are configured (Admin → Email Settings) if you want submit/approve/reject notifications
- [ ] `STORAGE_DRIVER=s3` if you're running more than one `server` replica or on ephemeral/stateless compute (local disk storage is not shared across instances) — see [CLOUD_DEPLOYMENT.md](CLOUD_DEPLOYMENT.md)

## Running without Docker

If you'd rather run the processes directly on a VM:

```bash
# Server
cd server
npm ci --omit=dev
npx prisma generate
npx prisma migrate deploy
npm run build
NODE_ENV=production node dist/index.js   # set env vars beforehand (DATABASE_URL, JWT_SECRET, ...)

# Client — build once, serve the static output with any web server (nginx, Caddy, etc.)
cd client
npm ci
npm run build   # outputs to client/dist
```

Serve `client/dist` with a web server that proxies `/api/*` and `/uploads/*` to the `server`
process (same as `client/nginx.conf` does) and falls back unmatched routes to `index.html` for
client-side routing. Use a process manager (systemd, pm2) to keep `server` running and restart
it on crash/reboot.
