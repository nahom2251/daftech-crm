# DAFTECH CRM — Angular Frontend

Standalone-component Angular 17 build of the DAFTECH CRM spec: an Admin/Staff
app and a separate Client Portal. This now calls a real ASP.NET Core + MySQL
backend over HTTP — see the sibling `DaftechCrm` (.NET) project for the API.

## Running it

```bash
npm install
npm start        # ng serve, defaults to http://localhost:4200
```

**Before running:** open `src/environments/environment.ts` and set
`apiBaseUrl` to match whatever port `dotnet run` prints for the API
project (ASP.NET Core picks this per-machine — check the console output,
commonly something like `https://localhost:7001` or `http://localhost:5001`).
The backend's CORS policy in `Program.cs` is already set to allow
`http://localhost:4200`, so no backend change is needed once the port
lines up.

## Where things are

- `src/app/core/models.ts` — TypeScript types matching the .NET API's DTOs
  exactly, including enum value spelling (e.g. `ItSupport`, `InProgress` —
  no spaces/slashes, since these round-trip as JSON strings from C# enums).
  Human-readable display labels live alongside as `TICKET_CATEGORY_LABELS`
  / `EMPLOYEE_ROLE_LABELS`.
- `src/app/core/services/` — one service per entity, each backed by
  `HttpClient` calls to `/api/...` and an Angular signal cache populated on
  refresh. No more mock data — this is the real thing now.
- `src/app/staff/` — the Admin/Staff app.
- `src/app/portal/` — the Client Portal, including the new **Confirm
  Resolution** page (star rating) described below.

## What changed in this pass

**Ticket assignment is fully automatic.** There is no "Assign" button
anywhere in the UI — IT Support forwards a ticket and the backend picks
the employee with the fewest open tickets in the same request. The
Tickets page reflects this: it shows who got assigned, not a picker.

**Client confirmation + satisfaction rating.** When an employee marks a
ticket Resolved, it doesn't close — it moves to "Awaiting Client
Confirmation." The client sees it under the Portal's new **Confirm
Resolution** page, rates it 1-5 stars, and:
- **4.5★ / 90+ out of 100** → ticket closes normally.
- **Below that** → ticket status becomes `Escalated` and shows up in the
  Admin's Tickets page under "Escalated — Needs Admin Review."
- **No response** → the backend auto-closes it after the configured
  window (default 5 days) with no rating recorded.

Each employee's card on the Dashboard and Employees pages now shows an
**Avg. Satisfaction** column — the average score across their rated
tickets (auto-closes don't count, so they can't skew it).

**Branding.** The DAFTECH logo (`src/assets/daftech-logo.png`) now
appears in both apps' login screens, the staff sidebar, and the portal
topbar. The color palette in `styles.css` was rebuilt around the logo's
red/blue/charcoal instead of the earlier generic navy.

## The two original access-control features (unchanged in spirit, now real)

- **IP capture on login**: the backend resolves the caller's real IP
  server-side and logs every attempt via `LoginRecord` — see the .NET
  README's "Employee IP capture" section for the implementation. The
  Angular `AuthService.loginEmployee()` no longer resolves or sends an IP
  itself; it just reports what the server captured back to the login
  screen.
- **Admin disable / offboarding**: `EmployeeService.disableEmployee()`
  calls `POST /api/employees/{id}/disable`, which revokes device sessions
  and blocks logins on the backend in the same request.

## Session/presence tracking (SRS v2.0 §4.8)

Logging in starts a heartbeat (`SessionService.startHeartbeat`, roughly
once a minute) that pings the backend to keep you marked online and
update your last-seen time; logging out stops it and closes the session.
Admins can see everyone's current status on the new **Session Activity**
page. This is server-side presence tracking — separate from (and doesn't
fix) the client-side gap below.

## AI-assisted performance reports (SRS v2.0 §4.10)

The new **Employee Performance** page shows the same metrics report
either way, with an optional "✨ Add AI Summary" button that requests a
narrative on top. If the backend has no AI provider configured, the
button still works — it just comes back with a plain "unavailable"
message instead of a paragraph, and the metrics are unaffected either way.

## Progressive Web App

Built with `@angular/service-worker`. The Admin/Staff app and Client
Portal each install as a separate app (different name, icon, start page)
via two manifest variants (`manifest.webmanifest` /
`manifest-portal.webmanifest`) that `PwaManifestService` swaps based on
which side of the app you're on. Icons are generated from
`src/assets/daftech-logo.png` at `src/assets/icons/`. The service worker
only activates in production builds (`ng build`, not `ng serve`) — to see
installability locally you'll need to build and serve the `dist/` output
with something that respects the service worker (e.g. `npx http-server
dist/daftech-crm/browser`), since `ng serve` doesn't register it by
design.

## Known gaps / next steps

- File upload for scanned agreements (`Agreements` page) is still a
  placeholder string, not a real upload to Document Storage.
- "Download as PDF" on the Reports page is still stubbed.
- Client-side auth state still lives in memory only (refreshing the page
  logs you out) — this is separate from the new server-side session
  tracking above, which persists correctly. A token-based session
  (e.g. storing a JWT so a refresh doesn't lose login state) would close
  this gap; say the word if you want it next.

