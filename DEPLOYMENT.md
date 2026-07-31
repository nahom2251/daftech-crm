# DAFTECH CRM — GitHub & Render Deployment Guide

Repository layout:

```text
.
├── api/DaftechCrm/        ASP.NET Core 10 API (Clean Architecture) + Dockerfile
├── ng/daftech-crm/        Angular frontend (staff app + client portal)
├── render.yaml            Render blueprint: Postgres + API (Docker) + static site
└── .gitignore
```

## 1. Push to GitHub

Create an empty repository on GitHub (no README, no .gitignore), then from the
folder that contains this file:

```bash
git init
git add .
git commit -m "DAFTECH CRM: .NET 10 + PostgreSQL, file upload/download, PDF export, Render deploy"
git branch -M main
git remote add origin https://github.com/<your-account>/daftech-crm.git
git push -u origin main
```

If GitHub asks for a password, use a Personal Access Token
(GitHub → Settings → Developer settings → Tokens (classic) → `repo` scope).

## 2. Deploy on Render (Blueprint)

1. Render Dashboard → **New → Blueprint** → connect the GitHub repo.
2. Render reads `render.yaml` and creates three resources:
   - `daftech-crm-db` — managed PostgreSQL 16
   - `daftech-crm-api` — Docker web service built from `api/DaftechCrm/Dockerfile`
   - `daftech-crm-web` — static site built from `ng/daftech-crm`
3. Fill in the values marked "sync: false" when prompted:

| Service | Variable | Value |
| --- | --- | --- |
| api | `CORS_ALLOWED_ORIGINS` | `https://daftech-crm-web.onrender.com` (comma-separate multiple origins) |
| api | `Smtp__Host` / `Smtp__Username` / `Smtp__Password` | your mail provider credentials |
| web | `API_BASE_URL` | `https://daftech-crm-api.onrender.com/api` |

   `DATABASE_URL` is wired to the database automatically.
4. Deploy. The API is healthy once `/health/live` returns 200; readiness
   (`/health/ready`) also verifies the database connection.

### Why the earlier deploys failed, and what changed

| Symptom on Render | Cause | Fix in this version |
| --- | --- | --- |
| `Npgsql.NpgsqlException: format of the connection string` | Render supplies `postgres://user:pass@host/db`, which Npgsql does not accept | `PostgresConnectionString.Resolve()` converts it to key/value form and forces `SSL Mode=Require` |
| "No open ports detected" / deploy timeout | app listened on 5000/7001 | `Program.cs` binds `$PORT` (Dockerfile default 8080) |
| Infinite 307 redirect loop | `UseHttpsRedirection()` behind a TLS-terminating proxy | HTTPS redirection is skipped when `PORT` is set, and `UseForwardedHeaders` trusts `X-Forwarded-Proto` |
| `relation "Clients" does not exist` | the Migrations folder is empty, so `MigrateAsync()` was a no-op | startup applies migrations when present and falls back to `EnsureCreatedAsync()` otherwise |
| Crash writing `logs/crm-.log` | container filesystem is read-only outside mounted disks | Serilog file path comes from `LOG_DIR` (`/var/data/logs` on the mounted disk); set `LOG_DIR=off` to log to console only |
| Uploaded agreements vanished after redeploy | container storage is ephemeral | a 1 GB disk is mounted at `/var/data`, with `Storage__RootPath=/var/data/uploads` |
| 404 on refreshing `/staff/reports` | static host had no SPA fallback | `render.yaml` rewrites `/*` → `/index.html` |
| Frontend called `/api` on its own origin | production `apiBaseUrl` was hardcoded | `scripts/set-api-url.mjs` injects `API_BASE_URL` at build time |

## 2a. GitHub Actions: backup, migrations, and health check

`.github/workflows/deploy.yml` runs on every push to `main`:

1. **Backup production database** — `pg_dump`s the Neon database to a workflow artifact.
2. **Apply EF Core migrations** — runs `dotnet ef database update` against Neon.
3. **Verify Render deployment health** — hits `/health/live` and `/health/ready`.

Both the backup and migration steps read a single GitHub secret,
**`NEON_DATABASE_URL_PROD`**, in standard PostgreSQL URI format:

```
postgresql://<user>:<password>@<host>/<dbname>?sslmode=require
```

Get this value from the Neon dashboard → your project → **Connect** → make sure
the format selector is set to **"Connection string"**, not **".NET"**. The
".NET" tab produces a `Host=...;Username=...;Password=...` keyword string,
which Npgsql understands but `pg_dump` and the `dotnet ef` CLI do not — using
that format is what causes `pg_dump: error: invalid connection option "Host"`.

Set the secret at: repo → **Settings → Secrets and variables → Actions →
New repository secret**.

This is the same URI format the app itself accepts for `DATABASE_URL` at
runtime (see `PostgresConnectionString.Resolve()` in
`src/DaftechCrm.Infrastructure/Persistence/PostgresConnectionString.cs`), so
the whole project — CI and app — standardizes on one connection string
format everywhere.

## 3. Local development

```bash
# Postgres (Docker)
docker run -d --name daftech-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=daftech_crm -p 5432:5432 postgres:16

# API
cd api/DaftechCrm
export DATABASE_URL="postgres://postgres:postgres@localhost:5432/daftech_crm"
dotnet run --project src/DaftechCrm.Api      # https://localhost:7001

# Frontend
cd ng/daftech-crm
npm ci
npm start                                     # http://localhost:4200
```

Requires the .NET 10 SDK and Node 20+.

## 4. Verified in this build

- `dotnet build` on .NET 10: succeeds, 0 errors.
- `ng build --configuration production`: succeeds, 0 errors (283 kB initial bundle).
- Agreement documents: real upload (drag-and-drop, type/size validation, progress)
  and real download streamed from `GET /api/agreements/{id}/document`.
- Reports: PDF export produces a branded document via jsPDF + autoTable — no stubs.
