# DAFTECH CRM

An IT support and client-services CRM: ticket intake and lifecycle management,
service agreements with document storage, employee/client accounts, session
and performance tracking, and a self-service client portal — built as an
ASP.NET Core 10 API over PostgreSQL with an Angular 17 frontend.

The system ships as two applications from one repository:

- **Staff/Admin app** — dashboard, ticket queue, employee and client
  management, service agreements, maintenance records, time tracking,
  performance reports, and session activity monitoring.
- **Client Portal** — self-signup, issue submission, ticket status, resolution
  confirmation, and satisfaction surveys.

---

## Contents

```text
.
├── api/DaftechCrm/        ASP.NET Core 10 API (Clean Architecture) + Dockerfile
├── ng/daftech-crm/        Angular 17 frontend (staff app + client portal)
├── render.yaml            Render blueprint: Postgres + API (Docker) + static site
└── DEPLOYMENT.md          GitHub → Render deployment guide, including a
                           troubleshooting log of issues hit in earlier deploys
```

---

## Architecture

### Backend — ASP.NET Core 10, Clean Architecture

```text
DaftechCrm.Domain          entities, enums — no external dependencies
DaftechCrm.Application     DTOs, service interfaces + implementations, business rules
DaftechCrm.Infrastructure  EF Core (Npgsql/PostgreSQL), email, storage, logging, health checks
DaftechCrm.Api             controllers, Program.cs, appsettings, background services
```

Each layer depends only inward (`Api` → `Infrastructure`/`Application` →
`Domain`), so business rules in `Application` have no dependency on EF Core,
ASP.NET, or any specific database.

**Data store:** PostgreSQL, via `Npgsql.EntityFrameworkCore.PostgreSQL`.
`PostgresConnectionString.Resolve()` accepts either a standard key/value
connection string or the `postgres://user:pass@host/db` URL form that managed
hosts (Render, Railway, Supabase, Neon) inject as `DATABASE_URL`, normalizing
it and forcing `SSL Mode=Require` for any non-local host.

**Cross-cutting concerns:**
- Structured logging via Serilog (console + rotating file sink, path
  configurable via `LOG_DIR`)
- Health checks at `/health`, `/health/ready` (includes DB connectivity),
  and `/health/live`
- Rate limiting and security headers (`AddSecurityHardening` /
  `AddCrmRateLimiting`)
- CORS origins configurable via `Cors:AllowedOrigins` or the
  `CORS_ALLOWED_ORIGINS` environment variable, so a deployment can be
  re-pointed at a new frontend origin without a rebuild
- Two hosted background services: `AutoCloseTicketsHostedService` (closes
  unconfirmed resolved tickets after the configured response window) and
  `SessionSweepHostedService` (flips stale sessions to offline)

### Frontend — Angular 17

Standalone components with lazy-loaded routes, split into two route trees
under one build:

- `/admin/**` — staff app, guarded by `staffAuthGuard` /
  `adminRoleGuard` for admin-only screens (employees, signup requests,
  session activity)
- `/portal/**` — client portal, guarded by `clientAuthGuard`

`core/services/*.ts` call the API directly via `HttpClient` and mirror the
backend controllers one-for-one (tickets, clients, employees, agreements,
sessions, notifications, reports). An auth interceptor attaches the bearer
token; an error interceptor handles auth failures and surfaces API errors as
toasts.

The app is configured as an installable PWA (`@angular/service-worker`) with
two manifest variants — staff and portal — swapped at runtime based on the
active route, since the two are meant to install as separate apps despite
sharing one deployment.

---

## Domain model

| Entity | Purpose |
| --- | --- |
| `Employee` | Staff account — Admin, IT Support, or Employee/Technician role(s); IP allow-list, device sessions, login history |
| `Client` | Customer account; self-signup (pending approval) or admin-registered (approved immediately) |
| `Ticket` | Support ticket; full lifecycle from submission through auto-assignment to closure |
| `Agreement` | Service agreement per client, with an uploaded document (PDF/Word/image) |
| `MaintenanceRecord` | Scheduled/completed maintenance work log |
| `TimeLog` | Employee clock-in/clock-out entries |
| `LoginSession` | Live presence record (online status, last-seen, IP) — see Sessions below |
| `AppNotification` | In-app notifications for staff and clients |
| `SatisfactionSurvey` | Client rating tied to a resolved ticket |

## Ticket lifecycle

```text
Submitted → Forwarded → Assigned (auto) → In Progress → Resolved
  → AwaitingClientConfirmation → { Closed | Escalated | Closed (auto) }
```

- **Assignment is fully automatic and has no admin override.** When IT
  Support forwards a ticket (`POST /api/tickets/{id}/forward`),
  `TicketAssignmentService` assigns it to the Active technician with the
  fewest open tickets, ties broken by longest time since their last
  assignment.
- **Resolution requires client confirmation.** An employee marking a ticket
  `Resolved` doesn't close it — it moves to `AwaitingClientConfirmation` and
  starts a configurable response window (default 5 days).
- The client responds via `POST /api/tickets/{id}/confirm` with `IsFixed`
  and, if fixed, a 1–5 star rating (converted to a 0–100 score):
  - **≥ 90** → closes normally (`ClosureReason.ClientConfirmedSatisfied`)
  - **< 90** → status becomes `Escalated` for admin review, not returned to
    the employee automatically
  - **Not fixed** → reopens to the assigned employee (`InProgress`), no
    rating recorded, does not enter the escalation queue
- **No response within the window** → `AutoCloseTicketsHostedService`
  (polls every 15 minutes) closes it as `AutoClosedNoResponse`, and it is
  excluded from the employee's satisfaction average.
- `Employee.AverageSatisfactionScore` is computed only from rated tickets.

Both the satisfaction threshold (90) and the response window (5 days) are
configurable in `appsettings.json` under `TicketWorkflow`.

## Accounts, credentials, and password policy

There is no self-service staff signup. Every staff account (Admin, IT
Support, Employee/Technician) is created by an admin via `POST
/api/employees`. Clients either self-signup (`POST /api/clients/signup`,
lands in `Pending` for approval) or are registered directly by an admin
(`POST /api/clients/register`, approved immediately).

Either path:

1. Generates a username from initials + random digits (e.g. `mf4821`),
   retrying on collision.
2. Generates a random one-time password, hashed with PBKDF2-SHA256 before
   storage — the plaintext is never persisted.
3. Emails the plaintext username and password via MailKit/SMTP.
4. Returns the plaintext credentials once in the response body regardless of
   email delivery outcome (`EmailSent` / `EmailError`), so an admin can relay
   them manually if delivery fails, or trigger
   `POST /api/employees/{id}/resend-credential-email` /
   `POST /api/clients/{id}/resend-credential-email` for a fresh one-time
   password (the previous one is invalidated).
5. Sets `MustChangePassword = true`, which routes the account to a forced
   change-password screen on first login
   (`POST /api/auth/employee/{id}/change-password` or
   `POST /api/auth/client/{id}/change-password`) before anything else is
   reachable. Both require the current password as proof of identity and
   validate the new password/confirmation match server-side.

Seeded demo accounts (see `SeedData.cs`) skip the forced change and use a
shared password so the system is immediately explorable — see
[Demo accounts](#demo-accounts).

## Sessions and presence

Every login opens a `LoginSession` row. The frontend calls
`POST /api/sessions/touch` roughly once a minute while a tab is open to keep
`OnlineStatus` true and `LastSeen` current; logging out calls
`POST /api/sessions/close`. If neither happens (closed tab, crash),
`SessionSweepHostedService` flips any session whose last heartbeat exceeds
`Session:OfflineAfterMinutes` (default 5) back to offline.

`GET /api/sessions/activity` is the admin's live session view across
employees and clients; `GET /api/sessions/history` returns full session
history for one account. This is distinct from `LoginRecord`, an append-only
audit log of every login attempt (including blocked ones).

## AI-assisted performance narratives (optional)

`GET /api/reports/employee-performance/{employeeId}?includeAiNarrative=true`
always returns the underlying metrics (tickets assigned/resolved, on-time
rate, average resolution time, average satisfaction, hours worked); the AI
narrative is additive.

Disabled by default (`AiReporting:Enabled = false`). When enabled,
`AnthropicNarrativeReportService` calls the Anthropic Messages API directly
over `HttpClient`. Any failure — disabled, missing key, timeout, non-2xx
response — returns `Available: false` with a human-readable reason rather
than throwing; the numeric metrics are unaffected. The prompt only narrates
figures already computed elsewhere.

To enable locally:

```bash
cd api/DaftechCrm/src/DaftechCrm.Api
dotnet user-secrets set "AiReporting:Enabled" "true"
dotnet user-secrets set "AiReporting:ApiKey" "sk-ant-..."
```

---

## API surface

All routes are under `/api`. Swagger UI is available at `/swagger` (enabled
by default in every environment unless `Swagger:Enabled` is set to `false`).

| Area | Base route | Notes |
| --- | --- | --- |
| Auth | `/api/auth` | `employee-login`, `client-login`, forced password change endpoints |
| Employees | `/api/employees` | CRUD, disable/enable, IP allow-list, device sessions, login history, credential resend |
| Clients | `/api/clients` | list, signup, admin registration, approve/reject, credential resend |
| Tickets | `/api/tickets` | list/filter, create, forward (triggers auto-assignment), status update, client confirmation, escalation queue |
| Agreements | `/api/agreements` | CRUD, per-client lookup, expiring-soon, document upload/download/delete |
| Maintenance | `/api/maintenance` | maintenance record log |
| Time logs | `/api/time-logs` | clock-in / clock-out |
| Notifications | `/api/notifications` | list, mark read, mark all read |
| Sessions | `/api/sessions` | activity, history, heartbeat (`touch`), `close` |
| Reports | `/api/reports` | on-time resolution, employee performance (with optional AI narrative) |
| Satisfaction surveys | `/api/satisfaction-surveys` | per-ticket surveys |
| Health | `/health`, `/health/ready`, `/health/live` | liveness/readiness for container platforms |

---

## Getting started (local development)

**Prerequisites:** .NET 10 SDK, Node 20+, and a PostgreSQL instance (16
recommended).

```bash
# 1. PostgreSQL (Docker)
docker run -d --name daftech-pg \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=daftech_crm \
  -p 5432:5432 postgres:16

# 2. API
cd api/DaftechCrm
export DATABASE_URL="postgres://postgres:postgres@localhost:5432/daftech_crm"
dotnet run --project src/DaftechCrm.Api
# → https://localhost:7001, Swagger at /swagger

# 3. Frontend
cd ng/daftech-crm
npm ci
npm start
# → http://localhost:4200
```

Migrations and baseline seed data are applied automatically on API startup
(`MigrateAndSeedAsync`, called from `Program.cs`). A database connectivity
issue at startup is logged, not fatal — the process stays up so health
endpoints can report the problem.

If you'd rather use `appsettings.json`/user-secrets instead of
`DATABASE_URL`:

```bash
cd api/DaftechCrm/src/DaftechCrm.Api
dotnet user-secrets init
dotnet user-secrets set "ConnectionStrings:Postgres" \
  "Host=localhost;Port=5432;Database=daftech_crm;Username=postgres;Password=YOUR_PASSWORD;"
```

SMTP credentials for account-credential emails, also via user-secrets:

```bash
dotnet user-secrets set "Smtp:Host" "smtp.yourprovider.com"
dotnet user-secrets set "Smtp:Port" "587"
dotnet user-secrets set "Smtp:Username" "your-smtp-username"
dotnet user-secrets set "Smtp:Password" "your-smtp-password"
dotnet user-secrets set "Smtp:FromAddress" "no-reply@daftech.et"
```

### Demo accounts

All seeded accounts (`SeedData.cs`) share one password and skip the forced
first-login change, so the system is explorable immediately:

| Username | Name | Role | Password |
| --- | --- | --- | --- |
| `na1001` | Nahom Alehegne | Admin | `DaftechDemo1!` |
| `ns1002` | Nebil Sherefa | IT Support | `DaftechDemo1!` |
| `mf1003` | Mekdes Fikru | Employee/Technician | `DaftechDemo1!` |
| `rg1004` | Robel Getachew | Employee/Technician (disabled) | `DaftechDemo1!` |
| `at2001` | Abyssinia Traders PLC (client) | — | `DaftechDemo1!` |
| `mm2002` | Merkato Micro-Finance (client) | — | `DaftechDemo1!` |

Accounts created afterward through the real registration flows do **not**
follow this pattern — they get a random one-time password and must change it
on first login.

---

## Deployment

The repository deploys as three Render resources via `render.yaml`:
a managed PostgreSQL database, the API as a Docker web service, and the
Angular build as a static site with SPA fallback routing.

Full step-by-step instructions, environment variable reference, and a
troubleshooting log of issues encountered in earlier deployment attempts
(connection-string format, port binding, HTTPS-redirect loops behind a
proxy, ephemeral storage, missing SPA fallback, and hardcoded API URLs) are
in **[DEPLOYMENT.md](./DEPLOYMENT.md)**.

---

## Tech stack summary

| Layer | Technology |
| --- | --- |
| API | ASP.NET Core 10, C#, Clean Architecture |
| ORM / DB | EF Core 10 + Npgsql, PostgreSQL |
| Email | MailKit (SMTP), Polly for retry with backoff |
| Logging | Serilog (console + rotating file) |
| Frontend | Angular 17, standalone components, RxJS |
| PDF export | jsPDF + jspdf-autotable |
| PWA | `@angular/service-worker`, dual manifest (staff/portal) |
| Hosting | Docker (API), static site (frontend), managed Postgres — Render blueprint included |
