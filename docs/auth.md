# Staff authentication (Phase 4)

## Use

Open `/login` and sign in with a confirmed Supabase Auth email/password whose
matching `profiles` row is active. All dashboard routes are protected in both
development and production. The earlier development preview bypass is removed.
Customers do not need an account and there is no signup route.

`GET /api/auth/me` returns only an active staff identity or null. Login never
returns access/refresh tokens. `POST /api/auth/logout` ends the current session;
other devices remain signed in. Dashboard account details and a sign-out button
replace the development-preview label.

## Security boundaries

- Request-scoped `@supabase/ssr` client, HttpOnly cookies, SameSite=Lax, Secure in
  production. No browser Supabase Auth client or localStorage session tokens.
- `getUser()` verifies identity through Supabase Auth; the current active profile
  and role are read with the user's JWT/RLS on every protected request.
- Server middleware redirects anonymous page requests to login and rejects API
  requests with 401. Services, barbers, working-hours, blocked-times, and settings
  require admin (403 otherwise). Route middleware/navigation mirror these rules.
- Request context caches only within that request. SSR uses the verified identity
  from server middleware, avoiding a second token refresh in an internal request.
- Refresh updates response cookies and no-store headers. Client navigation, tab
  focus, and a minute interval while the dashboard is mounted recheck the session.
- POST requests require same Origin, JSON, and `X-Toli-Request: 1`. No cross-origin
  CORS access is enabled. Login input is validated; error messages do not identify
  whether an email or staff profile exists. Redirect targets stay in the dashboard.
- Login has a bounded per-IP, per-process limit (10 attempts/15 minutes), in addition
  to Supabase's Auth limits. It does not trust X-Forwarded-For. For multiple app
  instances or a proxy, deploy a shared edge rate limiter/trusted proxy policy.
- Future APIs must use the request-scoped client plus `requireStaff(event, true)`
  for administrative operations. Never use a service-role key for normal staff CRUD.

## Deployment

Use HTTPS. Set `NUXT_APP_ORIGIN` to the exact public origin, without a trailing
slash, behind a reverse proxy (e.g. `https://booking.example.com`). Locally the
request origin is used. Keep dashboard/auth responses uncached at the proxy/CDN.
Apply a request-body size limit at the proxy as defense in depth.

Disable new-user signup in the hosted Supabase Authentication settings. Local
`supabase/config.toml` does not change the hosted project. Even if hosted signup
remains enabled, a new Auth user gets no active profile and cannot enter the app.

## First administrator

Create/confirm the Auth user using Supabase Authentication > Users. A trusted
operator can then run (with the existing private database URL in `.env`):

```sh
node --env-file=.env scripts/staff-account.mjs owner@example.com
node --env-file=.env scripts/staff-account.mjs owner@example.com --activate-admin
```

The first command is read-only. The second explicitly activates/promotes that
existing, confirmed user. It does not create users, set passwords, send email,
or derive privileges from user metadata. Keep `.env` private and remove template
brackets around the database password before running DB scripts.

Password recovery and staff-management UI are deferred; use trusted Supabase Auth
administration for account recovery. No password is stored by this application.

## Verification

```sh
npm run lint
npm run typecheck
npm run build
npm run test:auth
```

Tests start the production server on loopback port 3102 and a local Supabase HTTP
fixture on 55440. They exercise the real Supabase SDK and app routes, including
login/logout, session refresh, no-store/secure cookies, unauthenticated access,
inactive/unprovisioned accounts, roles, CSRF, encoded paths, and rate limiting.
They do not authenticate as or alter real hosted users. A final live sign-in uses
the administrator's own password in the browser, never in chat.
