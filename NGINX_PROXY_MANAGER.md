# Fronting Claim App with Nginx Proxy Manager

[Nginx Proxy Manager](https://nginxproxymanager.com/) (NPM) is a good fit here because Claim App
is already a single origin in production — the `client` container's nginx proxies `/api/*` and
`/uploads/*` to the `server` container internally, so NPM only ever needs to point at one thing:
the `client` container, port 80.

This assumes you've already followed [DEPLOYMENT.md](DEPLOYMENT.md) up through starting
`docker-compose.prod.yml`, and that your domain's DNS A/AAAA record already points at this
server's IP.

## 1. Put NPM and Claim App on the same Docker network

Claim App's `docker-compose.prod.yml` attaches `client` and `server` to an **external** network
named `proxy`. NPM needs to be on that same network to reach `client` by container name.

If you don't already have NPM running, here's a minimal `docker-compose.yml` for it that joins
the same network:

```yaml
services:
  npm:
    image: jc21/nginx-proxy-manager:latest
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
      - "81:81"     # NPM admin UI
    volumes:
      - npm_data:/data
      - npm_letsencrypt:/etc/letsencrypt
    networks:
      - proxy

volumes:
  npm_data:
  npm_letsencrypt:

networks:
  proxy:
    external: true
```

Create the shared network once (if Claim App hasn't already created it):
```bash
docker network create proxy
```

Then start NPM:
```bash
docker compose -f npm-compose.yml up -d
```

If you already run NPM elsewhere, just make sure its container is attached to the same `proxy`
network Claim App uses:
```bash
docker network connect proxy <your-npm-container-name>
```

## 2. Log into the NPM admin UI

Visit `http://<server-ip>:81` (default first-login credentials are printed in the NPM container
logs / documented on the NPM site — change them immediately).

## 3. Create the proxy host

**Hosts → Proxy Hosts → Add Proxy Host**

- **Domain Names**: `claims.yourcompany.com` (whatever you pointed DNS at)
- **Scheme**: `http`
- **Forward Hostname / IP**: `claimapp-prod-client-1` — the `client` container's name. If you
  changed the compose project name, it'll be `<project>-client-1`; check with `docker ps`.
- **Forward Port**: `80`
- **Cache Assets**: off (the app is a JWT-authenticated SPA with a JSON API; caching assets is
  fine but caching API responses is not — leave this off unless you know what you're doing)
- **Block Common Exploits**: on
- **Websockets Support**: off (not used by this app)

## 4. Increase the upload size limit

Claim attachments can be up to 10MB and branding logos up to 3MB. NPM's default nginx body size
limit is smaller than that. In the proxy host editor:

**Advanced tab** → add:
```nginx
client_max_body_size 15m;
```

## 5. Enable SSL

**SSL tab** (still in the proxy host editor):
- **SSL Certificate**: Request a new SSL Certificate
- Enable **Force SSL** and **HTTP/2 Support**
- Enable **Use a DNS Challenge** only if port 80 isn't reachable from the internet (e.g. behind
  another firewall); otherwise the default HTTP challenge is simpler and works out of the box
- Agree to the Let's Encrypt ToS and save

NPM will provision and auto-renew the certificate from here on.

## 6. Verify

```bash
curl -I https://claims.yourcompany.com/
curl -I https://claims.yourcompany.com/api/currency   # expect 401 (auth required) — confirms the proxy reaches the API
```

Open `https://claims.yourcompany.com` in a browser and log in.

## Troubleshooting

- **502 Bad Gateway**: the `client` container isn't reachable on the `proxy` network. Run
  `docker network inspect proxy` and confirm both the NPM container and `claimapp-prod-client-1`
  are listed. If `client` isn't there, re-run `docker compose -f docker-compose.prod.yml up -d`
  after confirming the `proxy` network already existed when you first started the stack (Compose
  won't retroactively attach a container to a network it wasn't started with — restart the
  `client` service if needed: `docker compose -f docker-compose.prod.yml up -d --force-recreate client`).
- **413 Request Entity Too Large** on attachment upload: you skipped step 4 (`client_max_body_size`).
- **Login works but attachments 404**: check `STORAGE_DRIVER` — if `s3`, confirm the bucket/credentials
  are correct (see [CLOUD_DEPLOYMENT.md](CLOUD_DEPLOYMENT.md)); if `local`, confirm the
  `claimapp-prod_claimapp_uploads` volume is mounted (`docker compose -f docker-compose.prod.yml config`
  to double check).
- **Emails aren't sending**: that's independent of NPM — check Admin → Email Settings → Send test
  email in the app itself.
