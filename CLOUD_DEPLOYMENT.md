# Cloud Deployment Guide

Provider-specific notes for running Claim App in the cloud. Read [DEPLOYMENT.md](DEPLOYMENT.md)
first — it covers the parts that are the same everywhere (env vars, migrations, backups,
production checklist). This doc covers what differs per provider: where to run the containers,
where to run Postgres, and where to store uploaded files.

Every section follows the same shape: **Compute** (where the containers run), **Database**
(managed Postgres), **Object storage** (for `STORAGE_DRIVER=s3`).

---

## Amazon Web Services (AWS)

**Compute — ECS Fargate (recommended) or a single EC2 instance**

- *Simplest*: one EC2 VM (t3.small or larger), install Docker, follow
  [DEPLOYMENT.md](DEPLOYMENT.md) as-is. Put an Application Load Balancer or Nginx Proxy Manager
  in front for TLS.
- *Managed*: push `server` and `client` images to ECR, run them as two ECS Fargate services
  behind an Application Load Balancer (ALB does the TLS termination and path routing instead of
  the bundled `client` nginx — point `/api/*` and `/uploads/*` ALB rules at the `server` service
  target group, everything else at `client`). Use Fargate's built-in health checks against
  `GET /health` on the server.

**Database — Amazon RDS for PostgreSQL**

1. Create an RDS Postgres 16 instance (private subnet, not publicly accessible).
2. Set `DATABASE_URL=postgresql://<user>:<password>@<rds-endpoint>:5432/<dbname>?sslmode=require`.
3. Remove the `db` service from `docker-compose.prod.yml` (or don't deploy it) since RDS replaces it.

**Object storage — S3** (this is what `STORAGE_DRIVER=s3` was built against first)

1. Create a bucket, e.g. `my-company-claim-app-uploads`. Keep it **private** (no public access) — the app generates short-lived presigned URLs on demand.
2. Create an IAM user (or an IAM role, if running on ECS/EC2) with a policy scoped to just this bucket:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Effect": "Allow",
       "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
       "Resource": "arn:aws:s3:::my-company-claim-app-uploads/*"
     }]
   }
   ```
3. Set:
   ```bash
   STORAGE_DRIVER=s3
   S3_BUCKET=my-company-claim-app-uploads
   S3_REGION=us-east-1
   # S3_ENDPOINT not needed for AWS
   S3_ACCESS_KEY_ID=...       # omit both if using an IAM role (recommended on ECS/EC2)
   S3_SECRET_ACCESS_KEY=...
   ```
   If running on ECS/EC2 with an attached IAM role, omit `S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY`
   entirely — the SDK picks up the role automatically.

---

## Microsoft Azure

**Compute — Azure Container Apps (recommended) or an Azure VM**

- *Managed*: push images to Azure Container Registry, deploy `server` and `client` as two
  Container Apps in the same Container Apps Environment (so they can reach each other by name).
  Container Apps gives you a managed HTTPS ingress for the `client` app automatically — you can
  skip Nginx Proxy Manager entirely if you use this.
- *Simplest*: an Azure VM running Docker, following [DEPLOYMENT.md](DEPLOYMENT.md) directly.

**Database — Azure Database for PostgreSQL (Flexible Server)**

1. Create a Flexible Server (Postgres 16), private access or firewall-restricted to your compute.
2. `DATABASE_URL=postgresql://<user>:<password>@<server-name>.postgres.database.azure.com:5432/<dbname>?sslmode=require`

**Object storage — Azure Blob Storage**

Azure Blob Storage does **not** speak the S3 API, so the built-in `s3` storage driver can't talk
to it directly. Two options, in order of recommendation:

1. **Easiest — run MinIO (or another S3 gateway) in front of Blob Storage**, or simply run a
   small MinIO instance as your object store instead of native Blob Storage (MinIO can itself be
   backed by Azure managed disks). Then use `STORAGE_DRIVER=s3` pointed at MinIO exactly as
   documented in the [MinIO section](#minio-self-hosted-s3-compatible) below. This is the path
   of least resistance if you want to stay within Azure infra but still use the existing adapter.
2. **Extend the app** — implement `StorageAdapter` (see `server/src/storage/types.ts`) with an
   `AzureBlobStorageAdapter` using `@azure/storage-blob`, and select it in
   `server/src/storage/index.ts` when `STORAGE_DRIVER=azure-blob`. The interface is intentionally
   small (`save`, `resolveUrl`, `delete`) — this is a half-day task, not a rewrite. Azure Blob's
   `generateBlobSASQueryParameters` is the direct equivalent of the S3 adapter's presigned URLs.

If you don't want to deal with either, `STORAGE_DRIVER=local` still works on Azure — mount an
[Azure Files](https://learn.microsoft.com/azure/storage/files/) share into the `server`
container's `/app/uploads` path so uploads survive container restarts/redeploys.

---

## Google Cloud Platform (GCP)

**Compute — Cloud Run (recommended) or a Compute Engine VM**

- *Managed*: push images to Artifact Registry, deploy `server` and `client` as two Cloud Run
  services. Cloud Run gives each service its own managed HTTPS URL — either point `client`'s
  nginx at the `server` service's Cloud Run URL (edit `client/nginx.conf`'s `proxy_pass` targets
  before building the image) or, simpler, put them both behind a single Cloud Load Balancer with
  URL-map rules (`/api/*`, `/uploads/*` → server; everything else → client).
- *Simplest*: a Compute Engine VM running Docker, following [DEPLOYMENT.md](DEPLOYMENT.md) directly.

**Database — Cloud SQL for PostgreSQL**

1. Create a Cloud SQL Postgres 16 instance.
2. Connect via the Cloud SQL Auth Proxy (recommended, especially from Cloud Run) or a private IP.
3. `DATABASE_URL=postgresql://<user>:<password>@<host-or-proxy>:5432/<dbname>`

**Object storage — Google Cloud Storage (GCS)**

GCS has a built-in **S3-compatible interoperability mode**, so the existing `s3` storage driver
works with it directly — no code changes needed:

1. Enable "Interoperability" for your GCS project: Cloud Storage → Settings → Interoperability →
   create an access key/secret pair (these are HMAC keys, distinct from your GCP service account
   keys).
2. Create a bucket, e.g. `my-company-claim-app-uploads`, keep it private.
3. Set:
   ```bash
   STORAGE_DRIVER=s3
   S3_BUCKET=my-company-claim-app-uploads
   S3_REGION=auto
   S3_ENDPOINT=https://storage.googleapis.com
   S3_FORCE_PATH_STYLE=false
   S3_ACCESS_KEY_ID=<GOOG HMAC access key>
   S3_SECRET_ACCESS_KEY=<GOOG HMAC secret>
   ```

---

## Generic VPS / DigitalOcean / Linode / Hetzner / any Docker host

This is the most direct path and exactly what [DEPLOYMENT.md](DEPLOYMENT.md) describes:

1. Spin up a VM (DigitalOcean Droplet, Linode instance, Hetzner Cloud server, etc.) with Docker installed.
2. Run the bundled `db` Postgres service from `docker-compose.prod.yml` — no managed database needed for small deployments (add your own backup cron job; see [DEPLOYMENT.md](DEPLOYMENT.md#backups)).
3. Front it with [Nginx Proxy Manager](NGINX_PROXY_MANAGER.md) for TLS.
4. For object storage, DigitalOcean Spaces / most VPS-adjacent providers speak the S3 API directly:

**DigitalOcean Spaces**
```bash
STORAGE_DRIVER=s3
S3_BUCKET=my-space-name
S3_REGION=nyc3                                  # your Space's region
S3_ENDPOINT=https://nyc3.digitaloceanspaces.com
S3_FORCE_PATH_STYLE=false
S3_ACCESS_KEY_ID=<Spaces access key>
S3_SECRET_ACCESS_KEY=<Spaces secret key>
```

**Cloudflare R2**
```bash
STORAGE_DRIVER=s3
S3_BUCKET=my-bucket
S3_REGION=auto
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
S3_FORCE_PATH_STYLE=true
S3_ACCESS_KEY_ID=<R2 access key>
S3_SECRET_ACCESS_KEY=<R2 secret key>
# Optional: if you've mapped a public R2.dev or custom domain to the bucket, set it to skip presigning:
# S3_PUBLIC_BASE_URL=https://uploads.yourcompany.com
```

**Backblaze B2 (S3-compatible API)**
```bash
STORAGE_DRIVER=s3
S3_BUCKET=my-bucket
S3_REGION=us-west-004                           # matches your B2 bucket's region code
S3_ENDPOINT=https://s3.us-west-004.backblazeb2.com
S3_FORCE_PATH_STYLE=false
S3_ACCESS_KEY_ID=<B2 application key ID>
S3_SECRET_ACCESS_KEY=<B2 application key>
```

**Wasabi**
```bash
STORAGE_DRIVER=s3
S3_BUCKET=my-bucket
S3_REGION=us-east-1
S3_ENDPOINT=https://s3.wasabisys.com
S3_FORCE_PATH_STYLE=false
S3_ACCESS_KEY_ID=<Wasabi access key>
S3_SECRET_ACCESS_KEY=<Wasabi secret key>
```

### MinIO (self-hosted, S3-compatible)

If you'd rather not depend on any third-party object storage provider, run MinIO yourself
alongside the app:

```yaml
# add to docker-compose.prod.yml
  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    restart: unless-stopped
    environment:
      MINIO_ROOT_USER: ${S3_ACCESS_KEY_ID}
      MINIO_ROOT_PASSWORD: ${S3_SECRET_ACCESS_KEY}
    volumes:
      - claimapp_minio:/data
    networks:
      - internal
```
(add `claimapp_minio:` under `volumes:` at the bottom). Then:
```bash
STORAGE_DRIVER=s3
S3_BUCKET=claimapp-uploads
S3_REGION=us-east-1
S3_ENDPOINT=http://minio:9000
S3_FORCE_PATH_STYLE=true
S3_ACCESS_KEY_ID=<same as MINIO_ROOT_USER>
S3_SECRET_ACCESS_KEY=<same as MINIO_ROOT_PASSWORD>
```
Create the bucket once via the MinIO console (`http://<host>:9001`) or the `mc` CLI before first use.

---

## Choosing local disk vs. cloud storage

`STORAGE_DRIVER=local` (the default) is fine for a single-instance deployment — it's simpler and
has no ongoing cost. Switch to `STORAGE_DRIVER=s3` when:

- You run more than one `server` replica (local disk isn't shared between containers/instances)
- You're on ephemeral/stateless compute (containers that can be destroyed and recreated without
  warning — most managed container platforms)
- You want offloaded backup/versioning/durability instead of managing a Docker volume yourself

Both drivers implement the same interface (`server/src/storage/types.ts`), so switching is just
an environment variable change — no data migration tooling is provided for moving *existing*
uploaded files between drivers if you switch mid-flight; do that manually (copy the contents of
`server/uploads/` into your bucket, preserving the `attachments/` and `branding/` folder
structure and filenames) if needed.
